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

// Helper pour récupérer l'utilisateur courant
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

// Alias pour compatibilité (ancien nom)
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
