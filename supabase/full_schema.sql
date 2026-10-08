-- =====================================================================
-- RépliCoach - Schéma COMPLET pour un nouveau projet Supabase
-- À exécuter UNE SEULE FOIS dans SQL Editor d'un projet vide
-- (remplace 001_initial_schema.sql et 002_personal_audios.sql).
-- Reconstitué à partir du code de l'application.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gen_troupe_code()
RETURNS text LANGUAGE sql AS $$
  SELECT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$;

-- ---------------------------------------------------------------------
-- Profils (is_premium lu par le front ET par le backend OCR Render)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Création automatique du profil à la première connexion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- Rôles applicatifs (dev / director / member)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('dev', 'director', 'member')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_dev()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'dev');
$$;

-- ---------------------------------------------------------------------
-- Scripts, personnages, répliques
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  full_text TEXT,
  original_filename TEXT,
  pdf_url TEXT,
  audio_url TEXT,
  display_order INTEGER DEFAULT 0,
  source_public_doc_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8B1538',
  voice_name TEXT,
  voice_pitch NUMERIC DEFAULT 1.0,
  voice_rate NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.replicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  text_gaps TEXT,
  cue_words TEXT,
  previous_character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON public.scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_script_id ON public.characters(script_id);
CREATE INDEX IF NOT EXISTS idx_replicas_script_id ON public.replicas(script_id);
CREATE INDEX IF NOT EXISTS idx_replicas_character_id ON public.replicas(character_id);
CREATE INDEX IF NOT EXISTS idx_replicas_order ON public.replicas(script_id, order_index);

