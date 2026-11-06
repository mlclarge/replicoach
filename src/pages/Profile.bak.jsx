import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useScriptStore } from "../store/scriptStore";
import { fetchDirectorNotes, getUserRole } from "../lib/supabase";
import { fetchMyAssignedScripts, syncAssignedScriptsToActor } from "../lib/directorService";
import Loader from "../components/ui/Loader";
import { MonitoringPanel } from "../components/Monitoring";
import AdminPanel from "../components/AdminPanel";
import DirectorTroupeManager from "../components/DirectorTroupeManager";
import AudioSettingsPanel from "../components/AudioSettingsPanel";

// Emails autorisés d'administration globale
const ADMIN_EMAILS = ["moz2611@gmail.com"];

/**
 * Page Profil (v2)
 * - Informations utilisateur & statut du profil
 * - Espace Metteur en Scène (pour rôle director ou dev)
 * - Zone Admin Développeur (pour rôle dev)
 * - Textes affectés par le Metteur en scène
 * - Statistiques, consignes & réglages audio
 */
function Profile() {
  const navigate = useNavigate();
  const { user, isPremium, signOut } = useAuthStore();
  const { scripts, fetchScripts } = useScriptStore();

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRoleState] = useState("member");
  const [directorNotes, setDirectorNotes] = useState([]);
  const [assignedScripts, setAssignedScripts] = useState([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("scripts"); // scripts | notes | history | audio

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // 1. Récupérer le rôle utilisateur
      const role = await getUserRole(user.id);
      setUserRoleState(role);

      // 2. Synchroniser/importer automatiquement les textes affectés par le metteur en scène
      if (user.email) {
        await syncAssignedScriptsToActor(user.id, user.email);
        const assigned = await fetchMyAssignedScripts(user.email);
        setAssignedScripts(assigned || []);
      }

      // 3. Charger les scripts personnels (y compris les textes synchronisés)
      await fetchScripts(user.id);

      // 4. Charger les consignes metteur en scène
      const notes = await fetchDirectorNotes(user.id);
      setDirectorNotes(notes || []);
    } catch (err) {
      console.error("Erreur chargement données profil:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Calculer les statistiques
  const stats = {
    totalScripts: scripts.length,
    totalReplicas: scripts.reduce((acc, s) => acc + (s.replicas?.length || 0), 0),
    totalCharacters: scripts.reduce((acc, s) => acc + (s.characters?.length || 0), 0),
    totalNotes: directorNotes.length,
  };

  // Historique combiné (scripts + notes) trié par date
  const history = [
    ...scripts.map((s) => ({
      id: s.id,
      type: "script",
      title: s.title,
      date: new Date(s.created_at),
      icon: "📜",
      detail: `${s.characters?.length || 0} personnages • ${s.replicas?.length || 0} répliques`,
    })),
    ...directorNotes.map((n) => ({
      id: n.id,
      type: "note",
      title: n.file_name,
      date: new Date(n.created_at),
      icon: n.file_name?.endsWith(".pdf") ? "📕" : "📝",
      detail: n.file_size ? `${(n.file_size / 1024).toFixed(0)} Ko` : "",
    })),
  ].sort((a, b) => b.date - a.date);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  const isDirectorOrDev = userRole === "director" || userRole === "dev";
  const isDev = userRole === "dev" || ADMIN_EMAILS.includes(user?.email?.toLowerCase());

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      {/* Carte En-tête utilisateur */}
      <div className="card mb-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-gold-500 rounded-full flex items-center justify-center text-3xl shadow-lg">
            🎭
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display text-white font-bold truncate">
                {user?.user_metadata?.full_name || "Comédien"}
              </h1>
              {userRole === "dev" && (
                <span className="px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded-full">
                  DEV
                </span>
              )}
              {userRole === "director" && (
                <span className="px-2 py-0.5 bg-gold-500 text-black text-[10px] font-extrabold rounded-full">
                  METTEUR EN SCÈNE
                </span>
              )}
              {isPremium && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold rounded-full">
                  ✨ PREMIUM
                </span>
              )}
            </div>

            <p className="text-gray-400 text-xs truncate mt-0.5">{user?.email}</p>
            <p className="text-gray-500 text-[11px] mt-1">
              Membre depuis{" "}
              {new Date(user?.created_at).toLocaleDateString("fr-FR", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Textes affectés par le Metteur en scène (Alerte visuelle pour comédien) */}
      {assignedScripts.length > 0 && (
        <div className="mb-6 p-4 bg-amber-950/40 border-2 border-gold-500/50 rounded-xl shadow-lg animate-fade-in">
          <h3 className="text-sm font-bold text-gold-400 flex items-center gap-2 mb-1">
            <span>📌</span> Texte par défaut affecté par votre Metteur en Scène :
          </h3>
          <p className="text-xs text-amber-200/80 mb-3">
            Votre metteur en scène a configuré les voix IA et le texte ci-dessous pour vos répétitions.
          </p>

          <div className="space-y-2">
            {assignedScripts.map((a) => (
              <div
                key={a.id}
                onClick={() => navigate(`/script/${a.script_id}`)}
                className="p-3 bg-gray-900/80 hover:bg-gray-900 border border-gold-500/40 rounded-lg cursor-pointer transition flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="text-white text-xs font-bold truncate">📜 {a.scripts?.title}</p>
                  <p className="text-[11px] text-gray-400">Prêt pour les séances d'écoute en Mode Audio</p>
                </div>
                <span className="px-3 py-1 bg-gold-500 text-black text-xs font-bold rounded-full flex-shrink-0">
                  Ouvrir ▶
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-gold-500">{stats.totalScripts}</p>
          <p className="text-gray-400 text-xs">Textes</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-500">{stats.totalReplicas}</p>
          <p className="text-gray-400 text-xs">Répliques</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-emerald-500">{stats.totalCharacters}</p>
          <p className="text-gray-400 text-xs">Personnages</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-yellow-500">{stats.totalNotes}</p>
          <p className="text-gray-400 text-xs">Consignes</p>
        </div>
      </div>

      {/* ESPACE METTEUR EN SCÈNE (Directeurs ou Devs) */}
      {isDirectorOrDev && <DirectorTroupeManager />}

      {/* Monitoring (Dev / Admin unique) */}
      {isDev && ADMIN_EMAILS.includes(user?.email?.toLowerCase()) && (
        <div className="mb-6">
          <MonitoringPanel />
        </div>
      )}

      {/* Panneau Admin Développeur */}
      {isDev && <AdminPanel currentUserId={user?.id} />}

      {/* Onglets */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setActiveTab("scripts")}
          className={`flex-1 min-w-[100px] py-2 rounded-lg font-semibold transition text-xs ${
            activeTab === "scripts" ? "bg-primary-700 text-white" : "bg-gray-800 text-gray-400"
          }`}
        >
          📜 Textes ({stats.totalScripts})
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`flex-1 min-w-[100px] py-2 rounded-lg font-semibold transition text-xs ${
            activeTab === "notes" ? "bg-primary-700 text-white" : "bg-gray-800 text-gray-400"
          }`}
        >
          📁 Consignes ({stats.totalNotes})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 min-w-[100px] py-2 rounded-lg font-semibold transition text-xs ${
            activeTab === "history" ? "bg-primary-700 text-white" : "bg-gray-800 text-gray-400"
          }`}
        >
          📅 Historique
        </button>
        <button
          onClick={() => setActiveTab("audio")}
          className={`flex-1 min-w-[100px] py-2 rounded-lg font-semibold transition text-xs ${
            activeTab === "audio" ? "bg-primary-700 text-white" : "bg-gray-800 text-gray-400"
          }`}
        >
          🔊 Audio
        </button>
      </div>

      {/* Contenu de l'onglet */}
      <div className="space-y-3 mb-8">
        {activeTab === "scripts" &&
          (scripts.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-xs">Aucun texte importé</p>
          ) : (
            scripts.map((script) => (
              <div
                key={script.id}
                onClick={() => navigate(`/script/${script.id}`)}
                className="card cursor-pointer hover:border-gray-600 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📜</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-xs truncate">{script.title}</p>
                    <p className="text-gray-500 text-[11px]">
                      {script.characters?.length || 0} personnages • {script.replicas?.length || 0}{" "}
                      répliques
                    </p>
                  </div>
                  <span className="text-gray-500 text-[11px]">
                    {new Date(script.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </div>
            ))
          ))}

        {activeTab === "notes" &&
          (directorNotes.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-xs">Aucune consigne uploadée</p>
          ) : (
            directorNotes.map((note) => (
              <div key={note.id} className="card">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{note.file_name?.endsWith(".pdf") ? "📕" : "📝"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-xs truncate">{note.file_name}</p>
                    <p className="text-gray-500 text-[11px]">
                      {note.file_size ? `${(note.file_size / 1024).toFixed(0)} Ko` : ""}
                    </p>
                  </div>
                  <span className="text-gray-500 text-[11px]">
                    {new Date(note.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </div>
            ))
          ))}

        {activeTab === "history" &&
          (history.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-xs">Aucune activité</p>
          ) : (
            history.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg"
              >
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs truncate">{item.title}</p>
                  <p className="text-gray-500 text-[11px]">{item.detail}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-[11px]">{item.date.toLocaleDateString("fr-FR")}</p>
                  <p className="text-gray-500 text-[10px]">
                    {item.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))
          ))}

        {activeTab === "audio" && <AudioSettingsPanel />}
      </div>

      {/* Actions de session */}
      <div className="space-y-3">
        <button
          onClick={() => {
            localStorage.removeItem("replicoach-onboarding-seen");
            window.location.reload();
          }}
          className="w-full p-3.5 bg-gray-800 hover:bg-primary-900/30 text-gray-400 hover:text-primary-400 rounded-xl transition flex items-center justify-center gap-2 text-xs font-semibold"
        >
          📖 Revoir le tutoriel
        </button>

        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full p-3.5 bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 rounded-xl transition flex items-center justify-center gap-2 text-xs font-semibold"
        >
          🚪 Se déconnecter
        </button>
      </div>

      {/* Modal confirmation déconnexion */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl max-w-sm w-full border border-gray-700">
            <div className="p-6 text-center">
              <span className="text-5xl mb-4 block">👋</span>
              <h3 className="text-lg font-semibold text-white mb-2">Se déconnecter ?</h3>
              <p className="text-gray-400 text-xs">
                Vous pourrez vous reconnecter à tout moment avec votre compte RépliCoach.
              </p>
            </div>

            <div className="p-4 border-t border-gray-700 flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="btn-secondary flex-1 text-xs">
                Annuler
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-semibold flex-1 transition text-xs"
              >
                Déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
