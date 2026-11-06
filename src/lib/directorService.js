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

// 8. Synchroniser et copier automatiquement les textes affectés dans la bibliothèque du comédien
export const syncAssignedScriptsToActor = async (userId, userEmail) => {
  if (!userId || !userEmail) return [];
  const cleanEmail = userEmail.trim().toLowerCase();

  try {
    const { data: assignments, error: assignErr } = await supabase
      .from("script_assignments")
      .select("*, scripts(id, title, full_text, original_filename, pdf_url)")
      .eq("assigned_to_email", cleanEmail);

    if (assignErr || !assignments || assignments.length === 0) return [];

    const { data: existingScripts } = await supabase
      .from("scripts")
      .select("id, title")
      .eq("user_id", userId);

    const existingTitles = new Set(
      (existingScripts || []).map((s) => s.title.toLowerCase())
    );

    const synced = [];

    for (const assignment of assignments) {
      const original = assignment.scripts;
      if (!original) continue;

      const baseTitle = original.title;
      if (
        existingTitles.has(baseTitle.toLowerCase()) ||
        existingTitles.has(`${baseTitle} (Troupe)`.toLowerCase())
      ) {
        continue;
      }

      const { data: newScript, error: scriptErr } = await supabase
        .from("scripts")
        .insert([
          {
            user_id: userId,
            title: `${original.title} (Troupe)`,
            full_text: original.full_text || "",
            original_filename: original.original_filename || null,
            pdf_url: original.pdf_url || null,
          },
        ])
        .select()
        .single();

      if (scriptErr || !newScript) {
        console.error("Erreur copie script affecté:", scriptErr);
        continue;
      }

      const { data: originalChars } = await supabase
        .from("characters")
        .select("*")
        .eq("script_id", original.id);

      const charMap = {};
      for (const c of originalChars || []) {
        const { data: newChar } = await supabase
          .from("characters")
          .insert([
            {
              script_id: newScript.id,
              name: c.name,
              color: c.color || "#eab308",
              gender: c.gender || null,
            },
          ])
          .select()
          .single();

        if (newChar) charMap[c.id] = newChar.id;
      }

      const { data: originalReps } = await supabase
        .from("replicas")
        .select("*")
        .eq("script_id", original.id)
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

      synced.push(newScript);
    }

    return synced;
  } catch (err) {
    console.error("Erreur syncAssignedScriptsToActor:", err);
    return [];
  }
};
