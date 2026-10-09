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
  copySharedScript,
  getUserRole,
} from "../lib/supabase";
import Loader from "../components/ui/Loader";
import TroupeDocuments from "../components/TroupeDocuments";
import TroupeVideos from "../components/TroupeVideos";

// Liste des emails autorisés à créer des troupes
const ADMIN_EMAILS = ["moz2611@gmail.com", "consulting@mauricelargeron.com"];

function Shared() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { scripts, fetchScripts } = useScriptStore();

  const [userRole, setUserRole] = useState("member");
  const [loading, setLoading] = useState(true);
  const [troupes, setTroupes] = useState([]);
  const [sharedScripts, setSharedScripts] = useState([]);
  const [activeTab, setActiveTab] = useState("shared"); // shared, troupes, share

  // Modals
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
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

  // Mode sélection pour copie en lot
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedScripts, setSelectedScripts] = useState([]);

  // 🔒 Seuls Metteur en scène (director), Dev, Admin et e-mails autorisés créent des troupes
  const canCreateTroupe =
    userRole === "director" ||
    userRole === "dev" ||
    userRole === "admin" ||
    (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const role = await getUserRole(user.id);
      setUserRole(role);

      const userTroupes = await fetchUserTroupes(user.id);
      setTroupes(userTroupes || []);

      const shared = await fetchSharedScripts(user.id);
      setSharedScripts(shared || []);

      await fetchScripts(user.id);
    } catch (err) {
      console.error("Erreur chargement données Shared:", err);
      setTroupes([]);
      setSharedScripts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTroupe = async () => {
    if (!joinCode.trim() || !user) return;
    setActionLoading(true);
    setError(null);
    try {
      await joinTroupe(joinCode.trim(), user.id);
      setSuccess("Vous avez rejoint la troupe !");
      setJoinCode("");
      setShowJoinModal(false);
      loadData();
    } catch (err) {
      setError(err.message || "Impossible de rejoindre cette troupe");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTroupe = async () => {
    if (!newTroupeName.trim() || !user) return;
    setActionLoading(true);
    setError(null);
    try {
      const troupe = await createTroupe(newTroupeName.trim(), user.id);
      setCreatedTroupeCode(troupe.code);
      setNewTroupeName("");
      loadData();
    } catch (err) {
      setError(err.message || "Erreur lors de la création");
    } finally {
      setActionLoading(false);
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreatedTroupeCode(null);
    setNewTroupeName("");
    setError(null);
  };

  const handleLeaveTroupe = async (troupeId) => {
    if (!confirm("Voulez-vous vraiment quitter cette troupe ?")) return;
    try {
      await leaveTroupe(troupeId, user.id);
      loadData();
    } catch (err) {
      alert("Erreur: " + err.message);
    }
  };

  const handleDeleteTroupe = async () => {
    if (!deleteTroupeConfirm) return;
    setActionLoading(true);
    try {
      await deleteTroupe(deleteTroupeConfirm.id);
      setDeleteTroupeConfirm(null);
      loadData();
    } catch (err) {
      alert("Erreur lors de la suppression: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

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

  const copyTroupeCode = (code) => {
    navigator.clipboard.writeText(code);
    setSuccess("Code copié : " + code);
    setTimeout(() => setSuccess(null), 2000);
  };

  const toggleScriptSelection = (scriptId) => {
    setSelectedScripts((prev) =>
      prev.includes(scriptId)
        ? prev.filter((id) => id !== scriptId)
        : [...prev, scriptId],
    );
  };

  const handleBulkCopy = async () => {
    if (selectedScripts.length === 0) return;
    const count = selectedScripts.length;
    if (
      !confirm(
        `Copier ${count} texte${count > 1 ? "s" : ""} dans "Mes textes" ?`,
      )
    )
      return;

    setActionLoading(true);
    setError(null);
    let successCount = 0;
    let errorCount = 0;

    for (const scriptId of selectedScripts) {
      try {
        const item = sharedScripts.find((s) => s.scripts?.id === scriptId);
        if (!item) continue;
        await copySharedScript(item.scripts.id, item.troupe_id, user.id);
        successCount++;
      } catch (err) {
        console.error("Erreur copie script:", scriptId, err);
        errorCount++;
      }
    }

    await fetchScripts(user.id);

    if (errorCount === 0) {
      setSuccess(
        `✅ ${successCount} texte${successCount > 1 ? "s" : ""} copié${successCount > 1 ? "s" : ""} avec succès !`,
      );
    } else {
      setError(
        `⚠️ ${successCount} copié${successCount > 1 ? "s" : ""}, ${errorCount} erreur${errorCount > 1 ? "s" : ""}`,
      );
    }

    setSelectedScripts([]);
    setSelectionMode(false);
    setActionLoading(false);

    setTimeout(() => {
      setSuccess(null);
      setError(null);
    }, 3000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto">
      <h1 className="text-2xl font-display text-gold-500 mb-4">
        👥 Partage & Troupes
      </h1>

      {/* Messages */}
      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500 rounded-lg">
          <p className="text-green-400 text-sm">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg flex justify-between items-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-300 text-xs underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("shared")}
          className={`flex-1 py-2.5 rounded-xl font-semibold transition text-sm ${
            activeTab === "shared"
              ? "bg-primary-700 text-white"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          📜 Reçus ({sharedScripts.length})
        </button>
        <button
          onClick={() => setActiveTab("troupes")}
          className={`flex-1 py-2.5 rounded-xl font-semibold transition text-sm ${
            activeTab === "troupes"
              ? "bg-primary-700 text-white"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          🎭 Troupes ({troupes.length})
        </button>
        <button
          onClick={() => setActiveTab("share")}
          className={`flex-1 py-2.5 rounded-xl font-semibold transition text-sm ${
            activeTab === "share"
              ? "bg-primary-700 text-white"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          📤 Partager
        </button>
      </div>

      {/* TAB 1: Scripts reçus */}
      {activeTab === "shared" && (
        <div>
          {sharedScripts.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/40 rounded-2xl p-6 border border-gray-700/50">
              <span className="text-5xl block mb-3">🎭</span>
              <h3 className="text-white font-bold text-lg mb-2">
                Aucun texte partagé pour l'instant
              </h3>
              <p className="text-gray-400 text-xs mb-6 max-w-md mx-auto">
                Rejoignez une troupe de théâtre avec le code transmis par votre
                metteur en scène pour accéder immédiatement aux pièces
                partagées.
              </p>
              <button
                onClick={() => setShowJoinModal(true)}
                className="btn-gold"
              >
                🔑 Saisir mon code de troupe
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400">
                  💡 Copiez un texte pour le personnaliser sans affecter
                  l'original
                </p>
                {!selectionMode ? (
                  <button
                    onClick={() => setSelectionMode(true)}
                    className="px-3 py-1.5 bg-primary-600 hover:bg-primary-500 rounded-lg text-xs font-medium transition"
                  >
                    ☑️ Sélectionner
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectionMode(false);
                        setSelectedScripts([]);
                      }}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium transition"
                    >
                      Annuler
                    </button>
                    {selectedScripts.length > 0 && (
                      <button
                        onClick={handleBulkCopy}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-gold-500 hover:bg-gold-400 text-dark rounded-lg text-xs font-bold transition disabled:opacity-50"
                      >
                        📋 Copier ({selectedScripts.length})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {sharedScripts.map((item) => (
                <div
                  key={item.id}
                  className={`card transition ${
                    selectionMode && selectedScripts.includes(item.scripts?.id)
                      ? "border-gold-500 bg-gold-500/5"
                      : "hover:border-primary-500"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {selectionMode && (
                      <div className="flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={selectedScripts.includes(item.scripts?.id)}
                          onChange={() =>
                            toggleScriptSelection(item.scripts?.id)
                          }
                          className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-gold-500 cursor-pointer"
                        />
                      </div>
                    )}

                    <div
                      className="flex-1 flex items-center gap-4 cursor-pointer"
                      onClick={() =>
                        !selectionMode &&
                        navigate(`/script/${item.scripts?.id}`)
                      }
                    >
                      <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-2xl">📜</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">
                          {item.scripts?.title || "Sans titre"}
                        </h3>
                        <p className="text-gray-500 text-xs">
                          via {item.troupes?.name} •{" "}
                          {item.scripts?.characters?.length || 0} personnages
                        </p>
                      </div>
                    </div>

                    {!selectionMode && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (
                            !confirm(
                              "Créer une copie personnelle de ce texte ?",
                            )
                          )
                            return;
                          setActionLoading(true);
                          setError(null);
                          try {
                            await copySharedScript(
                              item.scripts?.id,
                              item.troupe_id,
                              user.id,
                            );
                            await fetchScripts(user.id);
                            setSuccess(
                              'Copie créée ! Retrouvez-la dans "Mes textes"',
                            );
                            setTimeout(() => navigate("/"), 1200);
                          } catch (err) {
                            setError(
                              "Erreur lors de la copie : " +
                                (err.message || "Erreur"),
                            );
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        disabled={actionLoading}
                        className="p-2 bg-gold-500 hover:bg-gold-400 text-dark rounded-lg font-semibold text-xs transition disabled:opacity-50"
                        title="Créer ma copie personnelle"
                      >
                        📋 Copier
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Mes troupes */}
      {activeTab === "troupes" && (
        <div>
          {/* Bloc d'action pour rejoindre */}
          <div className="p-4 bg-gray-800/90 rounded-2xl border border-primary-500/30 mb-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🔑</span>
              <div>
                <h2 className="text-white font-bold text-base">
                  Rejoindre une troupe
                </h2>
                <p className="text-gray-400 text-xs">
                  Saisissez le code de troupe à 8 caractères transmis par votre
                  metteur en scène
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowJoinModal(true)}
              className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
            >
              <span>🔑 Saisir mon code de troupe</span>
            </button>
          </div>

          {/* Option réservée au Metteur en Scène / Dev */}
          {canCreateTroupe && (
            <div className="mb-6 p-4 bg-gold-500/10 border border-gold-500/30 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-gold-400 font-bold text-sm">
                  Espace Metteur en Scène
                </p>
                <p className="text-gray-400 text-xs">
                  Créer et gérer une nouvelle troupe
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-gold py-2 px-4 text-xs"
              >
                ➕ Créer une troupe
              </button>
            </div>
          )}

          {/* Liste des troupes de l'utilisateur */}
          {troupes.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-5xl mb-4 block">🎭</span>
              <p className="text-gray-400">
                Vous n'êtes dans aucune troupe pour le moment
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {troupes.map((troupe) => (
                <div
                  key={troupe.id}
                  className="bg-gray-800/80 rounded-xl p-4 border border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gold-500/20 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">🎭</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">
                          {troupe.name}
                        </h3>
                        <p className="text-gray-500 text-xs">
                          {troupe.role === "owner"
                            ? "👑 Créateur"
                            : "👤 Membre"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyTroupeCode(troupe.code)}
                        className="px-3 py-1.5 bg-primary-600/30 hover:bg-primary-600/50 rounded-lg text-xs font-mono text-primary-300 border border-primary-500/30 transition flex items-center gap-1.5"
                        title="Cliquer pour copier le code"
                      >
                        <span>📋</span>
                        <span>{troupe.code}</span>
                      </button>

                      {troupe.role !== "owner" && (
                        <button
                          onClick={() => handleLeaveTroupe(troupe.id)}
                          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                          title="Quitter la troupe"
                        >
                          🚪
                        </button>
                      )}

                      {troupe.role === "owner" && (
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

                  <button
                    onClick={() =>
                      setExpandedTroupe(
                        expandedTroupe === troupe.id ? null : troupe.id,
                      )
                    }
                    className="mt-3 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-300 transition flex items-center justify-center gap-2"
                  >
                    <span>📋</span>
                    <span>Consignes & Vidéos</span>
                    <span>{expandedTroupe === troupe.id ? "▲" : "▼"}</span>
                  </button>

                  {expandedTroupe === troupe.id && (
                    <div className="mt-4 pt-4 border-t border-gray-700 space-y-6">
                      <TroupeDocuments
                        troupeId={troupe.id}
                        userId={user.id}
                        troupeName={troupe.name}
                      />
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

      {/* TAB 3: Partager mes textes */}
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
                        <h3 className="font-semibold text-white">
                          {script.title}
                        </h3>
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
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-xs font-medium transition"
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

      {/* Modale Rejoindre */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              🔑 Rejoindre une troupe
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              Entrez le code à 8 caractères fourni par votre metteur en scène
            </p>

            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              className="w-full p-3 text-center text-lg font-mono tracking-widest uppercase bg-gray-800 border border-gray-700 rounded-xl text-white mb-4 focus:border-gold-500 focus:outline-none"
              maxLength={8}
              autoFocus
            />

            {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setShowJoinModal(false)}
                className="btn-secondary flex-1 py-2.5"
              >
                Annuler
              </button>
              <button
                onClick={handleJoinTroupe}
                className="btn-gold flex-1 py-2.5 disabled:opacity-50"
                disabled={joinCode.length < 8 || actionLoading}
              >
                {actionLoading ? "..." : "Rejoindre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Créer Troupe */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gold-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            {createdTroupeCode ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-green-500/20 rounded-full flex items-center justify-center">
                  <span className="text-4xl">✓</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Troupe créée !
                </h3>
                <p className="text-gray-400 text-xs mb-4">
                  Partagez ce code avec les comédiens de votre troupe :
                </p>
                <div className="bg-primary-600/20 border border-primary-500/50 rounded-xl p-4 mb-4">
                  <p className="text-3xl font-mono font-bold text-primary-300 tracking-widest">
                    {createdTroupeCode}
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdTroupeCode);
                    setSuccess("Code copié !");
                    setTimeout(() => setSuccess(null), 2000);
                  }}
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-semibold text-xs transition mb-3"
                >
                  📋 Copier le code
                </button>
                <button
                  onClick={closeCreateModal}
                  className="btn-secondary w-full py-2"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white mb-2">
                  ➕ Créer une troupe
                </h3>
                <p className="text-gray-400 text-xs mb-4">
                  Donnez un nom à votre troupe. Un code unique à 8 caractères
                  sera généré.
                </p>
                <input
                  type="text"
                  value={newTroupeName}
                  onChange={(e) => setNewTroupeName(e.target.value)}
                  placeholder="Ex: Troupe Molière"
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white mb-4 text-sm focus:border-gold-500 focus:outline-none"
                  maxLength={50}
                  autoFocus
                />
                {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={closeCreateModal}
                    className="btn-secondary flex-1 py-2.5"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCreateTroupe}
                    className="btn-gold flex-1 py-2.5 disabled:opacity-50"
                    disabled={!newTroupeName.trim() || actionLoading}
                  >
                    {actionLoading ? "..." : "✓ Créer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modale Partager un script */}
      {showShareModal && selectedScript && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-2">
              📤 Partager "{selectedScript.title}"
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              Choisissez la troupe avec laquelle partager ce texte :
            </p>
            <div className="space-y-2 mb-4">
              {troupes.map((troupe) => (
                <button
                  key={troupe.id}
                  onClick={() =>
                    handleShareScript(selectedScript.id, troupe.id)
                  }
                  disabled={actionLoading}
                  className="w-full p-3 bg-gray-800 hover:bg-primary-600 rounded-xl text-left transition flex items-center justify-between text-sm"
                >
                  <span className="text-white font-medium">{troupe.name}</span>
                  <span className="text-primary-400">→</span>
                </button>
              ))}
            </div>
            {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
            <button
              onClick={() => setShowShareModal(false)}
              className="btn-secondary w-full py-2.5"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Modale Supprimer Troupe */}
      {deleteTroupeConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full text-center">
            <span className="text-4xl block mb-2">🗑️</span>
            <h3 className="text-lg font-bold text-white mb-2">
              Supprimer la troupe ?
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              {deleteTroupeConfirm.name}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTroupeConfirm(null)}
                className="btn-secondary flex-1 py-2.5"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteTroupe}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl flex-1 py-2.5 transition"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Shared;
