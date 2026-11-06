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
