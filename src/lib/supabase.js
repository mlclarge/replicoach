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

// Alias pour compatibilité avec Upload.jsx
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
// DIRECTOR NOTES (Consignes du metteur en scène)
// =====================================================

export const uploadDirectorNote = async (file, userId, troupeId = null) => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `${userId}/${timestamp}_${safeName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("director-notes")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

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

  const { data: memberships, error: membershipError } = await supabase
    .from("troupe_members")
    .select("troupe_id")
    .eq("user_id", userId);

  if (membershipError) {
    console.error("Erreur récupération troupes:", membershipError);
  }

  const troupeIds = memberships?.map((m) => m.troupe_id) || [];
  console.log("Troupes trouvées:", troupeIds);

  let query = supabase
    .from("director_notes")
    .select("*")
    .order("created_at", { ascending: false });

  if (troupeIds.length > 0) {
    query = query.or(
      `user_id.eq.${userId},troupe_id.in.(${troupeIds.join(",")}),user_id.is.null`
    );
  } else {
    query = query.or(`user_id.eq.${userId},user_id.is.null`);
  }

  const { data, error } = await query;
  console.log("Résultat requête director_notes:", { data, error });
  if (error) throw error;
  return data || [];
};

export const deleteDirectorNote = async (noteId, filePath) => {
  if (filePath) {
    await supabase.storage.from("director-notes").remove([filePath]);
  }

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

// Créer une troupe (avec inscription automatique de l'admin)
export const createTroupe = async (name, ownerId) => {
  const { data, error } = await supabase
    .from("troupes")
    .insert([{ name, owner_id: ownerId }])
    .select()
    .single();

  if (error) throw error;

  // Inscription automatique du créateur dans troupe_members en tant qu'admin
  try {
    await supabase.from("troupe_members").insert([
      { troupe_id: data.id, user_id: ownerId, role: "admin" }
    ]);
  } catch (mErr) {
    console.warn("Membre admin déjà présent ou géré par trigger DB:", mErr);
  }

  return data;
};

export const fetchUserTroupes = async (userId) => {
  const { data, error } = await supabase
    .from("troupe_members")
    .select(`
      role,
      joined_at,
      troupes (
        id,
        name,
        code,
        owner_id,
        created_at
      )
    `)
    .eq("user_id", userId);

  if (error) throw error;
  return data?.map((item) => ({ ...item.troupes, role: item.role })) || [];
};

export const joinTroupe = async (code, userId) => {
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

  const { data: existing } = await supabase
    .from("troupe_members")
    .select("id")
    .eq("troupe_id", troupe.id)
    .eq("user_id", userId)
    .single();

  if (existing) {
    throw new Error("Vous êtes déjà membre de cette troupe");
  }

  const { data, error } = await supabase
    .from("troupe_members")
    .insert([{ troupe_id: troupe.id, user_id: userId, role: "member" }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const leaveTroupe = async (troupeId, userId) => {
  const { error } = await supabase
    .from("troupe_members")
    .delete()
    .eq("troupe_id", troupeId)
    .eq("user_id", userId);

  if (error) throw error;
};

export const deleteTroupe = async (troupeId) => {
  const { error } = await supabase.from("troupes").delete().eq("id", troupeId);
  if (error) throw error;
};

export const fetchTroupeMembers = async (troupeId) => {
  const { data, error } = await supabase
    .from("troupe_members")
    .select("user_id, role, joined_at")
    .eq("troupe_id", troupeId);

  if (error) throw error;
  return data;
};

// =====================================================
// PARTAGE DE SCRIPTS
// =====================================================

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
      throw new Error("Ce texte est déjà partagé avec cette troupe");
    }
    throw error;
  }
  return data;
};

export const unshareScript = async (scriptId, troupeId) => {
  const { error } = await supabase
    .from("shared_scripts")
    .delete()
    .eq("script_id", scriptId)
    .eq("troupe_id", troupeId);

  if (error) throw error;
};

// Récupérer les scripts partagés avec l'utilisateur (Version découplée anti-PGRST201)
export const fetchSharedScripts = async (userId) => {
  if (!userId) return [];

  try {
    // 1. Récupérer les troupes dont l'utilisateur est membre
    const { data: memberTroupes, error: troupeErr } = await supabase
      .from("troupe_members")
      .select("troupe_id")
      .eq("user_id", userId);

    if (troupeErr) throw troupeErr;

    const troupeIds = (memberTroupes || []).map((m) => m.troupe_id).filter(Boolean);
    if (troupeIds.length === 0) return [];

    // 2. Récupérer la liste des partages pour ces troupes
    const { data: sharedList, error: sharedErr } = await supabase
      .from("shared_scripts")
      .select("id, script_id, troupe_id, shared_by, shared_at")
      .in("troupe_id", troupeIds);

    if (sharedErr) throw sharedErr;
    if (!sharedList || sharedList.length === 0) return [];

    const scriptIds = [...new Set(sharedList.map((s) => s.script_id).filter(Boolean))];
    if (scriptIds.length === 0) return [];

    // 3. Charger les scripts (sans embed)
    const { data: scriptsData, error: scriptsErr } = await supabase
      .from("scripts")
      .select("id, title, full_text, user_id")
      .in("id", scriptIds);

    if (scriptsErr) throw scriptsErr;

    // 4. Charger les personnages et répliques séparément (évite PGRST201)
    const { data: charactersData } = await supabase
      .from("characters")
      .select("*")
      .in("script_id", scriptIds);

    const { data: replicasData } = await supabase
      .from("replicas")
      .select("*")
      .in("script_id", scriptIds);

    // 5. Charger les noms des troupes
    const { data: troupesData } = await supabase
      .from("troupes")
      .select("id, name")
      .in("id", troupeIds);

    const troupeMap = {};
    (troupesData || []).forEach((t) => { troupeMap[t.id] = t.name; });

    const charMap = {};
    (charactersData || []).forEach((c) => {
      if (!charMap[c.script_id]) charMap[c.script_id] = [];
      charMap[c.script_id].push(c);
    });

    const repMap = {};
    (replicasData || []).forEach((r) => {
      if (!repMap[r.script_id]) repMap[r.script_id] = [];
      repMap[r.script_id].push(r);
    });

    const scriptMap = {};
    (scriptsData || []).forEach((s) => {
      scriptMap[s.id] = {
        ...s,
        characters: charMap[s.id] || [],
        replicas: repMap[s.id] || [],
      };
    });

    // 6. Recomposer le résultat final
    return sharedList
      .map((item) => ({
        id: item.id,
        shared_at: item.shared_at,
        shared_by: item.shared_by,
        troupe_id: item.troupe_id,
        troupe_name: troupeMap[item.troupe_id] || "Troupe",
        scripts: scriptMap[item.script_id] || null,
      }))
      .filter((item) => item.scripts !== null);
  } catch (err) {
    console.error("Erreur lors de la récupération des scripts partagés:", err);
    return [];
  }
};

// =====================================================
// DOCUMENTS PUBLICS
// =====================================================

export const uploadPublicDocument = async (file, metadata, userId) => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `${timestamp}_${safeName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("public-documents")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  let fileType = "other";
  if (file.type === "application/pdf") fileType = "pdf";
  else if (file.type.startsWith("image/")) fileType = "image";
  else if (file.type === "text/plain") fileType = "txt";
  else if (file.type.startsWith("audio/")) fileType = "audio";

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

export const fetchPublicDocuments = async (category = null) => {
  let query = supabase
    .from("public_documents")
    .select("*")
    .eq("is_approved", true)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getPublicDocumentUrl = (path) => {
  if (!path) return null;
  const { data } = supabase.storage.from("public-documents").getPublicUrl(path);
  return data.publicUrl;
};

export const deletePublicDocument = async (documentId, filePath) => {
  if (filePath) {
    const { error: storageError } = await supabase.storage
      .from("public-documents")
      .remove([filePath]);
    if (storageError) {
      console.error("Erreur suppression storage:", storageError);
    }
  }

  const { error } = await supabase
    .from("public_documents")
    .delete()
    .eq("id", documentId);

  if (error) throw error;
};

export const savePublicDocumentAsScript = async (publicDoc, userId) => {
  const { data: existingScripts } = await supabase
    .from("scripts")
    .select("display_order")
    .eq("user_id", userId)
    .order("display_order", { ascending: false })
    .limit(1);

  const nextOrder = (existingScripts?.[0]?.display_order || 0) + 1;

  const scriptData = {
    user_id: userId,
    title: publicDoc.title,
    original_filename: publicDoc.file_name,
    pdf_url: publicDoc.file_path,
    full_text: "",
    source_public_doc_id: publicDoc.id,
    display_order: nextOrder,
  };

  const { data, error } = await supabase
    .from("scripts")
    .insert([scriptData])
    .select()
    .single();

  if (error) throw error;
  return data;
};

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

export const incrementDownloadCount = async (documentId) => {
  const { error } = await supabase.rpc("increment_download_count", {
    doc_id: documentId,
  });

  if (error && !error.message.includes("function")) {
    throw error;
  }
};

// =====================================================
// SYSTÈME DE TAGS
// =====================================================

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

export const createTag = async (userId, name, color = "#6B7280") => {
  const { data, error } = await supabase
    .from("user_tags")
    .insert([{ user_id: userId, name, color }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteTag = async (tagId) => {
  const { error } = await supabase.from("user_tags").delete().eq("id", tagId);
  if (error) throw error;
};

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

export const fetchScriptTags = async (scriptId) => {
  const { data, error } = await supabase
    .from("script_tags")
    .select(`
      id,
      tag_id,
      user_tags ( id, name, color )
    `)
    .eq("script_id", scriptId);

  if (error) {
    console.error("Error fetching script tags:", error);
    return [];
  }
  return data?.map((st) => st.user_tags) || [];
};

export const addTagToScript = async (scriptId, tagId) => {
  const { data, error } = await supabase
    .from("script_tags")
    .insert([{ script_id: scriptId, tag_id: tagId }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const removeTagFromScript = async (scriptId, tagId) => {
  const { error } = await supabase
    .from("script_tags")
    .delete()
    .eq("script_id", scriptId)
    .eq("tag_id", tagId);

  if (error) throw error;
};

export const fetchScriptsWithTags = async (userId) => {
  const { data: scripts, error: scriptsError } = await supabase
    .from("scripts")
    .select(`
      *,
      characters (*),
      script_tags (
        user_tags ( id, name, color )
      )
    `)
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  if (scriptsError) {
    console.error("Error fetching scripts with tags:", scriptsError);
    return [];
  }

  return (
    scripts?.map((script) => ({
      ...script,
      tags: script.script_tags?.map((st) => st.user_tags).filter(Boolean) || [],
    })) || []
  );
};

// =====================================================
// COPIE DE SCRIPTS PARTAGÉS
// =====================================================

export const copySharedScript = async (originalScriptId, troupeId, userId) => {
  console.log("🔄 Début copie script:", { originalScriptId, troupeId, userId });

  // 1. Récupérer le script original
  const { data: original, error: fetchError } = await supabase
    .from("scripts")
    .select("*")
    .eq("id", originalScriptId)
    .single();

  if (fetchError) {
    console.error("❌ Erreur fetch script original:", fetchError);
    throw fetchError;
  }

  // 2. Charger personnages et répliques séparément (sans embed pour éviter PGRST201)
  const { data: originalCharacters } = await supabase
    .from("characters")
    .select("*")
    .eq("script_id", originalScriptId);

  const { data: originalReplicas } = await supabase
    .from("replicas")
    .select("*")
    .eq("script_id", originalScriptId);

  console.log("✅ Script original récupéré:", original.title);

  // 3. Créer la copie du script
  const scriptData = {
    user_id: userId,
    title: `${original.title} (copie)`,
  };

  if (original.full_text) scriptData.full_text = original.full_text;
  if (original.original_filename) scriptData.original_filename = original.original_filename;
  if (original.pdf_url) scriptData.pdf_url = original.pdf_url;

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

  // 4. Copier les personnages
  const characterMap = {};
  for (const char of originalCharacters || []) {
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

  // 5. Copier les répliques
  const replicasToInsert = (originalReplicas || []).map((rep) => ({
    script_id: newScript.id,
    character_id: characterMap[rep.character_id] || null,
    order_index: rep.order_index,
    text: rep.text,
    text_gaps: rep.text_gaps,
    cue_words: rep.cue_words,
  }));

  if (replicasToInsert.length > 0) {
    const { error: repError } = await supabase
      .from("replicas")
      .insert(replicasToInsert);

    if (repError) {
      console.error("❌ Erreur création répliques:", repError);
      throw repError;
    }
  }

  return newScript;
};

// =====================================================
// RÔLES TROUPE (admin/member)
// =====================================================

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

export const updateMemberRole = async (troupeId, userId, newRole) => {
  const { error } = await supabase
    .from("troupe_members")
    .update({ role: newRole })
    .eq("troupe_id", troupeId)
    .eq("user_id", userId);

  if (error) throw error;
};

// =====================================================
// CONSIGNES TROUPE (documents partagés)
// =====================================================

export const uploadTroupeDocument = async (file, troupeId, userId, title) => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `troupes/${troupeId}/${timestamp}_${safeName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("scripts-pdfs")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });

  if (uploadError) throw uploadError;

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

export const fetchTroupeDocuments = async (troupeId) => {
  const { data, error } = await supabase
    .from("troupe_documents")
    .select("*")
    .eq("troupe_id", troupeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const deleteTroupeDocument = async (documentId, filePath) => {
  await supabase.storage.from("scripts-pdfs").remove([filePath]);

  const { error } = await supabase
    .from("troupe_documents")
    .delete()
    .eq("id", documentId);

  if (error) throw error;
};

// =====================================================
// SOUS-ENSEMBLES DE RÉPLIQUES
// =====================================================

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

export const fetchReplicaGroups = async (scriptId, userId) => {
  const { data, error } = await supabase
    .from("replica_groups")
    .select(`
      *,
      user_tags (id, name, color),
      replica_group_items (
        replica_id,
        order_index
      )
    `)
    .eq("script_id", scriptId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
};

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

export const removeReplicaFromGroup = async (groupId, replicaId) => {
  const { error } = await supabase
    .from("replica_group_items")
    .delete()
    .eq("group_id", groupId)
    .eq("replica_id", replicaId);

  if (error) throw error;
};

export const deleteReplicaGroup = async (groupId) => {
  const { error } = await supabase
    .from("replica_groups")
    .delete()
    .eq("id", groupId);

  if (error) throw error;
};

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

let sessionUpdateDisabled = false;

export const updateUserSession = async (userId, page = null) => {
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
// RÔLES UTILISATEURS (dev, director, member)
// =====================================================

let userRolesDisabled = false;

export const getUserRole = async (userId) => {
  if (userRolesDisabled) return "member";

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
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

export const setUserRole = async (userId, role) => {
  const { data, error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getAllUsersWithRoles = async () => {
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("*");

  if (rolesError) throw rolesError;
  return roles || [];
};

export const isUserDev = async (userId) => {
  const role = await getUserRole(userId);
  return role === "dev";
};

export const isUserDirectorOrDev = async (userId) => {
  const role = await getUserRole(userId);
  return role === "dev" || role === "director";
};

// =====================================================
// NOTES VOCALES PERSONNELLES
// =====================================================

export const uploadVoiceNote = async (
  audioBlob,
  scriptId,
  userId,
  afterReplicaId = null
) => {
  const timestamp = Date.now();
  const fileName = `voice-notes/${userId}/${scriptId}/${timestamp}.webm`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("audio-recordings")
    .upload(fileName, audioBlob, {
      cacheControl: "3600",
      contentType: "audio/webm",
    });

  if (uploadError) throw uploadError;

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

export const deleteVoiceNote = async (noteId, audioPath) => {
  await supabase.storage.from("audio-recordings").remove([audioPath]);

  const { error } = await supabase
    .from("voice_notes")
    .delete()
    .eq("id", noteId);

  if (error) throw error;
};

export const getVoiceNoteUrl = (audioPath) => {
  const { data } = supabase.storage
    .from("audio-recordings")
    .getPublicUrl(audioPath);
  return data.publicUrl;
};

// =====================================================
// ENREGISTREMENTS AUDIO PAR PERSONNAGE
// =====================================================

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

export const fetchCharacterRecordings = async (characterIds, userId) => {
  const { data, error } = await supabase
    .from("character_recordings")
    .select("*")
    .in("character_id", characterIds)
    .eq("user_id", userId);

  if (error) throw error;
  return data || [];
};

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
// VIDÉOS YOUTUBE (Troupe)
// =====================================================

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

export const fetchTroupeVideos = async (troupeId) => {
  const { data, error } = await supabase
    .from("troupe_videos")
    .select("*")
    .eq("troupe_id", troupeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const deleteTroupeVideo = async (videoId) => {
  const { error } = await supabase
    .from("troupe_videos")
    .delete()
    .eq("id", videoId);

  if (error) throw error;
};

export const extractYoutubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

// =====================================================
// ENREGISTREMENTS AUDIO PARTAGÉS (Troupe)
// =====================================================

export const uploadSharedRecording = async (
  audioBlob,
  name,
  troupeId,
  userId,
  duration
) => {
  const timestamp = Date.now();
  const fileName = `shared-recordings/${troupeId}/${userId}/${timestamp}.webm`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("audio-recordings")
    .upload(fileName, audioBlob, {
      cacheControl: "3600",
      contentType: "audio/webm",
    });

  if (uploadError) throw uploadError;

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

export const fetchSharedRecordings = async (troupeIds) => {
  if (!troupeIds || troupeIds.length === 0) return [];

  const { data, error } = await supabase
    .from("shared_recordings")
    .select(`
      *,
      troupes (name)
    `)
    .in("troupe_id", troupeIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((rec) => ({
    ...rec,
    troupe_name: rec.troupes?.name,
    audio_url: getSharedRecordingUrl(rec.audio_path),
  }));
};

export const getSharedRecordingUrl = (audioPath) => {
  const { data } = supabase.storage
    .from("audio-recordings")
    .getPublicUrl(audioPath);
  return data.publicUrl;
};

export const deleteSharedRecording = async (recordingId, audioPath) => {
  await supabase.storage.from("audio-recordings").remove([audioPath]);

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

  const { data: existingAudios } = await supabase
    .from("personal_audios")
    .select("display_order")
    .eq("user_id", userId)
    .order("display_order", { ascending: false })
    .limit(1);

  const nextOrder = (existingAudios?.[0]?.display_order || 0) + 1;

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

export const fetchPersonalAudios = async (userId) => {
  const { data, error } = await supabase
    .from("personal_audios")
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data || [];
};

export const deletePersonalAudio = async (audioId, audioPath) => {
  await supabase.storage.from("audio-recordings").remove([audioPath]);

  const { error } = await supabase
    .from("personal_audios")
    .delete()
    .eq("id", audioId);

  if (error) throw error;
};

export const getPersonalAudioUrl = (audioPath) => {
  const { data } = supabase.storage
    .from("audio-recordings")
    .getPublicUrl(audioPath);
  return data.publicUrl;
};

export const updatePersonalAudioOrder = async (updates) => {
  for (const update of updates) {
    const { error } = await supabase
      .from("personal_audios")
      .update({ display_order: update.display_order })
      .eq("id", update.id);

    if (error) throw error;
  }
};

export const savePublicAudioAsScript = async (publicDoc, userId) => {
  const { data: existingScripts } = await supabase
    .from("scripts")
    .select("display_order")
    .eq("user_id", userId)
    .order("display_order", { ascending: false })
    .limit(1);

  const nextOrder = (existingScripts?.[0]?.display_order || 0) + 1;

  const { data, error } = await supabase
    .from("scripts")
    .insert([
      {
        user_id: userId,
        title: publicDoc.title || publicDoc.file_name,
        original_filename: publicDoc.file_name,
        pdf_url: `audio:public:${publicDoc.file_path}`,
        full_text: "",
        display_order: nextOrder,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const copyPublicAudioToPersonal = async (publicDoc, userId) => {
  const { data: existingAudios } = await supabase
    .from("personal_audios")
    .select("display_order")
    .eq("user_id", userId)
    .order("display_order", { ascending: false })
    .limit(1);

  const nextOrder = (existingAudios?.[0]?.display_order || 0) + 1;

  const { data, error } = await supabase
    .from("personal_audios")
    .insert([
      {
        user_id: userId,
        name: publicDoc.title || publicDoc.file_name,
        audio_path: `public:${publicDoc.file_path}`,
        display_order: nextOrder,
        source_public_doc_id: publicDoc.id,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

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

export const getAudioUrl = (audioPath) => {
  if (!audioPath) return null;

  if (audioPath.startsWith("public:")) {
    const publicPath = audioPath.replace("public:", "");
    const { data } = supabase.storage
      .from("public-documents")
      .getPublicUrl(publicPath);
    return data.publicUrl;
  }

  const { data } = supabase.storage
    .from("audio-recordings")
    .getPublicUrl(audioPath);
  return data.publicUrl;
};