DROP TRIGGER IF EXISTS trg_scripts_updated_at ON public.scripts;
CREATE TRIGGER trg_scripts_updated_at BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- Troupes et partage
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.troupes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE DEFAULT public.gen_troupe_code(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.troupe_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  troupe_id UUID NOT NULL REFERENCES public.troupes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (troupe_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_troupe_member(tid UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.troupe_members WHERE troupe_id = tid AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_troupe_admin(tid UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.troupe_members
    WHERE troupe_id = tid AND user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_script_owner(sid UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.scripts WHERE id = sid AND user_id = auth.uid());
$$;

-- Le créateur d'une troupe en devient automatiquement admin
CREATE OR REPLACE FUNCTION public.handle_new_troupe()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.troupe_members (troupe_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'admin')
  ON CONFLICT (troupe_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_troupe_created ON public.troupes;
CREATE TRIGGER on_troupe_created
  AFTER INSERT ON public.troupes
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_troupe();

CREATE TABLE IF NOT EXISTS public.shared_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  troupe_id UUID NOT NULL REFERENCES public.troupes(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (script_id, troupe_id)
);

CREATE OR REPLACE FUNCTION public.is_script_shared_with_me(sid UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_scripts ss
    JOIN public.troupe_members tm ON tm.troupe_id = ss.troupe_id
    WHERE ss.script_id = sid AND tm.user_id = auth.uid()
  );
$$;

CREATE TABLE IF NOT EXISTS public.troupe_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  troupe_id UUID NOT NULL REFERENCES public.troupes(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.troupe_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  troupe_id UUID NOT NULL REFERENCES public.troupes(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shared_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  troupe_id UUID NOT NULL REFERENCES public.troupes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  duration NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Documents publics, consignes, vidéos globales
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.public_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT DEFAULT 'other',
  category TEXT DEFAULT 'script',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_approved BOOLEAN NOT NULL DEFAULT true,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.increment_download_count(doc_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.public_documents SET download_count = download_count + 1 WHERE id = doc_id;
$$;

-- user_id NULL = consigne publique visible par tous
CREATE TABLE IF NOT EXISTS public.director_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  troupe_id UUID REFERENCES public.troupes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.global_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Tags et sous-ensembles de répliques
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.script_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.user_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (script_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.replica_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  tag_id UUID REFERENCES public.user_tags(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.replica_group_items (
  group_id UUID NOT NULL REFERENCES public.replica_groups(id) ON DELETE CASCADE,
  replica_id UUID NOT NULL REFERENCES public.replicas(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  PRIMARY KEY (group_id, replica_id)
);

-- ---------------------------------------------------------------------
-- Notes et enregistrements personnels
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  after_replica_id UUID REFERENCES public.replicas(id) ON DELETE SET NULL,
  text TEXT,
  note_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_personal_notes_updated_at ON public.personal_notes;
CREATE TRIGGER trg_personal_notes_updated_at BEFORE UPDATE ON public.personal_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  after_replica_id UUID REFERENCES public.replicas(id) ON DELETE SET NULL,
  audio_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.character_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (character_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.personal_audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  source_public_doc_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_audios_user_id ON public.personal_audios(user_id);

-- Monitoring (utilisateurs actifs)
CREATE TABLE IF NOT EXISTS public.active_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ DEFAULT now(),
  page TEXT
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replicas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troupes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troupe_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_scripts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troupe_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troupe_videos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_recordings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.director_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_videos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replica_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replica_group_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_recordings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_audios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions       ENABLE ROW LEVEL SECURITY;

-- profiles : lecture de son propre profil ; is_premium n'est modifiable que par SQL/service_role
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- user_roles
DROP POLICY IF EXISTS "roles_select" ON public.user_roles;
CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_dev());
DROP POLICY IF EXISTS "roles_write_dev" ON public.user_roles;
CREATE POLICY "roles_write_dev" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());

-- scripts
DROP POLICY IF EXISTS "scripts_select" ON public.scripts;
CREATE POLICY "scripts_select" ON public.scripts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_script_shared_with_me(id));
DROP POLICY IF EXISTS "scripts_insert" ON public.scripts;
CREATE POLICY "scripts_insert" ON public.scripts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "scripts_update" ON public.scripts;
CREATE POLICY "scripts_update" ON public.scripts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "scripts_delete" ON public.scripts;
CREATE POLICY "scripts_delete" ON public.scripts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- characters
DROP POLICY IF EXISTS "characters_select" ON public.characters;
CREATE POLICY "characters_select" ON public.characters FOR SELECT TO authenticated
  USING (public.is_script_owner(script_id) OR public.is_script_shared_with_me(script_id));
DROP POLICY IF EXISTS "characters_write" ON public.characters;
CREATE POLICY "characters_write" ON public.characters FOR ALL TO authenticated
  USING (public.is_script_owner(script_id)) WITH CHECK (public.is_script_owner(script_id));

-- replicas
DROP POLICY IF EXISTS "replicas_select" ON public.replicas;
CREATE POLICY "replicas_select" ON public.replicas FOR SELECT TO authenticated
  USING (public.is_script_owner(script_id) OR public.is_script_shared_with_me(script_id));
DROP POLICY IF EXISTS "replicas_write" ON public.replicas;
CREATE POLICY "replicas_write" ON public.replicas FOR ALL TO authenticated
  USING (public.is_script_owner(script_id)) WITH CHECK (public.is_script_owner(script_id));

-- troupes (lecture ouverte aux connectés : nécessaire pour rejoindre par code)
DROP POLICY IF EXISTS "troupes_select" ON public.troupes;
CREATE POLICY "troupes_select" ON public.troupes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "troupes_insert" ON public.troupes;
CREATE POLICY "troupes_insert" ON public.troupes FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "troupes_update" ON public.troupes;
CREATE POLICY "troupes_update" ON public.troupes FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_troupe_admin(id));
DROP POLICY IF EXISTS "troupes_delete" ON public.troupes;
CREATE POLICY "troupes_delete" ON public.troupes FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- troupe_members
DROP POLICY IF EXISTS "tm_select" ON public.troupe_members;
CREATE POLICY "tm_select" ON public.troupe_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_troupe_member(troupe_id));
DROP POLICY IF EXISTS "tm_join" ON public.troupe_members;
CREATE POLICY "tm_join" ON public.troupe_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'member');
DROP POLICY IF EXISTS "tm_update_admin" ON public.troupe_members;
CREATE POLICY "tm_update_admin" ON public.troupe_members FOR UPDATE TO authenticated
  USING (public.is_troupe_admin(troupe_id)) WITH CHECK (public.is_troupe_admin(troupe_id));
DROP POLICY IF EXISTS "tm_delete" ON public.troupe_members;
CREATE POLICY "tm_delete" ON public.troupe_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_troupe_admin(troupe_id));

-- shared_scripts
DROP POLICY IF EXISTS "ss_select" ON public.shared_scripts;
CREATE POLICY "ss_select" ON public.shared_scripts FOR SELECT TO authenticated
  USING (public.is_troupe_member(troupe_id) OR shared_by = auth.uid());
DROP POLICY IF EXISTS "ss_insert" ON public.shared_scripts;
CREATE POLICY "ss_insert" ON public.shared_scripts FOR INSERT TO authenticated
  WITH CHECK (shared_by = auth.uid() AND public.is_script_owner(script_id)
              AND public.is_troupe_member(troupe_id));
DROP POLICY IF EXISTS "ss_delete" ON public.shared_scripts;
CREATE POLICY "ss_delete" ON public.shared_scripts FOR DELETE TO authenticated
  USING (shared_by = auth.uid() OR public.is_script_owner(script_id)
         OR public.is_troupe_admin(troupe_id));

-- troupe_documents
DROP POLICY IF EXISTS "td_select" ON public.troupe_documents;
CREATE POLICY "td_select" ON public.troupe_documents FOR SELECT TO authenticated
  USING (public.is_troupe_member(troupe_id));
DROP POLICY IF EXISTS "td_insert" ON public.troupe_documents;
CREATE POLICY "td_insert" ON public.troupe_documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.is_troupe_member(troupe_id));
DROP POLICY IF EXISTS "td_delete" ON public.troupe_documents;
CREATE POLICY "td_delete" ON public.troupe_documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_troupe_admin(troupe_id));

-- troupe_videos
DROP POLICY IF EXISTS "tv_select" ON public.troupe_videos;
CREATE POLICY "tv_select" ON public.troupe_videos FOR SELECT TO authenticated
  USING (public.is_troupe_member(troupe_id));
DROP POLICY IF EXISTS "tv_insert" ON public.troupe_videos;
CREATE POLICY "tv_insert" ON public.troupe_videos FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.is_troupe_member(troupe_id));
DROP POLICY IF EXISTS "tv_delete" ON public.troupe_videos;
CREATE POLICY "tv_delete" ON public.troupe_videos FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_troupe_admin(troupe_id));

-- shared_recordings
DROP POLICY IF EXISTS "sr_select" ON public.shared_recordings;
CREATE POLICY "sr_select" ON public.shared_recordings FOR SELECT TO authenticated
  USING (public.is_troupe_member(troupe_id));
DROP POLICY IF EXISTS "sr_insert" ON public.shared_recordings;
CREATE POLICY "sr_insert" ON public.shared_recordings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_troupe_member(troupe_id));
DROP POLICY IF EXISTS "sr_delete" ON public.shared_recordings;
CREATE POLICY "sr_delete" ON public.shared_recordings FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_troupe_admin(troupe_id));

