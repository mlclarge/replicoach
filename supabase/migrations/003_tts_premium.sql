-- Chantier #13 : voix de synthèse Premium (Google Cloud TTS)
-- Toutes les écritures passent par l'endpoint serveur /api/tts (service_role).

-- 1. Voix verrouillée par personnage et par script
CREATE TABLE IF NOT EXISTS tts_voice_locks (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, script_id, character_id)
);

-- 2. Cache audio privé (une ligne par réplique générée)
CREATE TABLE IF NOT EXISTS tts_audio_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  replica_id UUID NOT NULL REFERENCES replicas(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, replica_id, voice_id, text_hash)
);
CREATE INDEX IF NOT EXISTS idx_tts_audio_cache_script ON tts_audio_cache(user_id, script_id);

-- 3. Consommation mensuelle (mois UTC, format YYYY-MM)
CREATE TABLE IF NOT EXISTS tts_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  chars_used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, period)
);

ALTER TABLE tts_voice_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tts_audio_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE tts_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own voice locks" ON tts_voice_locks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own tts cache" ON tts_audio_cache
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own tts usage" ON tts_usage
  FOR SELECT USING (auth.uid() = user_id);

-- 4. Réservation atomique de quota : renvoie le total après réservation, ou -1 si dépassement
CREATE OR REPLACE FUNCTION reserve_tts_quota(p_user UUID, p_period TEXT, p_chars INTEGER, p_limit INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  INSERT INTO tts_usage (user_id, period, chars_used)
  VALUES (p_user, p_period, 0)
  ON CONFLICT (user_id, period) DO NOTHING;

  UPDATE tts_usage
  SET chars_used = chars_used + p_chars
  WHERE user_id = p_user AND period = p_period AND chars_used + p_chars <= p_limit
  RETURNING chars_used INTO v_total;

  RETURN COALESCE(v_total, -1);
END;
$$;

-- Remboursement si la génération échoue
CREATE OR REPLACE FUNCTION release_tts_quota(p_user UUID, p_period TEXT, p_chars INTEGER)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE tts_usage
  SET chars_used = GREATEST(chars_used - p_chars, 0)
  WHERE user_id = p_user AND period = p_period;
$$;

REVOKE ALL ON FUNCTION reserve_tts_quota(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION release_tts_quota(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_tts_quota(UUID, TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION release_tts_quota(UUID, TEXT, INTEGER) TO service_role;

-- 5. Bucket PRIVÉ pour le cache audio (chemin : <user_id>/<script_id>/<fichier>.mp3)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tts-cache', 'tts-cache', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "Users read own tts audio" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'tts-cache' AND (storage.foldername(name))[1] = auth.uid()::text);
