import { supabase } from "./supabase";

/**
 * Service pour la gestion des comédiens et l'affectation de textes par un Metteur en Scène (Director).
 */

// 1. Récupérer la liste des e-mails comédiens gérés par le metteur en scène
export const fetchDirectorMembers = async (directorId) => {
  if (!directorId) return [];
  const { data, error } = await supabase
    .from("director_members")
    .select("*")
    .eq("director_id", directorId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur fetchDirectorMembers:", error);
    return [];
  }
  return data || [];
};

// 2. Ajouter une adresse e-mail comédien à la liste
export const addDirectorMember = async (directorId, actorEmail) => {
  const cleanEmail = actorEmail.trim().toLowerCase();
  const { data, error } = await supabase
    .from("director_members")
    .insert([{ director_id: directorId, actor_email: cleanEmail }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// 3. Supprimer un comédien de la liste du metteur en scène
export const removeDirectorMember = async (memberId) => {
  const { error } = await supabase
    .from("director_members")
    .delete()
    .eq("id", memberId);

  if (error) throw error;
};

// 4. Affecter un texte par défaut à une adresse e-mail comédien
export const assignScriptToActor = async (scriptId, directorId, actorEmail, isDefault = true) => {
  const cleanEmail = actorEmail.trim().toLowerCase();
  const { data, error } = await supabase
    .from("script_assignments")
    .upsert(
      {
        script_id: scriptId,
        assigned_by: directorId,
        assigned_to_email: cleanEmail,
        is_default: isDefault,
      },
      { onConflict: "script_id,assigned_to_email" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
};

// 5. Récupérer les affectations de textes faites par un metteur en scène
export const fetchDirectorAssignments = async (directorId) => {
  if (!directorId) return [];
  const { data, error } = await supabase
    .from("script_assignments")
    .select("*, scripts(id, title, original_filename)")
    .eq("assigned_by", directorId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur fetchDirectorAssignments:", error);
    return [];
  }
  return data || [];
};

// 6. Supprimer une affectation de texte
export const removeScriptAssignment = async (assignmentId) => {
  const { error } = await supabase
    .from("script_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) throw error;
};

// 7. Pour le comédien : récupérer la liste des textes affectés à son adresse e-mail
export const fetchMyAssignedScripts = async (userEmail) => {
  if (!userEmail) return [];
  const cleanEmail = userEmail.trim().toLowerCase();
  
  const { data, error } = await supabase
    .from("script_assignments")
    .select("*, scripts(id, title, full_text, user_id)")
    .eq("assigned_to_email", cleanEmail);

  if (error) {
    console.error("Erreur fetchMyAssignedScripts:", error);
    return [];
  }
  return data || [];
};

// 8. Synchronisation et importation automatique des textes affectés vers la bibliothèque du comédien
export const syncAssignedScriptsToActor = async (userId, userEmail) => {
  if (!userId || !userEmail) return [];
  const cleanEmail = userEmail.trim().toLowerCase();

  try {
    // 1. Récupérer les affectations de textes pour cet e-mail
    const { data: assignments, error: assignErr } = await supabase
      .from("script_assignments")
      .select("*, scripts(*)")
      .eq("assigned_to_email", cleanEmail);

    if (assignErr || !assignments || assignments.length === 0) return [];

    const importedScripts = [];

    for (const assignment of assignments) {
      const originalScript = assignment.scripts;
      if (!originalScript) continue;

      // 2. Vérifier si le comédien possède déjà ce texte dans sa bibliothèque
      const { data: existing } = await supabase
        .from("scripts")
        .select("id")
        .eq("user_id", userId)
        .eq("title", originalScript.title)
        .maybeSingle();

      if (existing) {
        importedScripts.push(existing);
        continue;
      }

      // 3. Importer la copie du script dans la bibliothèque personnelle du comédien
      const scriptData = {
        user_id: userId,
        title: originalScript.title,
        full_text: originalScript.full_text || "",
        original_filename: originalScript.original_filename || null,
        pdf_url: originalScript.pdf_url || null,
      };

      const { data: newScript, error: createScriptErr } = await supabase
        .from("scripts")
        .insert([scriptData])
        .select()
        .single();

      if (createScriptErr) {
        console.error("Erreur création copie script affecté:", createScriptErr);
        continue;
      }

      // 4. Copier les personnages
      const { data: originalChars } = await supabase
        .from("characters")
        .select("*")
        .eq("script_id", originalScript.id);

      const charMap = {};
      for (const char of originalChars || []) {
        const charData = {
          script_id: newScript.id,
          name: char.name,
          color: char.color,
          gender: char.gender || null,
        };
        const { data: newChar } = await supabase
          .from("characters")
          .insert([charData])
          .select()
          .single();

        if (newChar) {
          charMap[char.id] = newChar.id;
        }
      }

      // 5. Copier les répliques
      const { data: originalReps } = await supabase
        .from("replicas")
        .select("*")
        .eq("script_id", originalScript.id)
        .order("order_index", { ascending: true });

      if (originalReps && originalReps.length > 0) {
        const repsToInsert = originalReps.map((r) => ({
          script_id: newScript.id,
          character_id: charMap[r.character_id] || null,
          order_index: r.order_index,
          text: r.text,
          text_gaps: r.text_gaps || null,
          cue_words: r.cue_words || null,
          act_title: r.act_title || null,
          scene_title: r.scene_title || null,
          is_context: r.is_context || false,
          page_number: r.page_number || null,
        }));

        await supabase.from("replicas").insert(repsToInsert);
      }

      importedScripts.push(newScript);
    }

    return importedScripts;
  } catch (err) {
    console.error("Erreur syncAssignedScriptsToActor:", err);
    return [];
  }
};
