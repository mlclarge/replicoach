import { useState, useEffect, useRef } from "react";
import { BatchTtsGenerator } from "../lib/batchTtsService";
import { TTS_VOICES } from "../lib/ttsVoices";

/**
 * Modal de Pré-génération par lot des Voix Premium HD (Batch TTS).
 * Permet au metteur en scène ou à l'utilisateur de remplir le cache audio Supabase
 * pour une pièce complète sans subir la moindre coupure en mode d'écoute.
 */
export default function TtsBatchModal({ script, onClose }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const generatorRef = useRef(null);

  useEffect(() => {
    if (!script?.id) return;
    const generator = new BatchTtsGenerator(
      script.id,
      script.replicas || [],
      script.characters || []
    );
    generatorRef.current = generator;

    generator.getStatus().then((st) => {
      setStatus(st);
      setLoading(false);
    });

    return () => {
      if (generatorRef.current) {
        generatorRef.current.cancel();
      }
    };
  }, [script]);

  const startBatch = async () => {
    if (!generatorRef.current) return;
    setIsGenerating(true);
    setIsPaused(false);

    await generatorRef.current.start((prog) => {
      setProgress(prog);
      if (prog.stage === "completed" || prog.stage === "cancelled") {
        setIsGenerating(false);
        setIsPaused(false);
        // Rafraîchir le statut final
        generatorRef.current.getStatus().then((st) => setStatus(st));
      }
    });
  };

  const togglePause = () => {
    if (!generatorRef.current) return;
    if (isPaused) {
      generatorRef.current.resume();
      setIsPaused(false);
    } else {
      generatorRef.current.pause();
      setIsPaused(true);
    }
  };

  const cancelBatch = () => {
    if (generatorRef.current) {
      generatorRef.current.cancel();
    }
    setIsGenerating(false);
    setIsPaused(false);
  };

  const percent = progress?.toGenerate
    ? Math.round((progress.current / progress.toGenerate) * 100)
    : status?.pending === 0 && status?.total > 0
    ? 100
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-amber-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚡</span>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                Pré-génération Voix HD
              </h3>
              <p className="text-xs text-amber-100 opacity-90 truncate max-w-xs">
                {script?.title || "Pièce de théâtre"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              cancelBatch();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-gray-800 text-sm">
          {loading ? (
            <div className="py-8 text-center space-y-2">
              <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-gray-500 font-medium">Analyse du cache audio Supabase...</p>
            </div>
          ) : status?.total === 0 ? (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center space-y-2">
              <p className="font-bold text-amber-900">⚠️ Aucune voix HD verrouillée</p>
              <p className="text-xs text-amber-800">
                Allez dans les réglages des personnages de la pièce et verrouillez au moins une voix Premium HD pour lancer la pré-génération.
              </p>
            </div>
          ) : (
            <>
              {/* Badges récapitulatifs */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="block text-xs text-gray-500 font-semibold">Total Rôles HD</span>
                  <span className="text-base font-extrabold text-gray-900">{status.total}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="block text-xs text-emerald-700 font-semibold">En Cache</span>
                  <span className="text-base font-extrabold text-emerald-800">
                    {progress?.alreadyCached ?? status.cached}
                  </span>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="block text-xs text-amber-700 font-semibold">À Générer</span>
                  <span className="text-base font-extrabold text-amber-900">
                    {progress ? progress.toGenerate - progress.current : status.pending}
                  </span>
                </div>
              </div>

              {/* Barre de progression */}
              <div className="space-y-2 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>Progression globale</span>
                  <span>{percent}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-300 rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                {progress?.textSample && (
                  <p className="text-[11px] text-gray-500 italic truncate pt-1">
                    Génération : « {progress.textSample} »
                  </p>
                )}
              </div>

              {/* Statut de fin ou d'action */}
              {status.pending === 0 && !isGenerating && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <span>✅</span>
                  <span>
                    Toutes les répliques HD de cette pièce sont prêtes en cache ! La lecture sera 100% instantanée.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer avec Boutons d'action */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              cancelBatch();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-200 transition"
          >
            Fermer
          </button>

          {!loading && status?.total > 0 && (
            <div className="flex items-center gap-2">
              {isGenerating ? (
                <>
                  <button
                    type="button"
                    onClick={togglePause}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-100 text-amber-900 hover:bg-amber-200 transition border border-amber-300"
                  >
                    {isPaused ? "▶️ Reprendre" : "⏸️ Pause"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelBatch}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold bg-red-600 text-white hover:bg-red-700 transition shadow-xs"
                  >
                    ⏹️ Arrêter
                  </button>
                </>
              ) : status.pending > 0 ? (
                <button
                  type="button"
                  onClick={startBatch}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition flex items-center gap-2"
                >
                  <span>⚡</span>
                  <span>Démarrer la Pré-génération ({status.pending} répliques)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startBatch}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
                >
                  🔄 Vider & Régénérer
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
