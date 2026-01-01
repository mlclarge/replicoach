import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Please create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Helper pour recuperer l'utilisateur courant
export const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};

// Helper pour l'upload de fichiers (PDF ou TXT)
export const uploadFile = async (file, userId) => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `${userId}/${timestamp}_${safeName}`;

  const { data, error } = await supabase.storage
    .from("scripts-pdfs")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  return data.path;
};

// Alias pour compatibilite (ancien nom)
export const uploadPDF = uploadFile;

// Helper pour obtenir l'URL publique d'un fichier
export const getFileUrl = (path) => {
  if (!path) return null;

  const { data } = supabase.storage.from("scripts-pdfs").getPublicUrl(path);

  return data.publicUrl;
};

// Helper pour supprimer un fichier
export const deleteFile = async (path) => {
  const { error } = await supabase.storage.from("scripts-pdfs").remove([path]);

  if (error) throw error;
};

// =====================================================
// FONCTIONS DIRECTOR NOTES (Consignes metteur en scene)
// =====================================================

// Upload une note du metteur en scene
export const uploadDirectorNote = async (file, userId) => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `${userId}/${timestamp}_${safeName}`;

  // Upload du fichier dans le bucket director-notes
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("director-notes")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Obtenir l'URL publique
  const { data: urlData } = supabase.storage
    .from("director-notes")
    .getPublicUrl(uploadData.path);

  // Sauvegarder les metadonnees dans la table
  const { data: noteData, error: noteError } = await supabase
    .from("director_notes")
    .insert([
      {
        user_id: userId,
        file_name: file.name,
        file_path: uploadData.path,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
      },
    ])
    .select()
    .single();

  if (noteError) throw noteError;

  return noteData;
};

// Recuperer toutes les notes du metteur en scene pour un utilisateur
export const fetchDirectorNotes = async (userId) => {
  const { data, error } = await supabase
    .from("director_notes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
};

// Supprimer une note du metteur en scene
export const deleteDirectorNote = async (noteId, filePath) => {
  // Supprimer le fichier du storage
  if (filePath) {
    const { error: storageError } = await supabase.storage
      .from("director-notes")
      .remove([filePath]);

    if (storageError) {
      console.error("Erreur suppression fichier:", storageError);
    }
  }

  // Supprimer l'entree de la table
  const { error: dbError } = await supabase
    .from("director_notes")
    .delete()
    .eq("id", noteId);

  if (dbError) throw dbError;
};

// Obtenir l'URL d'une note du metteur en scene
export const getDirectorNoteUrl = (path) => {
  if (!path) return null;

  const { data } = supabase.storage.from("director-notes").getPublicUrl(path);

  return data.publicUrl;
};