-- public_documents
DROP POLICY IF EXISTS "pd_select" ON public.public_documents;
CREATE POLICY "pd_select" ON public.public_documents FOR SELECT TO authenticated
  USING (is_approved OR uploaded_by = auth.uid() OR public.is_dev());
DROP POLICY IF EXISTS "pd_insert" ON public.public_documents;
CREATE POLICY "pd_insert" ON public.public_documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
DROP POLICY IF EXISTS "pd_update" ON public.public_documents;
CREATE POLICY "pd_update" ON public.public_documents FOR UPDATE TO authenticated
  USING (public.is_dev());
DROP POLICY IF EXISTS "pd_delete" ON public.public_documents;
CREATE POLICY "pd_delete" ON public.public_documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_dev());

-- director_notes
DROP POLICY IF EXISTS "dn_select" ON public.director_notes;
CREATE POLICY "dn_select" ON public.director_notes FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid()
         OR (troupe_id IS NOT NULL AND public.is_troupe_member(troupe_id)));
DROP POLICY IF EXISTS "dn_insert" ON public.director_notes;
CREATE POLICY "dn_insert" ON public.director_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()
              AND (troupe_id IS NULL OR public.is_troupe_member(troupe_id)));
DROP POLICY IF EXISTS "dn_delete" ON public.director_notes;
CREATE POLICY "dn_delete" ON public.director_notes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_dev()
         OR (troupe_id IS NOT NULL AND public.is_troupe_admin(troupe_id)));

-- global_videos
DROP POLICY IF EXISTS "gv_select" ON public.global_videos;
CREATE POLICY "gv_select" ON public.global_videos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "gv_insert" ON public.global_videos;
CREATE POLICY "gv_insert" ON public.global_videos FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
DROP POLICY IF EXISTS "gv_delete" ON public.global_videos;
CREATE POLICY "gv_delete" ON public.global_videos FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_dev());

