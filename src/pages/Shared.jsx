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
  deleteTroupe,
  shareScript,
  unshareScript,
  copySharedScript,
  isUserTroupeAdmin,
} from "../lib/supabase";
import Loader from "../components/ui/Loader";
import TroupeDocuments from "../components/TroupeDocuments";
import TroupeVideos from "../components/TroupeVideos";

/**
 * Page des textes partagés et gestion des troupes
 */

// Liste des emails autorisés à créer des troupes (metteur en scène + dev)
const ADMIN_EMAILS = [
  'moz2611@gmail.com',  // Moz - développeur
  // Ajoute ici les emails des metteurs en scène
];

function Shared() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { scripts, fetchScripts } = useScriptStore();
  
  // Vérifie si l'utilisateur peut créer des troupes
  const canCreateTroupe = user && ADMIN_EMAILS.includes(user.email?.toLowerCase());
  
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
  const [createdTroupeCode, setCreatedTroupeCode] = useState(null);
  const [deleteTroupeConfirm, setDeleteTroupeConfirm] = useState(null);
  const [expandedTroupe, setExpandedTroupe] = useState(null); // Pour voir les consignes

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
      const newTroupe = await createTroupe(newTroupeName.trim(), user.id);
      // Afficher le code généré
      setCreatedTroupeCode(newTroupe.code);
      setNewTroupeName("");
      loadData();
    } catch (err) {
      setError(err.message || "Erreur lors de la création");
    } finally {
      setActionLoading(false);
    }
  };

  // Fermer le modal de création et reset
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreatedTroupeCode(null);
    setNewTroupeName("");
    setError(null);
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

  // Supprimer une troupe
  const handleDeleteTroupe = async () => {
    if (!deleteTroupeConfirm) return;
    
    setActionLoading(true);
    try {
      await deleteTroupe(deleteTroupeConfirm.id);
      setDeleteTroupeConfirm(null);
      setSuccess("Troupe supprimée !");
      setTimeout(() => setSuccess(null), 2000);
      loadData();
    } catch (err) {
      alert("Erreur: " + err.message);
    } finally {
      setActionLoading(false);
    }
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
              <p className="text-sm text-gray-400 mb-2">
                💡 Copiez un texte pour le personnaliser sans affecter l'original
              </p>
              {sharedScripts.map((item) => (
                <div
                  key={item.id}
                  className="card hover:border-primary-500 transition"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="flex-1 flex items-center gap-4 cursor-pointer"
                      onClick={() => navigate(`/script/${item.scripts?.id}`)}
                    >
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
                    </div>
                    
                    {/* Bouton copier */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm('Créer une copie personnelle de ce texte ?')) return;
                        setActionLoading(true);
                        try {
                          const newScript = await copySharedScript(
                            item.scripts?.id, 
                            item.troupe_id, 
                            user.id
                          );
                          setSuccess('Copie créée ! Retrouvez-la dans "Mes textes"');
                          setTimeout(() => navigate('/'), 1500);
                        } catch (err) {
                          setError('Erreur lors de la copie: ' + err.message);
                        }
                        setActionLoading(false);
                      }}
                      disabled={actionLoading}
                      className="p-2 bg-gold-500 hover:bg-gold-400 text-dark rounded-lg 
                                 font-semibold text-sm transition disabled:opacity-50"
                      title="Créer ma copie personnelle"
                    >
                      📋 Copier
                    </button>
                    
                    <span 
                      className="text-gray-500 cursor-pointer"
                      onClick={() => navigate(`/script/${item.scripts?.id}`)}
                    >
                      →
                    </span>
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
          {/* ===== BOUTONS D'ACTION PLUS VISIBLES ===== */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Bouton Rejoindre */}
            <button
              onClick={() => setShowJoinModal(true)}
              className="p-4 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-600 
                         hover:border-primary-500 transition flex flex-col items-center gap-2"
            >
              <span className="text-3xl">🔑</span>
              <span className="text-gray-300 font-medium">Rejoindre</span>
              <span className="text-gray-500 text-xs">Avec un code</span>
            </button>
            
            {/* ===== BOUTON CRÉER - SEULEMENT POUR ADMINS ===== */}
            {canCreateTroupe ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-4 bg-gold-500 hover:bg-gold-400 rounded-xl 
                           transition flex flex-col items-center gap-2 shadow-lg shadow-gold-500/20"
              >
                <span className="text-3xl">➕</span>
                <span className="text-dark font-bold">Créer</span>
                <span className="text-dark/70 text-xs">Nouvelle troupe</span>
              </button>
            ) : (
              <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 
                              flex flex-col items-center gap-2 opacity-50">
                <span className="text-3xl">🔒</span>
                <span className="text-gray-400 font-medium">Créer</span>
                <span className="text-gray-500 text-xs">Réservé au metteur en scène</span>
              </div>
            )}
          </div>

          {/* Liste des troupes */}
          {troupes.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-5xl mb-4 block">🎭</span>
              <p className="text-gray-400">Vous n'êtes dans aucune troupe</p>
              <p className="text-gray-500 text-sm mt-2">
                Demandez le code à votre metteur en scène pour rejoindre !
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {troupes.map((troupe) => (
                <div key={troupe.id} className="bg-gray-800/80 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gold-500/20 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">🎭</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{troupe.name}</h3>
                        <p className="text-gray-500 text-xs">
                          {troupe.role === 'owner' ? '👑 Créateur' : '👤 Membre'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Code de la troupe - PLUS VISIBLE */}
                      <button
                        onClick={() => copyTroupeCode(troupe.code)}
                        className="px-4 py-2 bg-primary-600/30 hover:bg-primary-600/50 rounded-lg 
                                   text-sm font-mono text-primary-300 border border-primary-500/30
                                   hover:border-primary-500 transition flex items-center gap-2"
                        title="Cliquer pour copier le code"
                      >
                        <span>📋</span>
                        <span>{troupe.code}</span>
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
                      
                      {/* Supprimer (si owner) */}
                      {troupe.role === 'owner' && (
                        <button
                          onClick={() => setDeleteTroupeConfirm(troupe)}
                          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                          title="Supprimer la troupe"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Bouton voir consignes */}
                  <button
                    onClick={() => setExpandedTroupe(expandedTroupe === troupe.id ? null : troupe.id)}
                    className="mt-3 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg 
                               text-sm text-gray-300 transition flex items-center justify-center gap-2"
                  >
                    <span>📋</span>
                    <span>Consignes & Vidéos</span>
                    <span>{expandedTroupe === troupe.id ? '▲' : '▼'}</span>
                  </button>
                  
                  {/* Section consignes et vidéos expandable */}
                  {expandedTroupe === troupe.id && (
                    <div className="mt-4 pt-4 border-t border-gray-700 space-y-6">
                      {/* Documents */}
                      <TroupeDocuments 
                        troupeId={troupe.id}
                        userId={user.id}
                        troupeName={troupe.name}
                      />
                      
                      {/* Vidéos YouTube */}
                      <div className="pt-4 border-t border-gray-700">
                        <TroupeVideos 
                          troupeId={troupe.id}
                          userId={user.id}
                          troupeName={troupe.name}
                        />
                      </div>
                    </div>
                  )}
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

      {/* Modal: Créer une troupe - AVEC AFFICHAGE DU CODE */}
      {showCreateModal && (
        <Modal onClose={closeCreateModal}>
          {createdTroupeCode ? (
            // ===== ÉCRAN DE SUCCÈS AVEC LE CODE =====
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                <span className="text-5xl">✓</span>
              </div>
              
              <h3 className="text-xl font-semibold text-white mb-2">
                Troupe créée !
              </h3>
              
              <p className="text-gray-400 mb-6">
                Partagez ce code avec les membres de votre troupe :
              </p>
              
              {/* CODE EN GRAND */}
              <div className="bg-primary-600/20 border-2 border-primary-500 rounded-xl p-6 mb-6">
                <p className="text-4xl font-mono font-bold text-primary-300 tracking-widest">
                  {createdTroupeCode}
                </p>
              </div>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdTroupeCode);
                  setSuccess("Code copié !");
                  setTimeout(() => setSuccess(null), 2000);
                }}
                className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl 
                           font-semibold transition flex items-center justify-center gap-2 mb-4"
              >
                📋 Copier le code
              </button>
              
              {success && (
                <p className="text-green-400 text-sm mb-4">{success}</p>
              )}
              
              <button
                onClick={closeCreateModal}
                className="btn-secondary w-full"
              >
                Terminé
              </button>
            </div>
          ) : (
            // ===== FORMULAIRE DE CRÉATION =====
            <>
              <h3 className="text-lg font-semibold text-white mb-4">
                ➕ Créer une troupe
              </h3>
              
              <p className="text-gray-400 text-sm mb-4">
                Donnez un nom à votre troupe. Un code unique sera généré automatiquement.
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
                  onClick={closeCreateModal}
                  className="btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateTroupe}
                  className="btn-gold flex-1"
                  disabled={!newTroupeName.trim() || actionLoading}
                >
                  {actionLoading ? "Création..." : "✓ Créer"}
                </button>
              </div>
            </>
          )}
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

      {/* Modal: Confirmer suppression troupe */}
      {deleteTroupeConfirm && (
        <Modal onClose={() => setDeleteTroupeConfirm(null)}>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <span className="text-4xl">🗑️</span>
            </div>
            
            <h3 className="text-xl font-semibold text-white mb-2">
              Supprimer la troupe ?
            </h3>
            
            <p className="text-gray-400 mb-2">
              <strong className="text-white">{deleteTroupeConfirm.name}</strong>
            </p>
            
            <p className="text-red-400 text-sm mb-6">
              ⚠️ Cette action est irréversible. Tous les membres seront retirés.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTroupeConfirm(null)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteTroupe}
                disabled={actionLoading}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white 
                           px-6 py-3 rounded-full font-semibold transition"
              >
                {actionLoading ? "..." : "🗑️ Supprimer"}
              </button>
            </div>
          </div>
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
