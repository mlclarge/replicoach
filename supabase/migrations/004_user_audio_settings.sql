-- Feature 2: Audio Delays - Paramètres de délai avant et après
-- Permet à l'utilisateur de configurer les pauses de lecture audio en mode filtrage personnel

CREATE TABLE IF NOT EXISTS user_audio_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  delay_before_ms INTEGER NOT NULL DEFAULT 1500,
  delay_after_ms INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_audio_settings ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir et modifier leurs propres paramètres audio
CREATE POLICY "Users read own audio settings" ON user_audio_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own audio settings" ON user_audio_settings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users insert own audio settings" ON user_audio_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
