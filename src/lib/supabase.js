// Créer un script personnel à partir d'un document public déjà copié
// (la copie du fichier est faite par l'API serverless, ici on ne fait que créer l'entrée en base)
export const savePublicDocumentAsScript = async (publicDoc, userId) => {
  // publicDoc.file_path doit déjà pointer vers le fichier copié dans scripts-pdfs
  const scriptData = {
    user_id: userId,
    title: publicDoc.title,
    original_filename: publicDoc.file_name,
    pdf_url: publicDoc.file_path, // Chemin déjà copié par l'API
    full_text: "", // Optionnel, à remplir si besoin
    source_public_doc_id: publicDoc.id, // ID du document source pour traçabilité
  };
  // Récupérer le display_order max
  const { data: existingScripts } = await supabase
    .from("scripts")
    .select("display_order")
    .eq("user_id", userId)
    .order("display_order", { ascending: false })
    .limit(1);
  const nextOrder = (existingScripts?.[0]?.display_order || 0) + 1;
  scriptData.display_order = nextOrder;

  const { data, error } = await supabase
    .from("scripts")
    .insert([scriptData])
    .select()
    .single();
  if (error) throw error;
  return data;
};

// Vérifier si un utilisateur a déjà copié un document public
export const hasUserCopiedPublicDoc = async (publicDocId, userId) => {
  const { data, error } = await supabase
    .from("scripts")
    .select("id")
    .eq("user_id", userId)
    .eq("source_public_doc_id", publicDocId)
    .limit(1);
  if (error) {
    console.warn("Erreur vérification copie:", error);
    return false;
  }
  return data && data.length > 0;
};

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

// =====================================================
// AUTHENTIFICATION
// =====================================================

export const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};

// =====================================================
// UPLOAD DE FICHIERS (Scripts PDF)
// =====================================================

