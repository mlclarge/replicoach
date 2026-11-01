import { useState, useEffect } from "react";
import { getSceneSummary } from "../lib/geminiService";

/**
 * Modale de Synthèse / Résumé IA d'une Scène (Fonctionnalité Premium Gemini IA)
 */
export default function SceneSummaryModal({
  isOpen,
  onClose,
  sceneLabel = "Scène",
  sceneKey = null,
  sceneText = "",
  onSaveAsNote,
  onSavePermanentSummary,
  isPremium = false,
  onOpenPremiumModal,
}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (isOpen && sceneText) {
      fetchSummary();
    }
  }, [isOpen, sceneText]);

  const fetchSummary = async () => {
    if (!isPremium) {
      if (onOpenPremiumModal) onOpenPremiumModal();
      onClose();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getSceneSummary(sceneLabel, sceneText);
      if (result && result.summary) {
        setSummary(result.summary);
        if (onSavePermanentSummary && sceneKey) {
          onSavePermanentSummary(sceneKey, result.summary);
        }
      }
    } catch (err) {
      console.error("Erreur résumé IA scène:", err);
      setError(err.message || "Erreur lors de la génération de la synthèse IA.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!summary || !onSaveAsNote) return;
    setSavingNote(true);
    try {
      if (onSavePermanentSummary && sceneKey) {
        onSavePermanentSummary(sceneKey, summary);
      }
      await onSaveAsNote({
        text: `✨ Synthèse IA — ${sceneLabel}\n\n${summary}`,
        type: "intention",
      });
      onClose();
    } catch (err) {
      setError("Erreur lors de la sauvegarde de la note de scène.");
    } finally {
      setSavingNote(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-900 border border-amber-500/40 rounded-3xl w-full max-w-lg p-5 text-white shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h3 className="font-extrabold text-amber-300 text-sm sm:text-base">
              Synthèse IA — {sceneLabel}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs sm:text-sm">
          {loading && (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-amber-300 font-bold animate-pulse">
                Gemini IA analyse les enjeux dramatiques de la scène...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 space-y-2">
              <p className="font-bold">⚠️ Erreur de synthèse :</p>
              <p>{error}</p>
              <button
                onClick={fetchSummary}
                className="px-3 py-1.5 bg-red-600 text-white font-bold rounded-lg text-xs hover:bg-red-500 transition"
              >
                🔄 Réessayer
              </button>
            </div>
          )}

          {!loading && !error && summary && (
            <div className="p-4 bg-gradient-to-b from-gray-950 to-gray-900 border border-white/10 rounded-2xl space-y-3 text-gray-200 leading-relaxed shadow-inner">
              <div className="whitespace-pre-wrap font-sans space-y-2">
                {summary}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-800 flex items-center justify-between gap-2 mt-3">
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-xs flex items-center gap-1"
          >
            <span>🔄</span> Régénérer
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-xs"
            >
              Fermer
            </button>
            <button
              onClick={handleSaveNote}
              disabled={loading || !summary || savingNote}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-extrabold rounded-xl text-xs shadow-lg disabled:opacity-40 transition"
            >
              {savingNote ? "Sauvegarde..." : "📝 Enregistrer en note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
