import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { useScriptStore } from "../store/scriptStore";
import {
  fetchDirectorMembers,
  addDirectorMember,
  removeDirectorMember,
  assignScriptToActor,
  fetchDirectorAssignments,
  removeScriptAssignment,
} from "../lib/directorService";
import { fetchScriptVoiceLocks, lockTtsVoice } from "../lib/premiumTts";
import PremiumVoicePicker from "./PremiumVoicePicker";

/**
 * Composant de gestion pour le Metteur en Scène (Profil Director / Dev)
 * - Suivi de la liste des comédiens (par adresse @)
 * - Affectation d'un texte par défaut
 * - Verrouillage des Voix IA Premium par personnage
 */
export default function DirectorTroupeManager() {
  const { user, isPremium } = useAuthStore();
  const { scripts, fetchScripts } = useScriptStore();

  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [selectedScriptId, setSelectedScriptId] = useState("");
  const [targetActorEmail, setTargetActorEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Configuration des voix IA pour le script sélectionné
  const [activeScript, setActiveScript] = useState(null);
  const [premiumLocks, setPremiumLocks] = useState({});

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      await fetchScripts(user.id);
      const mList = await fetchDirectorMembers(user.id);
      const aList = await fetchDirectorAssignments(user.id);
      setMembers(mList);
      setAssignments(aList);
    } catch (err) {
      console.error("Erreur chargement Troupe Metteur en scène:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setError(null);
    try {
      await addDirectorMember(user.id, newEmail.trim());
      setSuccess(`Comédien ${newEmail.trim()} ajouté !`);
      setNewEmail("");
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Erreur lors de l'ajout du comédien.");
    }
  };

  const handleRemoveMember = async (id) => {
    try {
      await removeDirectorMember(id);
      setSuccess("Comédien retiré de la liste.");
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAssignScript = async (e) => {
    e.preventDefault();
    if (!selectedScriptId || !targetActorEmail) return;
    setError(null);
    try {
      await assignScriptToActor(selectedScriptId, user.id, targetActorEmail, true);
      setSuccess(`Texte affecté à ${targetActorEmail} !`);
      setTargetActorEmail("");
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Erreur lors de l'affectation du texte.");
    }
  };

  const handleRemoveAssignment = async (id) => {
    try {
      await removeScriptAssignment(id);
      setSuccess("Affectation supprimée.");
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Charger le verrouillage des voix pour un script
  const handleSelectScriptForVoices = async (scriptId) => {
    setSelectedScriptId(scriptId);
    const found = scripts.find((s) => s.id === scriptId);
    setActiveScript(found || null);
    if (scriptId) {
      const locks = await fetchScriptVoiceLocks(scriptId);
      setPremiumLocks(locks || {});
    }
  };

  const handleLockVoice = async (characterId, voiceId) => {
    if (!selectedScriptId) return;
    const res = await lockTtsVoice(selectedScriptId, characterId, voiceId);
    if (res.ok || res.code === "already_locked") {
      const locks = await fetchScriptVoiceLocks(selectedScriptId);
      setPremiumLocks(locks || {});
    }
    return res;
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-800 rounded-xl border border-gold-500/30 text-center text-gray-400">
        Chargement de l'espace Metteur en scène...
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gold-500/40 overflow-hidden shadow-xl my-4">
      {/* En-tête Metteur en scène */}
      <div className="p-4 bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 border-b border-gold-500/30 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gold-400 flex items-center gap-2">
            <span>🎬</span> Espace Metteur en Scène (Premium)
          </h2>
          <p className="text-xs text-amber-200/80">
            Gérer vos comédiens (@), affecter des textes par défaut et fixer les voix IA
          </p>
        </div>
        <span className="px-2.5 py-1 bg-gold-500 text-black text-xs font-extrabold rounded-full shadow">
          DIRECTOR
        </span>
      </div>

      <div className="p-4 space-y-6">
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-300 text-xs rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-lg">
            {success}
          </div>
        )}

        {/* SECTION 1 : Suivi de la liste des comédiens (@) */}
        <div className="bg-gray-700/50 p-3.5 rounded-xl border border-gray-600/50">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <span>🎭</span> Liste de vos comédiens ({members.length})
          </h3>

          <form onSubmit={handleAddMember} className="flex gap-2 mb-3">
            <input
              type="email"
              placeholder="Adresse e-mail du comédien (ex: comedien@theatre.fr)..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-400 focus:outline-none focus:border-gold-400"
            />
            <button
              type="submit"
              disabled={!newEmail.trim()}
              className="px-4 py-2 bg-gold-500 hover:bg-gold-400 text-black text-xs font-bold rounded-lg transition disabled:opacity-50"
            >
              + Ajouter
            </button>
          </form>

          {members.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aucun comédien ajouté pour l'instant.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2 bg-gray-800 rounded-lg border border-gray-700 text-xs text-gray-200"
                >
                  <span className="font-mono font-semibold">📧 {m.actor_email}</span>
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    className="text-red-400 hover:text-red-300 font-bold px-1"
                    title="Supprimer de la liste"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 2 : Affectation de texte par défaut */}
        <div className="bg-gray-700/50 p-3.5 rounded-xl border border-gray-600/50">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <span>📌</span> Affecter un texte par défaut à un comédien
          </h3>

          <form onSubmit={handleAssignScript} className="space-y-2 mb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={selectedScriptId}
                onChange={(e) => handleSelectScriptForVoices(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white focus:outline-none focus:border-gold-400"
              >
                <option value="">-- Choisir un texte --</option>
                {scripts.map((s) => (
                  <option key={s.id} value={s.id}>
                    📜 {s.title}
                  </option>
                ))}
              </select>

              <select
                value={targetActorEmail}
                onChange={(e) => setTargetActorEmail(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white focus:outline-none focus:border-gold-400"
              >
                <option value="">-- Choisir un comédien (@) --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.actor_email}>
                    📧 {m.actor_email}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!selectedScriptId || !targetActorEmail}
              className="w-full py-2 bg-gradient-to-r from-amber-500 to-gold-500 hover:from-amber-400 hover:to-gold-400 text-black text-xs font-extrabold rounded-lg shadow transition disabled:opacity-50"
            >
              Attribuer ce texte par défaut
            </button>
          </form>

          {/* Liste des affectations actives */}
          {assignments.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] font-bold text-gold-400 uppercase tracking-wider">
                Affectations actives ({assignments.length}) :
              </p>
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-2 bg-gray-800 rounded-lg border border-gray-700 text-xs text-gray-200"
                >
                  <div className="truncate">
                    <span className="font-bold text-amber-300">
                      📜 {a.scripts?.title || "Texte"}
                    </span>
                    <span className="text-gray-400 font-mono ml-2">➔ {a.assigned_to_email}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveAssignment(a.id)}
                    className="text-red-400 hover:text-red-300 font-bold px-1 flex-shrink-0"
                    title="Annuler l'affectation"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3 : Verrouillage des voix IA Premium pour le texte sélectionné */}
        {activeScript && (
          <div className="bg-amber-950/40 p-3.5 rounded-xl border border-amber-500/30 space-y-3">
            <h3 className="text-sm font-bold text-gold-300 flex items-center gap-2">
              <span>✨</span> Configuration des Voix IA Premium pour : « {activeScript.title} »
            </h3>
            <p className="text-xs text-amber-200/80">
              Les voix sélectionnées ci-dessous seront appliquées automatiquement à tous les comédiens qui étudient ce texte.
            </p>

            {activeScript.characters?.length > 0 ? (
              <div className="space-y-2">
                {activeScript.characters.map((char) => (
                  <PremiumVoicePicker
                    key={char.id}
                    character={char}
                    lockedVoiceId={premiumLocks[char.id]}
                    onLock={handleLockVoice}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Aucun personnage détecté dans ce texte.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
