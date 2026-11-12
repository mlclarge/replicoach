-- =========================================================
-- MIGRATION 005 : Gestion documentaire du metteur en scène
-- Consignes rattachées à une pièce (fichier, lien, lien vidéo)
-- À exécuter une fois dans le SQL Editor de Supabase.
-- =========================================================

-- 1. Colonnes de rattachement à une pièce et type de consigne
ALTER TABLE public.director_notes
  ADD COLUMN IF NOT EXISTS script_id UUID REFERENCES public.scripts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'script',
  ADD COLUMN IF NOT EXISTS scope_key TEXT,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Un lien n'a pas de fichier associé
ALTER TABLE public.director_notes ALTER COLUMN file_path DROP NOT NULL;

ALTER TABLE public.director_notes DROP CONSTRAINT IF EXISTS director_notes_scope_type_check;
ALTER TABLE public.director_notes ADD CONSTRAINT director_notes_scope_type_check
  CHECK (scope_type IN ('script', 'act', 'scene', 'replica'));

ALTER TABLE public.director_notes DROP CONSTRAINT IF EXISTS director_notes_kind_check;
ALTER TABLE public.director_notes ADD CONSTRAINT director_notes_kind_check
  CHECK (kind IN ('file', 'link', 'video_link'));

ALTER TABLE public.director_notes DROP CONSTRAINT IF EXISTS director_notes_content_check;
ALTER TABLE public.director_notes ADD CONSTRAINT director_notes_content_check
  CHECK (
    (kind = 'file' AND file_path IS NOT NULL)
    OR (kind <> 'file' AND url IS NOT NULL AND url ~* '^https://')
  );

CREATE INDEX IF NOT EXISTS idx_director_notes_script_id ON public.director_notes(script_id);

-- 2. Fonctions d'accès
CREATE OR REPLACE FUNCTION public.is_script_assigned_to_me(sid UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.script_assignments a
    WHERE a.script_id = sid
      AND lower(a.assigned_to_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_director_or_dev()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('dev', 'director')
  );
$$;

-- 3. Politiques RLS
-- Lecture : consignes publiques, personnelles, de troupe, ou d'une pièce à laquelle j'ai accès
DROP POLICY IF EXISTS "dn_select" ON public.director_notes;
CREATE POLICY "dn_select" ON public.director_notes FOR SELECT TO authenticated
  USING (
    user_id IS NULL
    OR user_id = auth.uid()
    OR (troupe_id IS NOT NULL AND public.is_troupe_member(troupe_id))
    OR (script_id IS NOT NULL AND (
      public.is_script_owner(script_id)
      OR public.is_script_shared_with_me(script_id)
      OR public.is_script_assigned_to_me(script_id)
    ))
  );

-- Ajout : une consigne rattachée à une pièce est réservée aux metteurs en scène et au dev
DROP POLICY IF EXISTS "dn_insert" ON public.director_notes;
CREATE POLICY "dn_insert" ON public.director_notes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (troupe_id IS NULL OR public.is_troupe_member(troupe_id))
    AND (
      script_id IS NULL
      OR (public.is_director_or_dev() AND (public.is_script_owner(script_id) OR public.is_dev()))
    )
  );
