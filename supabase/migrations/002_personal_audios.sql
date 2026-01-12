-- Table pour les audios personnels importés par les utilisateurs
CREATE TABLE IF NOT EXISTS personal_audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  source_public_doc_id UUID DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour accélérer les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_personal_audios_user_id ON personal_audios(user_id);

-- RLS (Row Level Security)
ALTER TABLE personal_audios ENABLE ROW LEVEL SECURITY;

-- Politique : les utilisateurs ne voient que leurs propres audios
CREATE POLICY "Users can view own audios" ON personal_audios
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audios" ON personal_audios
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own audios" ON personal_audios
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own audios" ON personal_audios
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- Ajout colonne audio_url à la table scripts
-- Pour permettre d'associer un audio à un texte
-- =============================================
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS audio_url TEXT DEFAULT NULL;
