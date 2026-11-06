import { createClient } from "@supabase/supabase-js";

/**
 * Fonction API Serverless (Vercel/Node.js) pour la création de comptes Bêta-Testeurs
 * Accès réservé aux développeurs authentifiés.
 */
export default async function handler(req, res) {
  // CORS & Méthode POST uniquement
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée. Utiliser POST." });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: "Variables d'environnement Supabase manquantes (SUPABASE_SERVICE_ROLE_KEY requis).",
    });
  }

  const { email, password, role = "member", isPremium = false, requesterUserId } = req.body;

  if (!email || !password || !requesterUserId) {
    return res.status(400).json({ error: "Paramètres manquants : email, password et requesterUserId sont requis." });
  }

  // Client Supabase Admin avec Clé Service Role
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Vérifier que le demandeur est bien un utilisateur 'dev'
    const { data: requesterRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterUserId)
      .maybeSingle();

    if (requesterRole?.role !== "dev") {
      return res.status(403).json({ error: "🔒 Accès refusé : Seul un profil développeur peut créer des comptes Bêta." });
    }

    // Déterminer le statut Premium (Metteur en scène est Premium par défaut)
    const finalPremium = role === "director" ? true : !!isPremium;

    // 2. Créer l'utilisateur dans auth.users (sans validation e-mail requise)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        created_by_dev: requesterUserId,
        account_type: "beta_tester",
      },
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    const userId = newUser.user.id;

    // 3. Assigner le statut Premium dans la table `profiles`
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, is_premium: finalPremium }, { onConflict: "id" });

    // 4. Assigner le rôle ('director' ou 'member') dans `user_roles`
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id" });

    return res.status(200).json({
      ok: true,
      user: {
        id: userId,
        email: newUser.user.email,
        role,
        is_premium: finalPremium,
      },
    });
  } catch (err) {
    console.error("Erreur serveur création Bêta:", err);
    return res.status(500).json({ error: err.message || "Erreur interne lors de la création du compte." });
  }
}