export const uploadPDF = async (file, userId) => {
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

// Alias pour compatibilitÃ© avec Upload.jsx
export const uploadFile = uploadPDF;

export const getFileUrl = (path) => {
  if (!path) return null;
  const { data } = supabase.storage.from("scripts-pdfs").getPublicUrl(path);

  return data.publicUrl;
};

export const deleteFile = async (path) => {
  const { error } = await supabase.storage.from("scripts-pdfs").remove([path]);

  if (error) throw error;
};

// =====================================================
// DIRECTOR NOTES (Consignes du metteur en scÃ¨ne)
// =====================================================

export const uploadDirectorNote = async (file, userId, troupeId = null) => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `${userId}/${timestamp}_${safeName}`;

  // Upload du fichier
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("director-notes")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Enregistrer les mÃ©tadonnÃ©es
  const { data, error } = await supabase
    .from("director_notes")
    .insert([
      {
        user_id: userId,
        troupe_id: troupeId,
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        file_type: file.type,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
};

export const fetchDirectorNotes = async (userId) => {
  console.log("fetchDirectorNotes appelé avec userId:", userId);

  // Récupérer les troupes de l'utilisateur
  const { data: memberships, error: membershipError } = await supabase
    .from("troupe_members")
    .select("troupe_id")
    .eq("user_id", userId);

  if (membershipError) {
    console.error("Erreur récupération troupes:", membershipError);
  }

  const troupeIds = memberships?.map((m) => m.troupe_id) || [];
  console.log("Troupes trouvées:", troupeIds);

  // Construire la requête
  let query = supabase
    .from("director_notes")
    .select("*")
    .order("created_at", { ascending: false });

  if (troupeIds.length > 0) {
    // Notes perso (user_id), notes des troupes, ou notes publiques (user_id IS NULL)
    query = query.or(
      `user_id.eq.${userId},troupe_id.in.(${troupeIds.join(
        ","
      )}),user_id.is.null`
    );
  } else {
    // Notes personnelles ou publiques
    query = query.or(`user_id.eq.${userId},user_id.is.null`);
  }

  const { data, error } = await query;
  console.log("Résultat requête director_notes:", { data, error });
  if (error) throw error;
  return data || [];
};

export const deleteDirectorNote = async (noteId, filePath) => {
  // Supprimer le fichier du storage
  if (filePath) {
    await supabase.storage.from("director-notes").remove([filePath]);
  }

  // Supprimer l'entrÃ©e de la base
  const { error } = await supabase
    .from("director_notes")
    .delete()
    .eq("id", noteId);

  if (error) throw error;
};

export const getDirectorNoteUrl = (path) => {
  if (!path) return null;
  const { data } = supabase.storage.from("director-notes").getPublicUrl(path);

  return data.publicUrl;
};

// =====================================================
// TROUPES
// =====================================================

// CrÃ©er une troupe
export const createTroupe = async (name, ownerId) => {
  const { data, error } = await supabase
    .from("troupes")
    .insert([{ name, owner_id: ownerId }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// RÃ©cupÃ©rer les troupes de l'utilisateur
export const fetchUserTroupes = async (userId) => {
  const { data, error } = await supabase
    .from("troupe_members")
    .select(
      `
      role,
      joined_at,
      troupes (
        id,
        name,
        code,
        owner_id,
        created_at
      )
    `
    )
    .eq("user_id", userId);

  if (error) throw error;
  return data?.map((item) => ({ ...item.troupes, role: item.role })) || [];
};

// Rejoindre une troupe par code
export const joinTroupe = async (code, userId) => {
  // Trouver la troupe par code
  const { data: troupe, error: findError } = await supabase
    .from("troupes")
    .select("id")
    .eq("code", code.toUpperCase())
    .single();

  if (findError) {
    if (findError.code === "PGRST116") {
      throw new Error("Code de troupe invalide");
    }
    throw findError;
  }

  // VÃ©rifier si dÃ©jÃ  membre
  const { data: existing } = await supabase
    .from("troupe_members")
    .select("id")
    .eq("troupe_id", troupe.id)
    .eq("user_id", userId)
    .single();

  if (existing) {
    throw new Error("Vous Ãªtes dÃ©jÃ  membre de cette troupe");
  }

  // Rejoindre
  const { data, error } = await supabase
    .from("troupe_members")
    .insert([{ troupe_id: troupe.id, user_id: userId, role: "member" }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Quitter une troupe
export const leaveTroupe = async (troupeId, userId) => {
  const { error } = await supabase
    .from("troupe_members")
    .delete()
    .eq("troupe_id", troupeId)
    .eq("user_id", userId);

  if (error) throw error;
};

// Supprimer une troupe (owner uniquement)
export const deleteTroupe = async (troupeId) => {
  // La suppression cascade supprimera aussi les membres (ON DELETE CASCADE)
  const { error } = await supabase.from("troupes").delete().eq("id", troupeId);

  if (error) throw error;
};

// RÃ©cupÃ©rer les membres d'une troupe
export const fetchTroupeMembers = async (troupeId) => {
  const { data, error } = await supabase
    .from("troupe_members")
    .select(
      `
      user_id,
      role,
      joined_at
    `
    )
    .eq("troupe_id", troupeId);

  if (error) throw error;
  return data;
};

// =====================================================
// PARTAGE DE SCRIPTS
// =====================================================

// Partager un script avec une troupe
export const shareScript = async (scriptId, troupeId, userId) => {
  const { data, error } = await supabase
    .from("shared_scripts")
    .insert([
      {
        script_id: scriptId,
        troupe_id: troupeId,
        shared_by: userId,
      },
    ])
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ce texte est dÃ©jÃ  partagÃ© avec cette troupe");
    }
    throw error;
  }
  return data;
};

// Retirer le partage d'un script
export const unshareScript = async (scriptId, troupeId) => {
  const { error } = await supabase
    .from("shared_scripts")
    .delete()
    .eq("script_id", scriptId)
    .eq("troupe_id", troupeId);

  if (error) throw error;
};

// RÃ©cupÃ©rer les scripts partagÃ©s avec l'utilisateur
export const fetchSharedScripts = async (userId) => {
  // D'abord, rÃ©cupÃ©rer les troupes de l'utilisateur
  const { data: memberships, error: memberError } = await supabase
    .from("troupe_members")
    .select("troupe_id")
    .eq("user_id", userId);

  if (memberError) throw memberError;

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const troupeIds = memberships.map((m) => m.troupe_id);

  // RÃ©cupÃ©rer les scripts partagÃ©s avec ces troupes
  const { data, error } = await supabase
    .from("shared_scripts")
    .select(
      `
      id,
      shared_at,
      shared_by,
      troupe_id,
      scripts (
        id,
        title,
        user_id,
        characters (*),
        replicas (*)
      ),
      troupes (
        name
      )
    `
    )
    .in("troupe_id", troupeIds);

  if (error) throw error;

  // Filtrer les scripts qui ne sont pas de l'utilisateur (pas ses propres scripts partagÃ©s)
  return data?.filter((item) => item.scripts?.user_id !== userId) || [];
};

// =====================================================
// DOCUMENTS PUBLICS
// =====================================================

// Uploader un document public
export const uploadPublicDocument = async (file, metadata, userId) => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `${timestamp}_${safeName}`;

  // Upload du fichier
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("public-documents")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Déterminer le type de fichier
  let fileType = "other";
  if (file.type === "application/pdf") fileType = "pdf";
  else if (file.type.startsWith("image/")) fileType = "image";
  else if (file.type === "text/plain") fileType = "txt";
  else if (file.type.startsWith("audio/")) fileType = "audio";

  // Enregistrer les métadonnées
  const { data, error } = await supabase
    .from("public_documents")
    .insert([
      {
        title: metadata.title || file.name,
        description: metadata.description || "",
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        file_type: fileType,
        category: metadata.category || "script",
        uploaded_by: userId,
        is_approved: true,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
};

// RÃ©cupÃ©rer les documents publics approuvÃ©s
export const fetchPublicDocuments = async (category = null) => {
  let query = supabase
    .from("public_documents")
    .select("*")
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .abortSignal(undefined); // Pour compatibilité

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

// RÃ©cupÃ©rer l'URL d'un document public
export const getPublicDocumentUrl = (path) => {
  if (!path) return null;
  const { data } = supabase.storage.from("public-documents").getPublicUrl(path);

  return data.publicUrl;
};

// Supprimer un document public (seulement par son propriÃ©taire)
export const deletePublicDocument = async (documentId, filePath) => {
  // Supprimer le fichier du storage
  if (filePath) {
    const { error: storageError } = await supabase.storage
      .from("public-documents")
      .remove([filePath]);

    if (storageError) {
      console.error("Erreur suppression storage:", storageError);
    }
  }

  // Supprimer l'entrÃ©e dans la table
  const { error } = await supabase
    .from("public_documents")
    .delete()
    .eq("id", documentId);

  if (error) throw error;
};

// IncrÃ©menter le compteur de tÃ©lÃ©chargement
export const incrementDownloadCount = async (documentId) => {
  const { error } = await supabase.rpc("increment_download_count", {
    doc_id: documentId,
  });

  // Ignorer l'erreur si la fonction RPC n'existe pas
  if (error && !error.message.includes("function")) {
    throw error;
  }
};

// =====================================================
// SYSTÃˆME DE TAGS
// =====================================================

// RÃ©cupÃ©rer tous les tags de l'utilisateur
export const fetchUserTags = async (userId) => {
  const { data, error } = await supabase
    .from("user_tags")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    console.error("Error fetching tags:", error);
    return [];
  }
  return data || [];
};

// CrÃ©er un nouveau tag
export const createTag = async (userId, name, color = "#6B7280") => {
  const { data, error } = await supabase
    .from("user_tags")
    .insert([{ user_id: userId, name, color }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Supprimer un tag
export const deleteTag = async (tagId) => {
  const { error } = await supabase.from("user_tags").delete().eq("id", tagId);

  if (error) throw error;
};

// Modifier un tag
export const updateTag = async (tagId, updates) => {
  const { data, error } = await supabase
    .from("user_tags")
    .update(updates)
    .eq("id", tagId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// RÃ©cupÃ©rer les tags d'un script
export const fetchScriptTags = async (scriptId) => {
  const { data, error } = await supabase
    .from("script_tags")
    .select(
      `
      id,
      tag_id,
      user_tags (
        id,
        name,
        color
      )
    `
    )
    .eq("script_id", scriptId);

  if (error) {
    console.error("Error fetching script tags:", error);
    return [];
  }
  return data?.map((st) => st.user_tags) || [];
};

// Ajouter un tag Ã  un script
export const addTagToScript = async (scriptId, tagId) => {
  const { data, error } = await supabase
    .from("script_tags")
    .insert([{ script_id: scriptId, tag_id: tagId }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Retirer un tag d'un script
export const removeTagFromScript = async (scriptId, tagId) => {
  const { error } = await supabase
    .from("script_tags")
    .delete()
    .eq("script_id", scriptId)
    .eq("tag_id", tagId);

  if (error) throw error;
};

// RÃ©cupÃ©rer tous les scripts avec leurs tags
export const fetchScriptsWithTags = async (userId) => {
  const { data: scripts, error: scriptsError } = await supabase
    .from("scripts")
    .select(
      `
      *,
      characters (*),
      script_tags (
        user_tags (
          id,
          name,
          color
        )
      )
    `
    )
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  if (scriptsError) {
    console.error("Error fetching scripts with tags:", scriptsError);
    return [];
  }

  // Transformer les donnÃ©es pour avoir les tags directement
  return (
    scripts?.map((script) => ({
      ...script,
      tags: script.script_tags?.map((st) => st.user_tags).filter(Boolean) || [],
    })) || []
  );
};

// =====================================================
// COPIE DE SCRIPTS PARTAGÃ‰S
// =====================================================

// CrÃ©er une copie personnelle d'un script partagÃ©
export const copySharedScript = async (originalScriptId, troupeId, userId) => {
  console.log("🔄 Début copie script:", { originalScriptId, troupeId, userId });

  // 1. RÃ©cupÃ©rer le script original avec ses personnages et rÃ©pliques
  const { data: original, error: fetchError } = await supabase
    .from("scripts")
    .select(
      `
      *,
      characters (*),
      replicas (*)
    `
    )
    .eq("id", originalScriptId)
    .single();

  if (fetchError) {
    console.error("❌ Erreur fetch script original:", fetchError);
    throw fetchError;
  }
  console.log("✅ Script original récupéré:", original.title);

  // 2. Créer la copie du script (uniquement les colonnes qui existent vraiment)
  const scriptData = {
    user_id: userId,
    title: `${original.title} (copie)`,
  };

  // Ajouter les colonnes optionnelles si elles existent dans l'original
  if (original.full_text) scriptData.full_text = original.full_text;
  if (original.original_filename)
    scriptData.original_filename = original.original_filename;
  if (original.pdf_url) scriptData.pdf_url = original.pdf_url;

  console.log("📝 Données script à insérer:", scriptData);

  const { data: newScript, error: scriptError } = await supabase
    .from("scripts")
    .insert([scriptData])
    .select()
    .single();

  if (scriptError) {
    console.error("❌ Erreur création script:", scriptError);
    throw scriptError;
  }
  console.log("✅ Nouveau script créé:", newScript.id);

  // 3. Copier les personnages et crÃ©er un mapping ancien_id -> nouveau_id
  const characterMap = {};
  console.log(`📋 Copie de ${original.characters?.length || 0} personnages...`);
  for (const char of original.characters || []) {
    const charData = {
      script_id: newScript.id,
      name: char.name,
      color: char.color,
    };

    const { data: newChar, error: charError } = await supabase
      .from("characters")
      .insert([charData])
      .select()
      .single();

    if (charError) {
      console.error("❌ Erreur création personnage:", charError);
      throw charError;
    }
    characterMap[char.id] = newChar.id;
  }
  console.log("✅ Personnages copiés");

  // 4. Copier les rÃ©pliques avec les nouveaux character_id
  const replicasToInsert = (original.replicas || []).map((rep) => ({
    script_id: newScript.id,
    character_id: characterMap[rep.character_id],
    order_index: rep.order_index,
    text: rep.text,
    text_gaps: rep.text_gaps,
    cue_words: rep.cue_words,
  }));

  console.log(`📋 Copie de ${replicasToInsert.length} répliques...`);
  if (replicasToInsert.length > 0) {
    const { error: repError } = await supabase
      .from("replicas")
      .insert(replicasToInsert);

    if (repError) {
      console.error("❌ Erreur création répliques:", repError);
      throw repError;
    }
  }
  console.log("✅ Répliques copiées");
  console.log("🎉 Copie terminée avec succès!");

  return newScript;
};

// =====================================================
// RÃ”LES TROUPE (admin/member)
// =====================================================

// VÃ©rifier si l'utilisateur est admin d'une troupe
export const isUserTroupeAdmin = async (troupeId, userId) => {
  const { data, error } = await supabase
    .from("troupe_members")
    .select("role")
    .eq("troupe_id", troupeId)
    .eq("user_id", userId)
    .single();

  if (error) return false;
  return data?.role === "admin";
};

// Promouvoir/rÃ©trograder un membre
export const updateMemberRole = async (troupeId, userId, newRole) => {
  const { error } = await supabase
    .from("troupe_members")
    .update({ role: newRole })
    .eq("troupe_id", troupeId)
    .eq("user_id", userId);

  if (error) throw error;
};

// =====================================================
// CONSIGNES TROUPE (documents partagÃ©s)
// =====================================================

// Upload un document de consignes
export const uploadTroupeDocument = async (file, troupeId, userId, title) => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `troupes/${troupeId}/${timestamp}_${safeName}`;

  // Upload fichier
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("scripts-pdfs")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });

  if (uploadError) throw uploadError;

  // CrÃ©er l'entrÃ©e en base
  const { data, error } = await supabase
    .from("troupe_documents")
    .insert([
      {
        troupe_id: troupeId,
        uploaded_by: userId,
        title: title || file.name,
        file_path: uploadData.path,
        file_type: file.type,
        file_size: file.size,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// RÃ©cupÃ©rer les documents d'une troupe
export const fetchTroupeDocuments = async (troupeId) => {
  const { data, error } = await supabase
    .from("troupe_documents")
    .select("*")
    .eq("troupe_id", troupeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

// Supprimer un document
export const deleteTroupeDocument = async (documentId, filePath) => {
  // Supprimer le fichier
  await supabase.storage.from("scripts-pdfs").remove([filePath]);

  // Supprimer l'entrÃ©e
  const { error } = await supabase
    .from("troupe_documents")
    .delete()
    .eq("id", documentId);

  if (error) throw error;
};

// =====================================================
// SOUS-ENSEMBLES DE RÃ‰PLIQUES
// =====================================================

// CrÃ©er un groupe de rÃ©pliques
export const createReplicaGroup = async (
  scriptId,
  userId,
  name,
  color,
  tagId = null
) => {
  const { data, error } = await supabase
    .from("replica_groups")
    .insert([
      {
        script_id: scriptId,
        user_id: userId,
        name,
        color,
        tag_id: tagId,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// RÃ©cupÃ©rer les groupes d'un script pour un utilisateur
export const fetchReplicaGroups = async (scriptId, userId) => {
  const { data, error } = await supabase
    .from("replica_groups")
    .select(
      `
      *,
      user_tags (id, name, color),
      replica_group_items (
        replica_id,
        order_index
      )
    `
    )
    .eq("script_id", scriptId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Ajouter des rÃ©pliques Ã  un groupe
export const addReplicasToGroup = async (groupId, replicaIds) => {
  const items = replicaIds.map((replicaId, index) => ({
    group_id: groupId,
    replica_id: replicaId,
    order_index: index,
  }));

  const { error } = await supabase
    .from("replica_group_items")
    .upsert(items, { onConflict: "group_id,replica_id" });

  if (error) throw error;
};

// Retirer une rÃ©plique d'un groupe
export const removeReplicaFromGroup = async (groupId, replicaId) => {
  const { error } = await supabase
    .from("replica_group_items")
    .delete()
    .eq("group_id", groupId)
    .eq("replica_id", replicaId);

  if (error) throw error;
};

// Supprimer un groupe
export const deleteReplicaGroup = async (groupId) => {
  const { error } = await supabase
    .from("replica_groups")
    .delete()
    .eq("id", groupId);

  if (error) throw error;
};

// Mettre Ã  jour un groupe
export const updateReplicaGroup = async (groupId, updates) => {
  const { data, error } = await supabase
    .from("replica_groups")
    .update(updates)
    .eq("id", groupId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// =====================================================
// MONITORING (Sessions actives)
// =====================================================

// Mettre à jour la session de l'utilisateur
let sessionUpdateDisabled = false; // Flag pour éviter les boucles

export const updateUserSession = async (userId, page = null) => {
  // Si déjà désactivé suite à une erreur 404, ne pas réessayer
  if (sessionUpdateDisabled) return;

  const { error } = await supabase.from("active_sessions").upsert(
    {
      user_id: userId,
      last_seen: new Date().toISOString(),
      page,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    // Si table inexistante (404/PGRST205), désactiver les futures tentatives
    if (
      error.code === "PGRST205" ||
      error.message?.includes("active_sessions")
    ) {
      sessionUpdateDisabled = true;
      console.warn("Table active_sessions non trouvée - monitoring désactivé");
    } else {
      console.error("Session update error:", error);
    }
  }
};

// RÃ©cupÃ©rer le nombre d'utilisateurs actifs
export const getActiveUsersCount = async () => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("active_sessions")
    .select("*", { count: "exact", head: true })
    .gte("last_seen", fiveMinutesAgo);

  if (error) {
    console.error("Error getting active users:", error);
    return 0;
  }
  return count || 0;
};

// =====================================================
// RÃ”LES UTILISATEURS (dev, director, member)
// =====================================================

// Récupérer le rôle d'un utilisateur
let userRolesDisabled = false;

export const getUserRole = async (userId) => {
  // Si table inexistante, retourner directement member
  if (userRolesDisabled) return "member";

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle(); // <-- maybeSingle au lieu de single

  if (error) {
    // Si table inexistante (406/PGRST), désactiver
    if (
      error.code === "406" ||
      error.code === "PGRST116" ||
      error.message?.includes("user_roles")
    ) {
      userRolesDisabled = true;
      console.warn("Table user_roles non trouvée - rôles désactivés");
    }
    return "member";
  }
  return data?.role || "member";
};

// Mettre Ã  jour le rÃ´le d'un utilisateur (dev only)
export const setUserRole = async (userId, role) => {
  const { data, error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// RÃ©cupÃ©rer tous les utilisateurs avec leurs rÃ´les (admin panel)
export const getAllUsersWithRoles = async () => {
  // D'abord rÃ©cupÃ©rer les rÃ´les
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("*");

  if (rolesError) throw rolesError;
  return roles || [];
};

// VÃ©rifier si l'utilisateur est dev
export const isUserDev = async (userId) => {
  const role = await getUserRole(userId);
  return role === "dev";
};

// VÃ©rifier si l'utilisateur est metteur en scÃ¨ne ou dev
export const isUserDirectorOrDev = async (userId) => {
  const role = await getUserRole(userId);
  return role === "dev" || role === "director";
};

// =====================================================
// NOTES VOCALES PERSONNELLES
// =====================================================

// Upload une note vocale
export const uploadVoiceNote = async (
  audioBlob,
  scriptId,
  userId,
  afterReplicaId = null
) => {
  const timestamp = Date.now();
  const fileName = `voice-notes/${userId}/${scriptId}/${timestamp}.webm`;

  // Upload du fichier audio
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("audio-recordings")
    .upload(fileName, audioBlob, {
      cacheControl: "3600",
      contentType: "audio/webm",
    });

  if (uploadError) throw uploadError;

  // CrÃ©er l'entrÃ©e en base
  const { data, error } = await supabase
    .from("voice_notes")
    .insert([
      {
        script_id: scriptId,
        user_id: userId,
        after_replica_id: afterReplicaId,
        audio_path: uploadData.path,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// RÃ©cupÃ©rer les notes vocales d'un script
export const fetchVoiceNotes = async (scriptId, userId) => {
  const { data, error } = await supabase
    .from("voice_notes")
    .select("*")
    .eq("script_id", scriptId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Supprimer une note vocale
export const deleteVoiceNote = async (noteId, audioPath) => {
  // Supprimer le fichier
  await supabase.storage.from("audio-recordings").remove([audioPath]);

  // Supprimer l'entrÃ©e
  const { error } = await supabase
    .from("voice_notes")
    .delete()
    .eq("id", noteId);

  if (error) throw error;
};

// URL d'une note vocale
export const getVoiceNoteUrl = (audioPath) => {
  const { data } = supabase.storage
    .from("audio-recordings")
    .getPublicUrl(audioPath);
  return data.publicUrl;
};

// =====================================================
// ENREGISTREMENTS AUDIO PAR PERSONNAGE
// =====================================================

// Upload un enregistrement pour un personnage
export const uploadCharacterRecording = async (
  audioBlob,
  characterId,
  userId
) => {
  const timestamp = Date.now();
  const fileName = `character-recordings/${userId}/${characterId}/${timestamp}.webm`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("audio-recordings")
    .upload(fileName, audioBlob, {
      cacheControl: "3600",
      contentType: "audio/webm",
    });

  if (uploadError) throw uploadError;

  // Supprimer l'ancien enregistrement s'il existe
  const { data: existing } = await supabase
    .from("character_recordings")
    .select("audio_path")
    .eq("character_id", characterId)
    .eq("user_id", userId)
    .single();

  if (existing?.audio_path) {
    await supabase.storage
      .from("audio-recordings")
      .remove([existing.audio_path]);
  }

  // Upsert l'entrÃ©e
  const { data, error } = await supabase
    .from("character_recordings")
    .upsert(
      {
        character_id: characterId,
        user_id: userId,
        audio_path: uploadData.path,
      },
      { onConflict: "character_id,user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
};

// RÃ©cupÃ©rer les enregistrements de personnages pour un script
export const fetchCharacterRecordings = async (characterIds, userId) => {
  const { data, error } = await supabase
    .from("character_recordings")
    .select("*")
    .in("character_id", characterIds)
    .eq("user_id", userId);

  if (error) throw error;
  return data || [];
};

// Supprimer un enregistrement de personnage
export const deleteCharacterRecording = async (characterId, userId) => {
  const { data: existing } = await supabase
    .from("character_recordings")
    .select("audio_path")
    .eq("character_id", characterId)
    .eq("user_id", userId)
    .single();

  if (existing?.audio_path) {
    await supabase.storage
      .from("audio-recordings")
      .remove([existing.audio_path]);
  }

  const { error } = await supabase
    .from("character_recordings")
    .delete()
    .eq("character_id", characterId)
    .eq("user_id", userId);

  if (error) throw error;
};

// =====================================================
// VIDÃ‰OS YOUTUBE (Troupe)
// =====================================================

// Ajouter une vidÃ©o YouTube Ã  une troupe
export const addTroupeVideo = async (
  troupeId,
  userId,
  title,
  youtubeUrl,
  description = ""
) => {
  const { data, error } = await supabase
    .from("troupe_videos")
    .insert([
      {
        troupe_id: troupeId,
        uploaded_by: userId,
        title,
        youtube_url: youtubeUrl,
        description,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// RÃ©cupÃ©rer les vidÃ©os d'une troupe
export const fetchTroupeVideos = async (troupeId) => {
  const { data, error } = await supabase
    .from("troupe_videos")
    .select("*")
    .eq("troupe_id", troupeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

// Supprimer une vidÃ©o
export const deleteTroupeVideo = async (videoId) => {
  const { error } = await supabase
    .from("troupe_videos")
    .delete()
    .eq("id", videoId);

  if (error) throw error;
};

// Extraire l'ID YouTube d'une URL
export const extractYoutubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};
// =====================================================
// ENREGISTREMENTS AUDIO PARTAGÉS (Troupe)
// À AJOUTER À LA FIN DE supabase.js
// =====================================================

// Upload un enregistrement partagé vers une troupe
export const uploadSharedRecording = async (
  audioBlob,
  name,
  troupeId,
  userId,
  duration
) => {
  const timestamp = Date.now();
  const fileName = `shared-recordings/${troupeId}/${userId}/${timestamp}.webm`;

  // Upload du fichier audio
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("audio-recordings")
    .upload(fileName, audioBlob, {
      cacheControl: "3600",
      contentType: "audio/webm",
    });

  if (uploadError) throw uploadError;

  // Créer l'entrée en base
  const { data, error } = await supabase
    .from("shared_recordings")
    .insert([
      {
        troupe_id: troupeId,
        user_id: userId,
        name: name,
        audio_path: uploadData.path,
        duration: duration,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Récupérer les enregistrements partagés des troupes
export const fetchSharedRecordings = async (troupeIds) => {
  if (!troupeIds || troupeIds.length === 0) return [];

  const { data, error } = await supabase
    .from("shared_recordings")
    .select(
      `
      *,
      troupes (name)
    `
    )
    .in("troupe_id", troupeIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Ajouter l'URL audio et le nom de troupe
  return (data || []).map((rec) => ({
    ...rec,
    troupe_name: rec.troupes?.name,
    audio_url: getSharedRecordingUrl(rec.audio_path),
  }));
};

// URL d'un enregistrement partagé
export const getSharedRecordingUrl = (audioPath) => {
  const { data } = supabase.storage
    .from("audio-recordings")
    .getPublicUrl(audioPath);
  return data.publicUrl;
};

// Supprimer un enregistrement partagé
export const deleteSharedRecording = async (recordingId, audioPath) => {
  // Supprimer le fichier
  await supabase.storage.from("audio-recordings").remove([audioPath]);

  // Supprimer l'entrée
  const { error } = await supabase
    .from("shared_recordings")
    .delete()
    .eq("id", recordingId);

  if (error) throw error;
};

// =====================================================
// VIDÉOS GLOBALES (sans troupe)
// =====================================================

export const addGlobalVideo = async (
  userId,
  title,
  youtubeUrl,
  description = ""
) => {
  const { data, error } = await supabase
    .from("global_videos")
    .insert([
      {
        uploaded_by: userId,
        title,
        youtube_url: youtubeUrl,
        description,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const fetchGlobalVideos = async () => {
  const { data, error } = await supabase
    .from("global_videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const deleteGlobalVideo = async (videoId) => {
  const { error } = await supabase
    .from("global_videos")
    .delete()
    .eq("id", videoId);

  if (error) throw error;
};

// =====================================================
// AUDIOS PERSONNELS (importés par l'utilisateur)
// =====================================================

// Upload un fichier audio personnel
export const uploadPersonalAudio = async (file, userId) => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `personal-audios/${userId}/${timestamp}_${safeName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("audio-recordings")
    .upload(fileName, file, {
      cacheControl: "3600",
      contentType: file.type || "audio/mpeg",
    });

  if (uploadError) throw uploadError;

  // Récupérer le display_order max
  const { data: existingAudios } = await supabase
    .from("personal_audios")
    .select("display_order")
    .eq("user_id", userId)
    .order("display_order", { ascending: false })
    .limit(1);
  const nextOrder = (existingAudios?.[0]?.display_order || 0) + 1;

  // Créer l'entrée en base
  const { data, error } = await supabase
    .from("personal_audios")
    .insert([
      {
        user_id: userId,
        name: file.name,
        audio_path: uploadData.path,
        display_order: nextOrder,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Récupérer les audios personnels d'un utilisateur
export const fetchPersonalAudios = async (userId) => {
  const { data, error } = await supabase
    .from("personal_audios")
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Supprimer un audio personnel
export const deletePersonalAudio = async (audioId, audioPath) => {
  // Supprimer le fichier du storage
  await supabase.storage.from("audio-recordings").remove([audioPath]);

  // Supprimer l'entrée en base
  const { error } = await supabase
    .from("personal_audios")
    .delete()
    .eq("id", audioId);

  if (error) throw error;
};

// URL d'un audio personnel
export const getPersonalAudioUrl = (audioPath) => {
  const { data } = supabase.storage
    .from("audio-recordings")
    .getPublicUrl(audioPath);
  return data.publicUrl;
};

// Mettre à jour l'ordre des audios personnels
export const updatePersonalAudioOrder = async (updates) => {
  // updates = [{ id: 'uuid', display_order: 1 }, ...]
  for (const update of updates) {
    const { error } = await supabase
      .from("personal_audios")
      .update({ display_order: update.display_order })
      .eq("id", update.id);
    if (error) throw error;
  }
};

// Sauvegarder un audio public comme script (dans Mes textes)
export const savePublicAudioAsScript = async (publicDoc, userId) => {
  // Récupérer le display_order max des scripts
  const { data: existingScripts } = await supabase
    .from("scripts")
    .select("display_order")
    .eq("user_id", userId)
    .order("display_order", { ascending: false })
    .limit(1);
  const nextOrder = (existingScripts?.[0]?.display_order || 0) + 1;

  // Créer le script avec le chemin audio public
  // Note: on utilise pdf_url pour stocker le chemin audio avec préfixe "audio:"
  const { data, error } = await supabase
    .from("scripts")
    .insert([
      {
        user_id: userId,
        title: publicDoc.title || publicDoc.file_name,
        original_filename: publicDoc.file_name,
        pdf_url: `audio:public:${publicDoc.file_path}`, // Audio public stocké dans pdf_url avec préfixe
        full_text: "",
        display_order: nextOrder,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Copier un audio public vers les audios personnels
export const copyPublicAudioToPersonal = async (publicDoc, userId) => {
  // Récupérer le display_order max
  const { data: existingAudios } = await supabase
    .from("personal_audios")
    .select("display_order")
    .eq("user_id", userId)
    .order("display_order", { ascending: false })
    .limit(1);
  const nextOrder = (existingAudios?.[0]?.display_order || 0) + 1;

  // Créer l'entrée en base avec le chemin du fichier public
  // Note: on utilise le même fichier, pas de copie physique nécessaire
  const { data, error } = await supabase
    .from("personal_audios")
    .insert([
      {
        user_id: userId,
        name: publicDoc.title || publicDoc.file_name,
        audio_path: `public:${publicDoc.file_path}`, // Préfixe pour indiquer que c'est un fichier public
        display_order: nextOrder,
        source_public_doc_id: publicDoc.id,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Vérifier si un utilisateur a déjà copié un audio public
export const hasUserCopiedPublicAudio = async (publicDocId, userId) => {
  const { data, error } = await supabase
    .from("personal_audios")
    .select("id")
    .eq("user_id", userId)
    .eq("source_public_doc_id", publicDocId)
    .limit(1);
  if (error) {
    console.warn("Erreur vérification copie audio:", error);
    return false;
  }
  return data && data.length > 0;
};

// URL d'un audio (personnel ou public)
export const getAudioUrl = (audioPath) => {
  if (!audioPath) return null;

  // Si c'est un audio provenant de la bibliothèque publique
  if (audioPath.startsWith("public:")) {
    const publicPath = audioPath.replace("public:", "");
    const { data } = supabase.storage
      .from("public-documents")
      .getPublicUrl(publicPath);
    return data.publicUrl;
  }

  // Sinon c'est un audio personnel
  const { data } = supabase.storage
    .from("audio-recordings")
    .getPublicUrl(audioPath);
  return data.publicUrl;
};
