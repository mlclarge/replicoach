import { useState, useEffect } from "react";
import {
  getUserRole,
  setUserRole,
  getAllUsersWithRoles,
  supabase,
} from "../lib/supabase";

/**
 * Panneau d'administration Développeur (v2)
 * - Gestion des rôles
 * - Génération à la volée de comptes Bêta-Testeurs (Comédien / Metteur en Scène)
 */
export function AdminPanel({ currentUserId }) {
  const [isDevUser, setIsDevUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Formulaire d'ajout de rôle par ID (existant)
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("director");

  // ⚡ Formulaire de création Bêta-Testeur à la volée
  const [showBetaModal, setShowBetaModal] = useState(false);
  const [betaEmail, setBetaEmail] = useState("");
  const [betaPassword, setBetaPassword] = useState("");
  const [betaRole, setBetaRole] = useState("director"); // director (Metteur en scène Premium) | member (Comédien)
  const [betaCreating, setBetaCreating] = useState(false);
  const [createdBetaUser, setCreatedBetaUser] = useState(null);

  useEffect(() => {
    checkAccess();
  }, [currentUserId]);

  const checkAccess = async () => {
    setLoading(true);
    try {
      const role = await getUserRole(currentUserId);
      setIsDevUser(role === "dev");

      if (role === "dev") {
        await loadUsers();
      }
    } catch (err) {
      console.error("Error checking access:", err);
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    try {
      const roles = await getAllUsersWithRoles();
      setUsers(roles);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      setError(null);
      await setUserRole(userId, newRole);
      setSuccess("Rôle mis à jour !");
      loadUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Erreur: " + err.message);
    }
  };

  // Générateur de mot de passe sécurisé à la volée
  const generateSecurePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
    let pass = "Repli-2026-";
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setBetaPassword(pass);
  };

  // Création du compte Bêta-Testeur via l'API Serverless
  const handleCreateBetaAccount = async (e) => {
    e.preventDefault();
    if (!betaEmail.trim() || !betaPassword.trim()) return;

    setBetaCreating(true);
    setError(null);
    setCreatedBetaUser(null);

    try {
      const res = await fetch("/api/create-beta-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: betaEmail.trim(),
          password: betaPassword,
          role: betaRole,
          requesterUserId: currentUserId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Erreur lors de la création du compte Bêta.");
      }

      setCreatedBetaUser({
        email: data.user.email,
        password: betaPassword,
        role: data.user.role,
        is_premium: data.user.is_premium,
      });

      setSuccess(`🎉 Compte Bêta créé pour ${data.user.email} !`);
      setBetaEmail("");
      loadUsers();
    } catch (err) {
      setError("Erreur Bêta: " + err.message);
    } finally {
      setBetaCreating(false);
    }
  };

  const copyCredentialsToClipboard = () => {
    if (!createdBetaUser) return;
    const text = `🎭 Vos accès Bêta RépliCoach :\n• Adresse : ${createdBetaUser.email}\n• Mot de passe : ${createdBetaUser.password}\n• Rôle : ${createdBetaUser.role === 'director' ? 'Metteur en Scène (Premium)' : 'Comédien Solo'}\n• Connexion : ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    alert("Identifiants copiés dans le presse-papier !");
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case "dev": return { label: "Développeur", color: "bg-purple-500" };
      case "director": return { label: "Metteur en scène", color: "bg-gold-500 text-black font-bold" };
      default: return { label: "Membre", color: "bg-gray-500" };
    }
  };

  const getRoleEmoji = (role) => {
    switch (role) {
      case "dev": return "👨‍💻";
      case "director": return "🎬";
      default: return "👤";
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-800 rounded-xl">
        <p className="text-gray-400 text-center">Vérification des droits d'administration...</p>
      </div>
    );
  }

  if (!isDevUser) {
    return (
      <div className="p-4 bg-gray-800 rounded-xl border border-red-500/30">
        <p className="text-red-400 text-center">🔒 Accès réservé aux développeurs</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-purple-500/30 overflow-hidden shadow-2xl my-4">
      {/* Header Admin */}
      <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-900 border-b border-purple-500/30 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            👨‍💻 Panneau Admin Développeur
          </h2>
          <p className="text-xs text-purple-300">Gérer les rôles et créer des comptes Bêta-Testeurs à la volée</p>
        </div>
        <span className="px-2.5 py-1 bg-purple-500 text-white text-xs font-bold rounded-full">DEV</span>
      </div>

      <div className="p-4 space-y-6">
        {/* Messages */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-xs">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-400 text-xs">
            {success}
          </div>
        )}

        {/* ⚡ SECTION NOUVELLE : CRÉATION DU COMPTE BÊTA-TESTEUR */}
        <div className="p-4 bg-purple-950/40 border border-purple-500/40 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-purple-200 flex items-center gap-2">
              <span>⚡</span> Générateur de Comptes Bêta-Testeurs
            </h3>
            <button
              onClick={() => {
                setShowBetaModal(!showBetaModal);
                if (!betaPassword) generateSecurePassword();
              }}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition"
            >
              {showBetaModal ? "Fermer" : "+ Nouveau Compte Testeur"}
            </button>
          </div>

          {showBetaModal && (
            <form onSubmit={handleCreateBetaAccount} className="space-y-3 pt-2">
              <div>
                <label className="text-xs text-gray-300 font-bold block mb-1">
                  Adresse e-mail du testeur (@) :
                </label>
                <input
                  type="email"
                  required
                  placeholder="testeur@theatre.fr"
                  value={betaEmail}
                  onChange={(e) => setBetaEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-300 font-bold">
                    Mot de passe temporaire :
                  </label>
                  <button
                    type="button"
                    onClick={generateSecurePassword}
                    className="text-[11px] text-purple-400 hover:text-purple-300 font-bold"
                  >
                    🎲 Générer
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={betaPassword}
                  onChange={(e) => setBetaPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300 font-bold block mb-1">
                  Type de profil & droits :
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBetaRole("director")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${
                      betaRole === "director"
                        ? "bg-amber-500 text-black border-amber-400"
                        : "bg-gray-900 text-gray-300 border-gray-700"
                    }`}
                  >
                    🎬 Metteur en Scène (Premium)
                  </button>

                  <button
                    type="button"
                    onClick={() => setBetaRole("member")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${
                      betaRole === "member"
                        ? "bg-gray-600 text-white border-gray-500"
                        : "bg-gray-900 text-gray-300 border-gray-700"
                    }`}
                  >
                    👤 Comédien Solo (Freemium)
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={betaCreating || !betaEmail.trim() || !betaPassword.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold rounded-lg shadow transition disabled:opacity-50"
              >
                {betaCreating ? "Création en cours..." : "⚡ Créer le compte immédiatement"}
              </button>
            </form>
          )}

          {/* Résultat du compte généré prêt à partager */}
          {createdBetaUser && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl space-y-2">
              <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <span>✅</span> Compte Bêta actif et prêt à l'emploi :
              </p>
              <div className="p-2.5 bg-gray-900 rounded-lg text-xs font-mono text-emerald-200 space-y-1">
                <p>📧 Email : {createdBetaUser.email}</p>
                <p>🔑 Pass  : {createdBetaUser.password}</p>
                <p>🎭 Type  : {createdBetaUser.role === 'director' ? 'Metteur en Scène (Premium)' : 'Comédien Solo'}</p>
              </div>
              <button
                type="button"
                onClick={copyCredentialsToClipboard}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition shadow"
              >
                📋 Copier les identifiants pour le testeur
              </button>
            </div>
          )}
        </div>

        {/* Légende des rôles */}
        <div className="p-3 bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-400 mb-2 font-semibold">Légende des rôles :</p>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-purple-500 text-white text-xs rounded-full">
              👨‍💻 Dev - Tous les droits
            </span>
            <span className="px-2 py-1 bg-gold-500 text-black font-bold text-xs rounded-full">
              🎬 Metteur en scène - Troupes & Textes par défaut
            </span>
            <span className="px-2 py-1 bg-gray-500 text-white text-xs rounded-full">
              👤 Membre - Comédien solo
            </span>
          </div>
        </div>

        {/* Liste des utilisateurs avec rôles */}
        <div className="space-y-2">
          <h3 className="text-white font-semibold text-xs mb-2">
            Rôles attribués dans le système ({users.length})
          </h3>

          {users.length === 0 ? (
            <p className="text-gray-500 text-xs">Aucun rôle défini</p>
          ) : (
            users.map((userRole) => {
              const roleInfo = getRoleLabel(userRole.role);
              return (
                <div
                  key={userRole.id}
                  className="flex items-center justify-between p-2.5 bg-gray-700/70 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getRoleEmoji(userRole.role)}</span>
                    <div>
                      <p className="text-white text-xs font-mono">
                        {userRole.user_id.substring(0, 8)}...
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </div>
                  </div>

                  {userRole.user_id !== currentUserId && (
                    <select
                      value={userRole.role}
                      onChange={(e) => handleChangeRole(userRole.user_id, e.target.value)}
                      className="p-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs"
                    >
                      <option value="member">Membre</option>
                      <option value="director">Metteur en scène</option>
                      <option value="dev">Développeur</option>
                    </select>
                  )}

                  {userRole.user_id === currentUserId && (
                    <span className="text-xs text-purple-300 font-semibold">(vous)</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Ajouter un rôle manuellement par ID */}
        <div className="pt-3 border-t border-gray-700">
          {!showAddUser ? (
            <button
              onClick={() => setShowAddUser(true)}
              className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-purple-500 hover:text-purple-400 transition text-xs font-bold"
            >
              + Attribuer un rôle manuellement par UID Supabase
            </button>
          ) : (
            <div className="p-3 bg-gray-700/60 rounded-lg space-y-2">
              <input
                type="text"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="ID utilisateur Supabase (UUID)"
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-xs"
              />

              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-xs"
              >
                <option value="director">🎬 Metteur en scène</option>
                <option value="dev">👨‍💻 Développeur</option>
                <option value="member">👤 Membre</option>
              </select>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAddUser(false);
                    setNewUserEmail("");
                  }}
                  className="flex-1 py-1.5 bg-gray-600 text-gray-200 text-xs rounded"
                >
                  Annuler
                </button>
                <button
                  onClick={async () => {
                    if (!newUserEmail.trim()) return;
                    try {
                      await setUserRole(newUserEmail.trim(), newUserRole);
                      setSuccess("Rôle mis à jour !");
                      setShowAddUser(false);
                      setNewUserEmail("");
                      loadUsers();
                    } catch (err) {
                      setError("Erreur: " + err.message);
                    }
                  }}
                  disabled={!newUserEmail.trim()}
                  className="flex-1 py-1.5 bg-purple-600 text-white text-xs rounded font-bold disabled:opacity-50"
                >
                  Valider
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
