-- =========================================================
-- MIGRATION 003 : Tables pour Metteurs en Scène & Beta Testeurs
-- RépliCoach - Modèle Didascalie & Affectation par E-mail
-- =========================================================

-- 1. Table des comédiens suivis par un metteur en scène
CREATE TABLE IF NOT EXISTS director_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  director_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_director_actor UNIQUE (director_id, actor_email)
);

-- 2. Table des affectations de textes par e-mail
CREATE TABLE IF NOT EXISTS script_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to_email TEXT NOT NULL,
  is_default BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_script_assigned UNIQUE (script_id, assigned_to_email)
);

-- Index pour la performance
CREATE INDEX IF NOT EXISTS idx_director_members_director ON director_members(director_id);
CREATE INDEX IF NOT EXISTS idx_director_members_email ON director_members(actor_email);
CREATE INDEX IF NOT EXISTS idx_script_assignments_email ON script_assignments(assigned_to_email);

-- Activation RLS
ALTER TABLE director_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_assignments ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour director_members
DROP POLICY IF EXISTS "Metteur en scène gère ses comédiens" ON director_members;
CREATE POLICY "Metteur en scène gère ses comédiens"
  ON director_members FOR ALL
  USING (auth.uid() = director_id);

DROP POLICY IF EXISTS "Comédien voit son appartenance" ON director_members;
CREATE POLICY "Comédien voit son appartenance"
  ON director_members FOR SELECT
  USING (LOWER(actor_email) = LOWER(auth.jwt()->>'email'));

-- Politiques RLS pour script_assignments
DROP POLICY IF EXISTS "Metteur en scène gère ses affectations" ON script_assignments;
CREATE POLICY "Metteur en scène gère ses affectations"
  ON script_assignments FOR ALL
  USING (auth.uid() = assigned_by);

DROP POLICY IF EXISTS "Comédien voit ses textes affectés" ON script_assignments;
CREATE POLICY "Comédien voit ses textes affectés"
  ON script_assignments FOR SELECT
  USING (LOWER(assigned_to_email) = LOWER(auth.jwt()->>'email'));

-- =========================================================
-- ACCÈS RLS COMPLÉMENTAIRES SUR SCRIPTS, CHARACTERS, REPLICAS
-- Autoriser les comédiens à lire les pièces affectées par leur e-mail
-- =========================================================

DROP POLICY IF EXISTS "Comédien lit son texte affecté" ON scripts;
CREATE POLICY "Comédien lit son texte affecté"
  ON scripts FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM script_assignments
      WHERE script_assignments.script_id = scripts.id
      AND LOWER(script_assignments.assigned_to_email) = LOWER(auth.jwt()->>'email')
    )
  );

DROP POLICY IF EXISTS "Comédien lit les personnages du texte affecté" ON characters;
CREATE POLICY "Comédien lit les personnages du texte affecté"
  ON characters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scripts
      WHERE scripts.id = characters.script_id
      AND (
        scripts.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM script_assignments
          WHERE script_assignments.script_id = scripts.id
          AND LOWER(script_assignments.assigned_to_email) = LOWER(auth.jwt()->>'email')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Comédien lit les répliques du texte affecté" ON replicas;
CREATE POLICY "Comédien lit les répliques du texte affecté"
  ON replicas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scripts
      WHERE scripts.id = replicas.script_id
      AND (
        scripts.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM script_assignments
          WHERE script_assignments.script_id = scripts.id
          AND LOWER(script_assignments.assigned_to_email) = LOWER(auth.jwt()->>'email')
        )
      )
    )
  );