-- user_tags / script_tags
DROP POLICY IF EXISTS "ut_all" ON public.user_tags;
CREATE POLICY "ut_all" ON public.user_tags FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "st_all" ON public.script_tags;
CREATE POLICY "st_all" ON public.script_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_tags t WHERE t.id = tag_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_tags t WHERE t.id = tag_id AND t.user_id = auth.uid()));

-- replica_groups / items
DROP POLICY IF EXISTS "rg_all" ON public.replica_groups;
CREATE POLICY "rg_all" ON public.replica_groups FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "rgi_all" ON public.replica_group_items;
CREATE POLICY "rgi_all" ON public.replica_group_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.replica_groups g WHERE g.id = group_id AND g.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.replica_groups g WHERE g.id = group_id AND g.user_id = auth.uid()));

-- Données strictement personnelles
DROP POLICY IF EXISTS "pn_all" ON public.personal_notes;
CREATE POLICY "pn_all" ON public.personal_notes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "vn_all" ON public.voice_notes;
CREATE POLICY "vn_all" ON public.voice_notes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "cr_all" ON public.character_recordings;
CREATE POLICY "cr_all" ON public.character_recordings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "pa_all" ON public.personal_audios;
CREATE POLICY "pa_all" ON public.personal_audios FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- active_sessions
DROP POLICY IF EXISTS "as_select" ON public.active_sessions;
CREATE POLICY "as_select" ON public.active_sessions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "as_write_own" ON public.active_sessions;
CREATE POLICY "as_write_own" ON public.active_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =====================================================================
-- STORAGE : buckets (publics car l'app utilise getPublicUrl) + limites de taille
-- Les limites évitent de ré-atteindre le quota de stockage gratuit.
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES
  ('scripts-pdfs',     'scripts-pdfs',     true, 10485760),
  ('director-notes',   'director-notes',   true, 10485760),
  ('public-documents', 'public-documents', true, 15728640),
  ('audio-recordings', 'audio-recordings', true, 15728640)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

-- Lecture (aussi nécessaire pour createSignedUrl)
DROP POLICY IF EXISTS "rc_storage_select" ON storage.objects;
CREATE POLICY "rc_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('scripts-pdfs', 'director-notes', 'public-documents', 'audio-recordings'));

-- scripts-pdfs : <uid>/... ou troupes/<troupe_id>/...
DROP POLICY IF EXISTS "rc_pdfs_insert" ON storage.objects;
CREATE POLICY "rc_pdfs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scripts-pdfs' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR ((storage.foldername(name))[1] = 'troupes'
        AND public.is_troupe_member(((storage.foldername(name))[2])::uuid))
  ));
DROP POLICY IF EXISTS "rc_pdfs_delete" ON storage.objects;
CREATE POLICY "rc_pdfs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'scripts-pdfs' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR ((storage.foldername(name))[1] = 'troupes'
        AND public.is_troupe_member(((storage.foldername(name))[2])::uuid))
  ));

-- director-notes : <uid>/...
DROP POLICY IF EXISTS "rc_notes_insert" ON storage.objects;
CREATE POLICY "rc_notes_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'director-notes' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "rc_notes_delete" ON storage.objects;
CREATE POLICY "rc_notes_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'director-notes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- public-documents : tout utilisateur connecté dépose ; suppression par le déposant ou un dev
DROP POLICY IF EXISTS "rc_pub_insert" ON storage.objects;
CREATE POLICY "rc_pub_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-documents');
DROP POLICY IF EXISTS "rc_pub_delete" ON storage.objects;
CREATE POLICY "rc_pub_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'public-documents' AND (owner_id = auth.uid()::text OR public.is_dev()));

-- audio-recordings : le chemin contient l'uid (voice-notes/<uid>/..., character-recordings/<uid>/...,
-- personal-audios/<uid>/..., shared-recordings/<troupe>/<uid>/...)
DROP POLICY IF EXISTS "rc_audio_insert" ON storage.objects;
CREATE POLICY "rc_audio_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio-recordings' AND auth.uid()::text = ANY (storage.foldername(name)));
DROP POLICY IF EXISTS "rc_audio_delete" ON storage.objects;
CREATE POLICY "rc_audio_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audio-recordings' AND auth.uid()::text = ANY (storage.foldername(name)));
