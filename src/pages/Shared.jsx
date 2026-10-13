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
import PremiumGateModal from "../components/PremiumGateModal";

const ADMIN_EMAILS = [
  "moz2611@gmail.com",
  "consulting@mauricelargeron.com",
];

export default function Shared() {
  const navigate = useNavigate();
  const { user, isPremium } = useAuthStore();
  const { scripts, fetchScripts } = useScriptStore();

  // Autoriser la création de troupe pour tous les abonnés Premium ou admins
  const canCreateTroupe = user && (isPremium || ADMIN_EMAILS.includes(user.email?.toLowerCase()));

  const [loading, setLoading] = useState(true);
  const [troupes, setTroupes] = useState([]);
  const [sharedScripts, setSharedScripts] = useState([]);
  const [activeTab, setActiveTab] = useState("shared"); // "shared" | "troupes"

  // Modales
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [selectedScript, setSelectedScript] = useState(null);

  // Formulaires
  const [joinCode, setJoinCode] = useState("");
  const [newTroupeName, setNewTroupeName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [createdTroupeCode, setCreatedTroupeCode] = useState(null);
  const [deleteTroupeConfirm, setDeleteTroupeConfirm] = useState(null);
  const [expandedTroupe, setExpandedTroupe] = useState(null);
  const [copyingScriptId, setCopyingScriptId] = useState(null);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [troupesData, sharedData] = await Promise.all([
        fetchUserTroupes(user.id).catch((e) => {
          console.error("Erreur fetchUserTroupes:", e);
          return [];
        }),
        fetchSharedScripts(user.id).catch((e) => {
          console.error("Erreur fetchSharedScripts:", e);
          return [];
        }),
      ]);
      setTroupes(troupesData || []);
      setSharedScripts(sharedData || []);
    } catch (err) {
      console.error("Erreur chargement données Shared:", err);
      setError("Impossible de charger vos troupes et textes partagés.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  // Créer une troupe
  const handleCreateTroupe = async () => {
    if (!newTroupeName.trim() || !user) return;

    if (!canCreateTroupe) {
      setShowPremiumModal(true);
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const newTroupe = await createTroupe(newTroupeName.trim(), user.id);
      setCreatedTroupeCode(newTroupe.code || newTroupe.id);
      setNewTroupeName("");
      setSuccess("Troupe créée avec succès !");
      await loadData();
    } catch (err) {
      console.error("Erreur création troupe:", err);
      setError(err.message || "Erreur lors de la création de la troupe.");
    } finally {
      setActionLoading(false);
    }
  };

  // Rejoindre une troupe
  const handleJoinTroupe = async () => {
    if (!joinCode.trim() || !user) return;
    setActionLoading(true);
    setError(null);

    try {
      await joinTroupe(joinCode.trim(), user.id);
      setSuccess("Vous avez rejoint la troupe !");
      setJoinCode("");
      setShowJoinModal(false);
      await loadData();
    } catch (err) {
      console.error("Erreur rejoindre troupe:", err);
      setError(err.message || "Code de troupe invalide ou erreur de réseau.");
    } finally {
      setActionLoading(false);
    }
  };

  // Quitter une troupe
  const handleLeaveTroupe = async (troupeId) => {
    if (!confirm("Voulez-vous vraiment quitter cette troupe ?") || !user) return;
    try {
      await leaveTroupe(troupeId, user.id);
      await loadData();
    } catch (err) {
      alert("Erreur: " + err.message);
    }
  };

  // Supprimer une troupe
  const handleDeleteTroupe = async () => {
    if (!deleteTroupeConfirm) return;
    setActionLoading(true);
    try {
      await deleteTroupe(deleteTroupeConfirm.id);
      setDeleteTroupeConfirm(null);
      setSuccess("Troupe supprimée !");
      await loadData();
    } catch (err) {
      alert("Erreur: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Supprimer / Retirer un texte partagé
  const handleUnshareScript = async (script, troupeId) => {
    if (!confirm(`Voulez-vous supprimer le partage de "${script.title}" pour cette troupe ?`)) return;
    setActionLoading(true);
    setError(null);
    try {
      await unshareScript(script.id, troupeId);
      setSuccess(`Le partage de "${script.title}" a été supprimé.`);
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Erreur suppression partage:", err);
      setError(err.message || "Erreur lors de la suppression du partage.");
    } finally {
      setActionLoading(false);
    }
  };

  // Copier un texte partagé dans ses propres textes
  const handleCopyScript = async (script, troupeId) => {
    if (!user) return;
    setCopyingScriptId(script.id);
    try {
      await copySharedScript(script.id, troupeId, user.id);
      setSuccess(`Le texte "${script.title}" a été copié dans vos textes personnels !`);
      await fetchScripts(user.id);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Erreur copie script:", err);
      alert("Erreur lors de la copie du texte : " + err.message);
    } finally {
      setCopyingScriptId(null);
    }
  };

  const copyTroupeCode = (code) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setSuccess("Code copié : " + code);
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader size="lg" />
        <p className="text-gray-400 text-sm font-medium animate-pulse">
          Chargement de votre espace troupe...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 pt-4 space-y-6">
      
      {/* EN-TÊTE PRINCIPAL */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2 tracking-tight">
            <span>👥</span> Partage & Troupes
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Répétez en groupe, partagez vos textes et accédez aux consignes de votre metteur en scène.
          </p>
        </div>

        {/* Boutons d'action rapide */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowJoinModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl text-xs sm:text-sm font-bold text-white transition flex items-center justify-center gap-2 shadow-md"
          >
            <span>🔑</span> Rejoindre une troupe
          </button>

          {canCreateTroupe ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
            >
              <span>✨</span> Créer une troupe
            </button>
          ) : (
            <button
              onClick={() => setShowPremiumModal(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 rounded-xl text-xs sm:text-sm font-bold text-purple-200 transition flex items-center justify-center gap-2"
            >
              <span>👑</span> Créer une troupe (Premium)
            </button>
          )}
        </div>
      </div>

      {/* MESSAGES DE SUCCÈS OU D'ERREUR */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/50 rounded-xl flex items-center justify-between text-emerald-300 text-sm font-medium animate-fadeIn">
          <span className="flex items-center gap-2"><span>✅</span> {success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/50 rounded-xl flex items-center justify-between text-rose-300 text-sm font-medium animate-fadeIn">
          <span className="flex items-center gap-2"><span>⚠️</span> {error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* BARRE D'ONGLETS */}
      <div className="flex gap-2 p-1.5 bg-gray-900/90 rounded-2xl border border-gray-800 max-w-xl mx-auto backdrop-blur-sm">
        <button
          onClick={() => setActiveTab("shared")}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === "shared"
              ? "bg-amber-500 text-gray-950 shadow-lg shadow-amber-500/10"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <span>📜</span> Textes partagés ({sharedScripts.length})
        </button>

        <button
          onClick={() => setActiveTab("troupes")}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === "troupes"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <span>🎭</span> Mes Troupes ({troupes.length})
        </button>
      </div>

      {/* CONTENU ONGLET 1 : TEXTES PARTAGÉS */}
      {activeTab === "shared" && (
        <div className="space-y-4">
          {sharedScripts.length === 0 ? (
            <div className="text-center py-12 px-4 bg-gray-900/60 border border-gray-800 rounded-2xl max-w-xl mx-auto space-y-4">
              <span className="text-5xl block">🎭</span>
              <h3 className="text-lg font-bold text-white">Aucun texte partagé pour le moment</h3>
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
                Lorsque votre metteur en scène ou un membre de votre troupe partage un texte, il apparaîtra ici pour vous permettre de le copier dans vos textes personnels.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold border border-gray-700 transition"
                >
                  🔑 Saisir un code de troupe
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedScripts.map((item) => {
                const script = item.scripts || item;
                const troupeName = item.troupe_name || item.troupes?.name || "Troupe";
                const canDeleteShared = user && (
                  ADMIN_EMAILS.includes(user.email?.toLowerCase()) ||
                  isPremium ||
                  item.shared_by === user.id ||
                  script.user_id === user.id ||
                  troupes.some((t) => t.id === item.troupe_id && (t.role === "admin" || t.owner_id === user.id))
                );

                return (
                  <div
                    key={item.id || script.id}
                    className="p-5 bg-gradient-to-br from-gray-900 to-gray-900/90 border border-gray-800 hover:border-amber-500/50 rounded-2xl shadow-xl transition duration-200 flex flex-col justify-between space-y-4 group relative"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-1 bg-purple-900/40 text-purple-300 border border-purple-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          🎭 {troupeName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-mono">
                            {script.replicas?.length || 0} répl.
                          </span>
                          {canDeleteShared && (
                            <button
                              onClick={() => handleUnshareScript(script, item.troupe_id)}
                              className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition"
                              title="Supprimer ce texte partagé"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg font-extrabold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                        {script.title}
                      </h3>

                      <p className="text-gray-400 text-xs mt-1">
                        {script.characters?.length || 0} personnage(s) distribué(s)
                      </p>
                    </div>

                    <button
                      onClick={() => handleCopyScript(script, item.troupe_id)}
                      disabled={copyingScriptId === script.id}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {copyingScriptId === script.id ? (
                        "⏳ Copie en cours..."
                      ) : (
                        <>
                          <span>📥</span> Copier dans mes textes personnels
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENU ONGLET 2 : MES TROUPES */}
      {activeTab === "troupes" && (
        <div className="space-y-6">
          {troupes.length === 0 ? (
            <div className="text-center py-12 px-4 bg-gray-900/60 border border-gray-800 rounded-2xl max-w-xl mx-auto space-y-4">
              <span className="text-5xl block">🎪</span>
              <h3 className="text-lg font-bold text-white">Vous ne faites partie d'aucune troupe</h3>
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
                Rejoignez une troupe existante avec le code fourni par votre metteur en scène, ou créez votre propre troupe.
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-gray-700 transition"
                >
                  🔑 Saisir mon code de troupe
                </button>

                {canCreateTroupe ? (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-extrabold rounded-xl transition shadow-md"
                  >
                    ✨ Créer une nouvelle troupe
                  </button>
                ) : (
                  <button
                    onClick={() => setShowPremiumModal(true)}
                    className="px-4 py-2.5 bg-purple-950 hover:bg-purple-900 border border-purple-500/50 text-purple-200 text-xs font-bold rounded-xl transition"
                  >
                    👑 Créer une troupe (Premium)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {troupes.map((troupe) => {
                const isAdmin = troupe.role === "admin" || troupe.owner_id === user?.id;
                const isExpanded = expandedTroupe === troupe.id;

                return (
                  <div
                    key={troupe.id}
                    className="bg-gray-900/90 border border-gray-800 hover:border-purple-500/40 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl transition"
                  >
                    {/* Entête de la troupe */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">🎭</span>
                          <h3 className="text-xl font-bold text-white">{troupe.name}</h3>
                          {isAdmin && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-bold uppercase">
                              Metteur en scène
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs flex items-center gap-2 mt-1">
                          Code d'invitation : <code className="px-2 py-0.5 bg-black/60 text-amber-400 rounded font-mono font-bold text-xs select-all">{troupe.code}</code>
                          <button
                            onClick={() => copyTroupeCode(troupe.code)}
                            className="text-gray-400 hover:text-amber-400 text-xs underline"
                            title="Copier le code"
                          >
                            Copier
                          </button>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => setExpandedTroupe(isExpanded ? null : troupe.id)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 transition flex items-center gap-1.5"
                        >
                          <span>📁</span>
                          <span>{isExpanded ? "Masquer l'espace" : "Consignes & Médias"}</span>
                        </button>

                        {isAdmin ? (
                          <button
                            onClick={() => setDeleteTroupeConfirm(troupe)}
                            className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-xl transition"
                            title="Supprimer la troupe"
                          >
                            🗑️
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLeaveTroupe(troupe.id)}
                            className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl transition"
                          >
                            Quitter
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Section repliable des consignes et vidéos de la troupe */}
                    {isExpanded && (
                      <div className="space-y-6 pt-2 border-t border-gray-800/80 animate-fadeIn">
                        <TroupeDocuments troupeId={troupe.id} userId={user?.id} troupeName={troupe.name} />
                        <TroupeVideos troupeId={troupe.id} userId={user?.id} troupeName={troupe.name} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODALE REJOINDRIA TROUPE */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🔑</span> Rejoindre une troupe
              </h3>
              <button onClick={() => setShowJoinModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <p className="text-gray-300 text-xs leading-relaxed">
              Saisissez le code d'invitation à 8 caractères fourni par votre metteur en scène pour accéder aux textes distribués et aux consignes de jeu.
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Code de troupe *
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Ex: TRP8X2A1"
                className="w-full bg-gray-800 border border-gray-600 focus:border-amber-500 rounded-xl p-3.5 text-white font-mono text-center tracking-widest text-lg focus:outline-none transition uppercase"
                autoFocus
                maxLength={10}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl transition"
              >
                Annuler
              </button>
              <button
                onClick={handleJoinTroupe}
                disabled={!joinCode.trim() || actionLoading}
                className={`flex-1 py-3 font-extrabold text-xs rounded-xl transition shadow-lg ${
                  joinCode.trim() && !actionLoading
                    ? "bg-amber-500 hover:bg-amber-400 text-gray-950 shadow-amber-500/20"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                }`}
              >
                {actionLoading ? "⏳ Vérification..." : "Rejoindre →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CRÉATION TROUPE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>✨</span> Créer une troupe
              </h3>
              <button onClick={() => { setShowCreateModal(false); setCreatedTroupeCode(null); }} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {createdTroupeCode ? (
              <div className="space-y-4 text-center py-2">
                <span className="text-4xl block">🎉</span>
                <h4 className="text-base font-bold text-emerald-400">Troupe créée avec succès !</h4>
                <p className="text-gray-300 text-xs">Voici votre code d'invitation à transmettre à vos comédiens :</p>
                <div className="p-4 bg-black/60 border border-amber-500/50 rounded-xl flex items-center justify-between gap-2">
                  <code className="text-2xl font-mono font-bold text-amber-400 tracking-widest">{createdTroupeCode}</code>
                  <button
                    onClick={() => copyTroupeCode(createdTroupeCode)}
                    className="px-3 py-1.5 bg-amber-500 text-gray-950 font-bold text-xs rounded-lg hover:bg-amber-400 transition"
                  >
                    Copier
                  </button>
                </div>
                <button
                  onClick={() => { setShowCreateModal(false); setCreatedTroupeCode(null); }}
                  className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs rounded-xl transition mt-2"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <p className="text-gray-300 text-xs leading-relaxed">
                  En tant que metteur en scène ou abonné Premium, vous pouvez créer une troupe pour distribuer des textes et partager des consignes de jeu.
                </p>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Nom de la troupe *
                  </label>
                  <input
                    type="text"
                    value={newTroupeName}
                    onChange={(e) => setNewTroupeName(e.target.value)}
                    placeholder="Ex: Troupe du Théâtre Molière"
                    className="w-full bg-gray-800 border border-gray-600 focus:border-amber-500 rounded-xl p-3.5 text-white text-sm focus:outline-none transition"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCreateTroupe}
                    disabled={!newTroupeName.trim() || actionLoading}
                    className={`flex-1 py-3 font-extrabold text-xs rounded-xl transition shadow-lg ${
                      newTroupeName.trim() && !actionLoading
                        ? "bg-amber-500 hover:bg-amber-400 text-gray-950 shadow-amber-500/20"
                        : "bg-gray-800 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {actionLoading ? "⏳ Création..." : "Créer la troupe →"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION DE SUPPRESSION DE TROUPE */}
      {deleteTroupeConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Supprimer {deleteTroupeConfirm.name} ?</h3>
            <p className="text-rose-400 text-xs leading-relaxed">
              ⚠️ Cette action est irréversible. Tous les partages et documents associés à cette troupe seront supprimés.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteTroupeConfirm(null)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl transition"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteTroupe}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl transition shadow-lg shadow-rose-600/20"
              >
                {actionLoading ? "⏳..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE PAYWALL PREMIUM */}
      {showPremiumModal && (
        <PremiumGateModal
          featureKey="DIRECTOR_ADVANCED"
          onClose={() => setShowPremiumModal(false)}
        />
      )}

    </div>
  );
}
