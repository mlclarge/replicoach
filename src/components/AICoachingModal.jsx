import { useState } from "react";
import { getGameSuggestions, isApiConfigured } from "../lib/geminiService";

/**
 * Modal pour le coaching IA du comédien
 * Permet au comédien de donner du contexte et reçoit des suggestions de jeu
 * Mode: 'global' (saynète entière) ou 'character' (personnage spécifique)
 */
export default function AICoachingModal({
  isOpen,
  onClose,
  mode = "global", // 'global' ou 'character'
  characterName = "Personnage",
  scriptText = "",
  coachingCharacterId = null,
  allCharacters = [],
  allReplicas = [],
  onSaveAsNote,
}) {
  // Filtrer le scriptText pour afficher seulement les répliques du personnage si mode='character'
  const getFilteredScriptText = () => {
    if (mode !== "character" || !coachingCharacterId) {
      return scriptText;
    }
    
    const character = allCharacters.find(c => c.id === coachingCharacterId);
    if (!character) return scriptText;
    
    const filteredReplicas = allReplicas.filter(r => r.character_id === coachingCharacterId);
    return filteredReplicas
      .map(r => `${character.name}: ${r.text}`)
      .join("\n\n");
  };

  const displayCharacterName = () => {
    if (mode === "global") return "Saynète complète";
    const character = allCharacters.find(c => c.id === coachingCharacterId);
    return character?.name || characterName;
  };
  const [actorContext, setActorContext] = useState("");
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tokenStats, setTokenStats] = useState(null);
  const [savingNote, setSavingNote] = useState(false);
  const [cumulativeCost, setCumulativeCost] = useState(0); // Coût total de la session
  const [showInitialWarning, setShowInitialWarning] = useState(true); // Montrer l'avertissement initial une fois

  if (!isOpen) return null;

  const handleGenerateSuggestions = async () => {
    if (!actorContext.trim()) {
      setError("Veuillez entrer du contexte sur votre approche du rôle");
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestions(null);
    setTokenStats(null);

    try {
      const filteredScript = getFilteredScriptText();
      const character = mode === "character" 
        ? allCharacters.find(c => c.id === coachingCharacterId)
        : null;
      const displayName = character?.name || characterName;

      const result = await getGameSuggestions(
        displayName,
        filteredScript,
        actorContext,
        mode === "character" // Pass true if character-specific coaching
      );

      setSuggestions(result.suggestions);
      
      // Ajouter au coût cumulé
      const newCumulativeCost = cumulativeCost + result.costInEuroAsNumber;
      setCumulativeCost(newCumulativeCost);

      setTokenStats({
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        estimatedCost: result.estimatedCost,
        costInEuroAsNumber: result.costInEuroAsNumber,
        cumulativeCost: newCumulativeCost,
      });
      
      // Cacher l'avertissement initial après la première génération
      setShowInitialWarning(false);
    } catch (err) {
      setError(
        err.message ||
          "Une erreur s'est produite lors de la génération des suggestions"
      );
      console.error("Erreur API Gemini:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateWithNewContext = () => {
    setSuggestions(null);
    setTokenStats(null);
    setError(null);
  };

  const handleSaveAsNote = async () => {
    if (!suggestions || !onSaveAsNote) return;

    setSavingNote(true);
    try {
      await onSaveAsNote({
        text: `💡 Coaching IA - ${characterName}\n\n${actorContext}\n\n---\n\n${suggestions}`,
        type: "intention",
      });
      // Close modal after successful save
      onClose();
    } catch (err) {
      setError("Erreur lors de l'enregistrement de la note");
      console.error("Erreur save note:", err);
    } finally {
      setSavingNote(false);
    }
  };

  if (!isApiConfigured()) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/95">
        <div className="h-full flex flex-col max-h-screen">
          {/* Header */}
          <div className="flex-none p-4 border-b border-gray-700 bg-dark flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              💡 Coaching IA
            </h3>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 max-w-md text-center">
              <span className="text-5xl block mb-4">⚠️</span>
              <h4 className="text-lg font-semibold text-red-400 mb-2">
                API Gemini non configurée
              </h4>
              <p className="text-gray-300 mb-4">
                Veuillez ajouter votre clé API Google Gemini dans le fichier
                <code className="bg-gray-800 px-2 py-1 rounded text-sm">.env</code>
              </p>
              <div className="bg-gray-800 rounded p-3 mb-4 text-left text-xs text-gray-300">
                <p className="font-mono mb-2">
                  VITE_GEMINI_API_KEY=votre_clé_api
                </p>
                <p className="text-gray-500">
                  Obtenez une clé sur{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/95">
      <div className="h-full flex flex-col max-h-screen">
        {/* Header */}
        <div className="flex-none p-4 border-b border-gray-700 bg-dark flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              💡 Coaching IA {mode === "character" ? "par rôle" : "global"}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {displayCharacterName()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Avertissement initial */}
          {showInitialWarning && !suggestions && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg">
              <p className="text-blue-300 text-xs font-semibold mb-1">ℹ️ Information importante</p>
              <p className="text-blue-200 text-xs">
                Les suggestions IA ont un coût associé. Chaque requête utilise des tokens facturés par Google (~0,02€ par suggestion).
              </p>
            </div>
          )}

          {/* Étape 1: Saisie du contexte */}
          {!suggestions && (
            <div>
              <label className="block text-sm font-semibold text-gold-400 mb-3">
                📝 Décrivez votre approche du rôle
              </label>
              <p className="text-gray-400 text-xs mb-3">
                Donnez du contexte sur votre vision du personnage, ses émotions,
                ses motivations...
              </p>

              <textarea
                value={actorContext}
                onChange={(e) => {
                  setActorContext(e.target.value);
                  setError(null);
                }}
                className="w-full h-32 bg-gray-800 border border-gray-600 rounded-xl p-4 
                           text-white text-base resize-none focus:border-gold-500 focus:outline-none"
                placeholder="Ex: Mon personnage est introverti mais plein de ressources. Il cache une grande souffrance..."
                disabled={loading}
              />

              {error && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Coût estimé et coût cumulé */}
              <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/50 rounded-lg">
                <p className="text-orange-300 text-xs font-semibold mb-2">
                  💰 Coût estimé: ~0,02€ par suggestion
                </p>
                {cumulativeCost > 0 && (
                  <p className="text-orange-200 text-xs">
                    Coût cumulé cette session: <span className="font-bold">{cumulativeCost.toFixed(2)}€</span>
                  </p>
                )}
              </div>

              {/* Avertissement coût élevé */}
              {cumulativeCost > 5 && (
                <div className="mt-3 p-3 bg-red-500/20 border border-red-500 rounded-lg">
                  <p className="text-red-300 text-xs font-semibold">
                    ⚠️ Attention: Vous avez dépensé {cumulativeCost.toFixed(2)}€ en suggestions cette session!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Étape 2: Suggestions */}
          {suggestions && (
            <div>
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/50 rounded-lg">
                <p className="text-green-400 text-sm font-semibold mb-2">
                  ✨ Suggestions générées
                </p>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">
                  {suggestions}
                </p>
              </div>

              {tokenStats && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg text-xs">
                  <p className="text-blue-300 mb-3 font-semibold">📊 Coûts payés:</p>
                  <div className="space-y-2 text-gray-300">
                    <div className="flex justify-between">
                      <span>• Tokens input:</span>
                      <span>{tokenStats.inputTokens}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Tokens output:</span>
                      <span>{tokenStats.outputTokens}</span>
                    </div>
                    <div className="flex justify-between border-t border-blue-500/30 pt-2">
                      <span className="font-semibold">Total tokens:</span>
                      <span className="font-semibold">{tokenStats.totalTokens}</span>
                    </div>
                    <div className="flex justify-between bg-blue-500/20 rounded p-2 mt-2">
                      <span className="text-blue-300 font-bold">Coût cette demande:</span>
                      <span className="text-blue-200 font-bold">{tokenStats.estimatedCost}</span>
                    </div>
                    {tokenStats.cumulativeCost > 0 && (
                      <div className="flex justify-between bg-orange-500/20 rounded p-2">
                        <span className="text-orange-300 font-bold">Coût total session:</span>
                        <span className="text-orange-200 font-bold">{tokenStats.cumulativeCost.toFixed(2)}€</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="text-4xl mb-4 animate-spin">⏳</div>
              <p className="text-gray-400 text-center">
                Gemini génère les suggestions...
              </p>
            </div>
          )}
        </div>

        {/* Footer with buttons */}
        <div className="flex-none p-4 border-t border-gray-700 bg-dark space-y-2">
          {!suggestions ? (
            <button
              onClick={handleGenerateSuggestions}
              disabled={!actorContext.trim() || loading}
              className={`w-full py-4 rounded-xl text-lg font-bold transition
                ${
                  actorContext.trim() && !loading
                    ? "bg-gold-500 hover:bg-gold-400 text-dark shadow-lg"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
            >
              {loading ? "⏳ Génération..." : "💰 Générer (env. 0,02€)"}
            </button>
          ) : (
            <>
              <button
                onClick={handleSaveAsNote}
                disabled={savingNote}
                className={`w-full py-3 rounded-xl font-semibold transition
                  ${
                    !savingNote
                      ? "bg-green-600 hover:bg-green-500 text-white"
                      : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {savingNote ? "⏳ Enregistrement..." : "💾 Enregistrer en tant que note"}
              </button>
              <button
                onClick={handleRegenerateWithNewContext}
                className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition"
              >
                ✏️ Modifier le contexte
              </button>
              <button
                onClick={handleGenerateSuggestions}
                disabled={!actorContext.trim() || loading}
                className={`w-full py-3 rounded-xl font-semibold transition
                  ${
                    !loading
                      ? "bg-violet-600 hover:bg-violet-500 text-white"
                      : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {loading ? "⏳ Régénération..." : "🔄 Régénérer (0,02€)"}
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-semibold transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
