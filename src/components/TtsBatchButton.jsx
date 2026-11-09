import { useState } from "react";
import TtsBatchModal from "./TtsBatchModal";

/**
 * Bouton déclencheur de la Pré-génération par lot (Batch TTS) pour la fiche script.
 */
export default function TtsBatchButton({ script, className = "" }) {
  const [showModal, setShowModal] = useState(false);

  if (!script) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-black shadow-sm border border-amber-600 transition flex items-center gap-1.5 active:scale-95 ${className}`}
        title="Pré-générer les voix Premium HD en cache Supabase pour une lecture instantanée sans coupure"
      >
        <span className="text-sm">⚡</span>
        <span>Pré-générer Voix HD</span>
      </button>

      {showModal && (
        <TtsBatchModal script={script} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
