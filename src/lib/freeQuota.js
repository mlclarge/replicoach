import { supabase } from "./supabase";

// Nombre de textes autorisés pour un compte gratuit (imports + copies de la bibliothèque publique)
export const FREE_TEXT_LIMIT = 1;

export async function countUserTexts(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from("scripts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    console.warn("Comptage des textes impossible:", error);
    return 0;
  }
  return count || 0;
}

export async function isFreeTextLimitReached(userId, isPremium) {
  if (isPremium) return false;
  return (await countUserTexts(userId)) >= FREE_TEXT_LIMIT;
}
