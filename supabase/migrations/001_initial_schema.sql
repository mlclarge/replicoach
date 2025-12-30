-- =============================================
-- RÉPLICOACH - Schema de base de données
-- Exécuter dans Supabase SQL Editor
-- =============================================

-- Extension pour générer des UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLE: scripts (les pièces/saynètes)
-- =============================================
CREATE TABLE scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    full_text TEXT,
    original_filename TEXT,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- TABLE: characters (personnages)
-- =============================================
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#8B1538',
    voice_name TEXT,
    voice_pitch DECIMAL DEFAULT 1.0,
    voice_rate DECIMAL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- TABLE: replicas (répliques)
-- =============================================
CREATE TABLE replicas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE NOT NULL,
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE NOT NULL,
    order_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    text_gaps TEXT,
    cue_words TEXT,
    previous_character_id UUID REFERENCES characters(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- TABLE: script_shares (partages/collaboration)
-- =============================================
CREATE TABLE script_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE NOT NULL,
    shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    shared_with_email TEXT NOT NULL,
    can_edit BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(script_id, shared_with_email)
);

-- =============================================
-- INDEX pour les performances
-- =============================================
CREATE INDEX idx_scripts_user_id ON scripts(user_id);
CREATE INDEX idx_characters_script_id ON characters(script_id);
CREATE INDEX idx_replicas_script_id ON replicas(script_id);
CREATE INDEX idx_replicas_character_id ON replicas(character_id);
CREATE INDEX idx_replicas_order ON replicas(script_id, order_index);
CREATE INDEX idx_shares_email ON script_shares(shared_with_email);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE replicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_shares ENABLE ROW LEVEL SECURITY;

-- Policies pour SCRIPTS
CREATE POLICY "Users can view own scripts"
    ON scripts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared scripts"
    ON scripts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM script_shares
            WHERE script_shares.script_id = scripts.id
            AND script_shares.shared_with_email = auth.email()
        )
    );

CREATE POLICY "Users can insert own scripts"
    ON scripts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scripts"
    ON scripts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scripts"
    ON scripts FOR DELETE
    USING (auth.uid() = user_id);

-- Policies pour CHARACTERS
CREATE POLICY "Users can manage characters of own scripts"
    ON characters FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM scripts
            WHERE scripts.id = characters.script_id
            AND scripts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view characters of shared scripts"
    ON characters FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM script_shares
            WHERE script_shares.script_id = characters.script_id
            AND script_shares.shared_with_email = auth.email()
        )
    );

-- Policies pour REPLICAS
CREATE POLICY "Users can manage replicas of own scripts"
    ON replicas FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM scripts
            WHERE scripts.id = replicas.script_id
            AND scripts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view replicas of shared scripts"
    ON replicas FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM script_shares
            WHERE script_shares.script_id = replicas.script_id
            AND script_shares.shared_with_email = auth.email()
        )
    );

-- Policies pour SCRIPT_SHARES
CREATE POLICY "Users can manage shares of own scripts"
    ON script_shares FOR ALL
    USING (auth.uid() = shared_by);

CREATE POLICY "Users can view shares for their email"
    ON script_shares FOR SELECT
    USING (shared_with_email = auth.email());

-- =============================================
-- STORAGE BUCKET pour les PDFs
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('scripts-pdfs', 'scripts-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload to their own folder
CREATE POLICY "Users can upload PDFs"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'scripts-pdfs'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy: Users can view their own PDFs
CREATE POLICY "Users can view own PDFs"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'scripts-pdfs'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy: Users can delete their own PDFs
CREATE POLICY "Users can delete own PDFs"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'scripts-pdfs'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
