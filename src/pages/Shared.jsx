import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useScriptStore } from "../store/scriptStore";
import {
  fetchUserTroupes,
  fetchSharedScripts,
  createTroupe,
  joinTroupe,
  leaveTroupe,
  shareScript,
  unshareScript,
} from "../lib/supabase";
import Loader from "../components/ui/Loader";

/**
 * Page des textes partagés et gestion des troupes
 */
function Shared() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { scripts, fetchScripts } = useScriptStore();
  
  const [loading, setLoading] = useState(true);
  const [troupes, setTroupes] = useState([]);
  const [sharedScripts, setSharedScripts] = useState([]);
  const [activeTab, setActiveTab] = useState("shared"); // shared, troupes, share
  
  // Modals
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedScript, setSelectedScript] = useState(null);
  
  // États des formulaires
  const [joinCode, setJoinCode] = useState("");
  const [newTroupeName, setNewTroupeName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Charger les troupes de l'utilisateur
      const userTroupes = await fetchUserTroupes(user.id);
      setTroupes(userTroupes || []);
      
      // Charger les scripts partagés
      const shared = await fetchSharedScripts(user.id);
      setSharedScripts(shared || []);
      
      // Charger les scripts de l'utilisateur (pour pouvoir les partager)
      await fetchScripts(user.id);
    } catch (err) {
      console.error("Erreur chargement données:", err);
      // Les tables n'existent peut-être pas encore
      setTroupes([]);
      setSharedScripts([]);
    } finally {
      setLoading(false);
    }
  };

  // Créer une troupe
  const handleCreateTroupe = async () => {
    if (!newTroupeName.trim()) return;
    
    setActionLoading(true);
    setError(null);
    
    try {
      await createTroupe(newTroupeName.trim(), user.id);
      setSuccess("Troupe créée avec succès !");
      setNewTroupeName("");
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      setError(err.message || "Erreur lors de la création");
    } finally {
      setActionLoading(false);
    }
  };

  // Rejoindre une troupe
  const handleJoinTroupe = async () => {
    if (!joinCode.trim()) return;
    
    setActionLoading(true);
    setError(null);
    
    try {
      await joinTroupe(joinCode.trim(), user.id);
      setSuccess("Vous avez rejoint la troupe !");
      setJoinCode("");
      setShowJoinModal(false);
      loadData();
    } catch (err) {
      setError(err.message || "Code invalide ou erreur");
    } finally {
      setActionLoading(false);
    }
  };

  // Quitter une troupe
  const handleLeaveTroupe = async (troupeId) => {
    if (!confirm("Voulez-vous vraiment quitter cette troupe ?")) return;
    
    try {
      await leaveTroupe(troupeId, user.id);
      loadData();
    } catch (err) {
      alert("Erreur: " + err.message);
    }
  };

  // Partager un script
  const handleShareScript = async (scriptId, troupeId) => {
    setActionLoading(true);
    setError(null);
    
    try {
      await shareScript(scriptId, troupeId, user.id);
      setSuccess("Texte partagé avec succès !");
      setShowShareModal(false);
      loadData();
    } catch (err) {
      setError(err.message || "Erreur lors du partage");
    } finally {
      setActionLoading(false);
    }
  };

  // Copier le code de la troupe
  const copyTroupeCode = (code) => {
    navigator.clipboard.writeText(code);
    setSuccess("Code copié : " + code);
    setTimeout(() => setSuccess(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-display text-gold-500 mb-4">
        👥 Partage
      </h1>

      {/* Messages */}
      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500 rounded-lg">
          <p className="text-green-400 text-sm">{success}</p>
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("shared")}
          className={`flex-1 py-2 rounded-lg font-semibold transition text-sm
            ${activeTab === "shared" 
              ? "bg-primary-700 text-white" 
              : "bg-gray-800 text-gray-400"
            }`}
        >
          📜 Reçus ({sharedScripts.length})
        </button>
        <button
          onClick={() => setActiveTab("troupes")}
          className={`flex-1 py-2 rounded-lg font-semibold transition text-sm
            ${activeTab === "troupes" 
              ? "bg-primary-700 text-white" 
              : "bg-gray-800 text-gray-400"
            }`}
        >
          🎭 Troupes ({troupes.length})
        </button>
        <button
          onClick={() => setActiveTab("share")}
          className={`flex-1 py-2 rounded-lg font-semibold transition text-sm
            ${activeTab === "share" 
              ? "bg-primary-700 text-white" 
              : "bg-gray-800 text-gray-400"
            }`}
        >
          📤 Partager
        </button>
      </div>

      {/* TAB: Scripts reçus */}
      {activeTab === "shared" && (
        <div>
          {sharedScripts.length === 0 ? (
            <EmptySharedState onJoin={() => setShowJoinModal(true)} />
          ) : (
            <div className="space-y-3">
              {sharedScripts.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/script/${item.scripts?.id}`)}
                  className="card cursor-pointer hover:border-primary-500 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">📜</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">
                        {item.scripts?.title || "Sans titre"}
                      </h3>
                      <p className="text-gray-500 text-sm">
                        via {item.troupes?.name} • {item.scripts?.characters?.length || 0} personnages
                      </p>
                    </div>
                    <span className="text-gray-500">→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Mes troupes */}
      {activeTab === "troupes" && (
        <div>
          {/* Boutons d'action */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex-1 p-3 bg-gray-800 hover:bg-gray-700 rounded-xl border-2 border-dashed 
                         border-gray-600 hover:border-primary-500 transition flex items-center justify-center gap-2"
            >
              <span>🔑</span>
              <span className="text-gray-300 text-sm">Rejoindre</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 p-3 bg-gray-800 hover:bg-gray-700 rounded-xl border-2 border-dashed 
                         border-gray-600 hover:border-gold-500 transition flex items-center justify-center gap-2"
            >
              <span>➕</span>
              <span className="text-gray-300 text-sm">Créer</span>
            </button>
          </div>

          {/* Liste des troupes */}
          {troupes.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-5xl mb-4 block">🎭</span>
              <p className="text-gray-400">Vous n'êtes dans aucune troupe</p>
              <p className="text-gray-500 text-sm mt-1">
                Rejoignez une troupe ou créez la vôtre !
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {troupes.map((troupe) => (
                <div key={troupe.id} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-xl">🎭</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{troupe.name}</h3>
                        <p className="text-gray-500 text-xs">
                          {troupe.role === 'owner' ? '👑 Créateur' : '👤 Membre'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Code de la troupe */}
                      <button
                        onClick={() => copyTroupeCode(troupe.code)}
                        className="px-3 py-1 bg-gray-700 rounded-lg text-xs font-mono text-gray-300 
                                   hover:bg-gray-600 transition"
                        title="Cliquer pour copier"
                      >
                        {troupe.code}
                      </button>
                      
                      {/* Quitter (si pas owner) */}
                      {troupe.role !== 'owner' && (
                        <button
                          onClick={() => handleLeaveTroupe(troupe.id)}
                          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                          title="Quitter la troupe"
                        >
                          🚪
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Partager mes textes */}
      {activeTab === "share" && (
        <div>
          {troupes.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-5xl mb-4 block">🎭</span>
              <p className="text-gray-400 mb-4">Rejoignez d'abord une troupe</p>
              <button
                onClick={() => setActiveTab("troupes")}
                className="btn-gold"
              >
                Gérer mes troupes
              </button>
            </div>
          ) : scripts.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-5xl mb-4 block">📄</span>
              <p className="text-gray-400 mb-4">Aucun texte à partager</p>
              <Link to="/upload" className="btn-gold">
                Importer un texte
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {scripts.map((script) => (
                <div key={script.id} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📜</span>
                      <div>
                        <h3 className="font-semibold text-white">{script.title}</h3>
                        <p className="text-gray-500 text-xs">
                          {script.characters?.length || 0} personnages
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        setSelectedScript(script);
                        setShowShareModal(true);
                      }}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white 
                                 rounded-lg text-sm font-medium transition"
                    >
                      📤 Partager
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Rejoindre une troupe */}
      {showJoinModal && (
        <Modal onClose={() => setShowJoinModal(false)}>
          <h3 className="text-lg font-semibold text-white mb-4">
            🔑 Rejoindre une troupe
          </h3>
          
          <p className="text-gray-400 text-sm mb-4">
            Entrez le code de la troupe (8 caractères)
          </p>
          
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABCD1234"
            className="input w-full text-center text-lg tracking-widest uppercase mb-4"
            maxLength={8}
            autoFocus
          />

          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowJoinModal(false)}
              className="btn-secondary flex-1"
            >
              Annuler
            </button>
            <button
              onClick={handleJoinTroupe}
              className="btn-gold flex-1"
              disabled={joinCode.length < 8 || actionLoading}
            >
              {actionLoading ? "..." : "Rejoindre"}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Créer une troupe */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)}>
          <h3 className="text-lg font-semibold text-white mb-4">
            ➕ Créer une troupe
          </h3>
          
          <p className="text-gray-400 text-sm mb-4">
            Donnez un nom à votre troupe
          </p>
          
          <input
            type="text"
            value={newTroupeName}
            onChange={(e) => setNewTroupeName(e.target.value)}
            placeholder="Ex: Troupe du Théâtre Municipal"
            className="input w-full mb-4"
            maxLength={50}
            autoFocus
          />

          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateModal(false)}
              className="btn-secondary flex-1"
            >
              Annuler
            </button>
            <button
              onClick={handleCreateTroupe}
              className="btn-gold flex-1"
              disabled={!newTroupeName.trim() || actionLoading}
            >
              {actionLoading ? "..." : "Créer"}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Partager un script */}
      {showShareModal && selectedScript && (
        <Modal onClose={() => setShowShareModal(false)}>
          <h3 className="text-lg font-semibold text-white mb-4">
            📤 Partager "{selectedScript.title}"
          </h3>
          
          <p className="text-gray-400 text-sm mb-4">
            Choisissez une troupe :
          </p>
          
          <div className="space-y-2 mb-4">
            {troupes.map((troupe) => (
              <button
                key={troupe.id}
                onClick={() => handleShareScript(selectedScript.id, troupe.id)}
                disabled={actionLoading}
                className="w-full p-3 bg-gray-800 hover:bg-primary-600 rounded-lg 
                           text-left transition flex items-center justify-between"
              >
                <span className="text-white">{troupe.name}</span>
                <span className="text-gray-500">→</span>
              </button>
            ))}
          </div>

          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}

          <button
            onClick={() => setShowShareModal(false)}
            className="btn-secondary w-full"
          >
            Annuler
          </button>
        </Modal>
      )}
    </div>
  );
}

/**
 * État vide - Aucun script partagé
 */
function EmptySharedState({ onJoin }) {
  return (
    <div className="text-center py-8">
      <div className="w-24 h-24 mx-auto mb-6 bg-gray-800 rounded-full flex items-center justify-center">
        <span className="text-5xl">📭</span>
      </div>
      
      <h2 className="text-xl font-semibold text-white mb-2">
        Aucun texte partagé
      </h2>
      
      <p className="text-gray-400 mb-6 max-w-sm mx-auto">
        Rejoignez une troupe pour recevoir des textes partagés par vos camarades.
      </p>

      <button onClick={onJoin} className="btn-gold">
        🔑 Rejoindre une troupe
      </button>

      <div className="mt-8 bg-gray-800/50 rounded-xl p-6 max-w-md mx-auto text-left">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          💡 Comment ça marche ?
        </h3>
        <ul className="text-gray-400 text-sm space-y-3">
          <li className="flex items-start gap-2">
            <span className="text-gold-500">1.</span>
            <span>Demandez le code de votre troupe au metteur en scène</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-500">2.</span>
            <span>Entrez le code pour rejoindre la troupe</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-500">3.</span>
            <span>Recevez les textes partagés par les membres</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Composant Modal réutilisable
 */
function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark rounded-xl max-w-sm w-full border border-gray-700 p-6">
        {children}
      </div>
    </div>
  );
}

export default Shared;
