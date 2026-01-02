import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useScriptStore } from "../store/scriptStore";
import { fetchDirectorNotes } from "../lib/supabase";
import Loader from "../components/ui/Loader";

/**
 * Page Profil
 * - Informations utilisateur
 * - Historique des documents
 * - Déconnexion
 */
function Profile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { scripts, fetchScripts } = useScriptStore();
  
  const [loading, setLoading] = useState(true);
  const [directorNotes, setDirectorNotes] = useState([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("scripts"); // scripts, notes, stats

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await fetchScripts(user.id);
      const notes = await fetchDirectorNotes(user.id);
      setDirectorNotes(notes || []);
    } catch (err) {
      console.error("Erreur chargement données:", err);
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
    ...scripts.map(s => ({
      id: s.id,
      type: 'script',
      title: s.title,
      date: new Date(s.created_at),
      icon: '📜',
      detail: `${s.characters?.length || 0} personnages • ${s.replicas?.length || 0} répliques`
    })),
    ...directorNotes.map(n => ({
      id: n.id,
      type: 'note',
      title: n.file_name,
      date: new Date(n.created_at),
      icon: n.file_name?.endsWith('.pdf') ? '📕' : '📝',
      detail: n.file_size ? `${(n.file_size / 1024).toFixed(0)} Ko` : ''
    }))
  ].sort((a, b) => b.date - a.date);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      {/* Header utilisateur */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-gold-500 rounded-full 
                          flex items-center justify-center text-3xl">
            🎭
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-display text-white">
              {user?.user_metadata?.full_name || "Comédien"}
            </h1>
            <p className="text-gray-400 text-sm truncate">{user?.email}</p>
            <p className="text-gray-500 text-xs mt-1">
              Membre depuis {new Date(user?.created_at).toLocaleDateString('fr-FR', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-gold-500">{stats.totalScripts}</p>
          <p className="text-gray-400 text-sm">Textes</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-primary-500">{stats.totalReplicas}</p>
          <p className="text-gray-400 text-sm">Répliques</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-500">{stats.totalCharacters}</p>
          <p className="text-gray-400 text-sm">Personnages</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-yellow-500">{stats.totalNotes}</p>
          <p className="text-gray-400 text-sm">Consignes</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("scripts")}
          className={`flex-1 py-2 rounded-lg font-semibold transition text-sm
            ${activeTab === "scripts" 
              ? "bg-primary-700 text-white" 
              : "bg-gray-800 text-gray-400"
            }`}
        >
          📜 Textes ({stats.totalScripts})
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`flex-1 py-2 rounded-lg font-semibold transition text-sm
            ${activeTab === "notes" 
              ? "bg-primary-700 text-white" 
              : "bg-gray-800 text-gray-400"
            }`}
        >
          📁 Consignes ({stats.totalNotes})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 rounded-lg font-semibold transition text-sm
            ${activeTab === "history" 
              ? "bg-primary-700 text-white" 
              : "bg-gray-800 text-gray-400"
            }`}
        >
          📅 Historique
        </button>
      </div>

      {/* Contenu selon l'onglet */}
      <div className="space-y-3 mb-8">
        {activeTab === "scripts" && (
          scripts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun texte importé</p>
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
                    <p className="text-white font-medium truncate">{script.title}</p>
                    <p className="text-gray-500 text-xs">
                      {script.characters?.length || 0} personnages • {script.replicas?.length || 0} répliques
                    </p>
                  </div>
                  <span className="text-gray-500 text-xs">
                    {new Date(script.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === "notes" && (
          directorNotes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune consigne uploadée</p>
          ) : (
            directorNotes.map((note) => (
              <div key={note.id} className="card">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {note.file_name?.endsWith('.pdf') ? '📕' : '📝'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{note.file_name}</p>
                    <p className="text-gray-500 text-xs">
                      {note.file_size ? `${(note.file_size / 1024).toFixed(0)} Ko` : ''}
                    </p>
                  </div>
                  <span className="text-gray-500 text-xs">
                    {new Date(note.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === "history" && (
          history.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune activité</p>
          ) : (
            history.map((item, index) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg"
              >
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{item.title}</p>
                  <p className="text-gray-500 text-xs">{item.detail}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs">
                    {item.date.toLocaleDateString('fr-FR')}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {item.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={() => {
            localStorage.removeItem('replicoach-onboarding-seen');
            window.location.reload();
          }}
          className="w-full p-4 bg-gray-800 hover:bg-primary-900/30 text-gray-400 hover:text-primary-400 
                     rounded-xl transition flex items-center justify-center gap-2"
        >
          📖 Revoir le tutoriel
        </button>
        
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full p-4 bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 
                     rounded-xl transition flex items-center justify-center gap-2"
        >
          🚪 Se déconnecter
        </button>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-800 text-center">
        <p className="text-gray-600 text-xs">
          Fait avec ❤️ pour le Tpt par MLconseil
        </p>
        <p className="text-gray-700 text-xs mt-1">
          RépliCoach v1.0
        </p>
      </div>

      {/* Modal confirmation déconnexion */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl max-w-sm w-full border border-gray-700">
            <div className="p-6 text-center">
              <span className="text-5xl mb-4 block">👋</span>
              <h3 className="text-lg font-semibold text-white mb-2">
                Se déconnecter ?
              </h3>
              <p className="text-gray-400 text-sm">
                Vous pourrez vous reconnecter à tout moment avec votre compte.
              </p>
            </div>

            <div className="p-4 border-t border-gray-700 flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 
                           rounded-full font-semibold flex-1 transition"
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
