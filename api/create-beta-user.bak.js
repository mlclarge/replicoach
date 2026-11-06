import { createClient } from "@supabase/supabase-js";

/**
 * API Serverless Vercel (v2) - Création et Réinitialisation de Comptes Bêta-Testeurs
 * Gère à la fois les NOUVEAUX utilisateurs et les utilisateurs DÉJÀ EXISTRANTS dans Supabase Auth.
 */
export default async function handler(req, res) {
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

  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

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

    const finalPremium = role === "director" ? true : !!isPremium;
    let userId = null;

    // 2. Tenter de créer l'utilisateur dans auth.users
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        created_by_dev: requesterUserId,
        account_type: "beta_tester",
      },
    });

    if (createError) {
      // Cas 2B : L'adresse email existe DÉJÀ dans Supabase Auth (ex: inscription antérieure ou Google OAuth)
      if (
        createError.message.includes("already registered") ||
        createError.message.includes("already exists") ||
        createError.status === 422
      ) {
        // Récupérer l'utilisateur existant
        const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (listErr) throw listErr;

        const existingUser = usersList?.users?.find(
          (u) => u.email?.toLowerCase() === cleanEmail
        );

        if (existingUser) {
          userId = existingUser.id;
          // Forcer la mise à jour du mot de passe et valider l'email
          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: cleanPassword,
            email_confirm: true,
            user_metadata: {
              ...existingUser.user_metadata,
              updated_by_dev: requesterUserId,
              account_type: "beta_tester",
            },
          });
          if (updateErr) throw updateErr;
        } else {
          return res.status(400).json({ error: createError.message });
        }
      } else {
        return res.status(400).json({ error: createError.message });
      }
    } else {
      userId = newUser.user.id;
    }

    // 3. Assigner le statut Premium dans `profiles`
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
        email: cleanEmail,
        role,
        is_premium: finalPremium,
      },
    });
  } catch (err) {
    console.error("Erreur serveur création Bêta:", err);
    return res.status(500).json({ error: err.message || "Erreur interne lors de la création du compte." });
  }
}
