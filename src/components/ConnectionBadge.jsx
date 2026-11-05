import { useState } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

/**
 * Pastille d'état de connexion dans l'en-tête.
 * Touchée, elle explique le mode hors ligne de l'application.
 */
export default function ConnectionBadge() {
  const isOnline = useOnlineStatus();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={isOnline ? "En ligne — voir le mode hors ligne" : "Hors ligne — voir ce qui reste disponible"}
        className={`flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[11px] font-extrabold border transition active:scale-95 ${
          isOnline
            ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/40 hover:bg-emerald-500/25"
            : "bg-amber-500 text-amber-950 border-amber-300 animate-pulse"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-900"}`}
          aria-hidden="true"
        />
        <span>{isOnline ? "En ligne" : "📴 Hors ligne"}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Mode hors ligne"
            className="absolute right-0 top-10 z-50 w-72 max-w-[85vw] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-4 text-white space-y-2.5"
          >
            <p className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
              <span>{isOnline ? "✅" : "📴"}</span>
              {isOnline ? "Vous êtes en ligne" : "Vous êtes hors ligne"}
            </p>
            <p className="text-xs text-gray-300 leading-relaxed">
              RépliCoach fonctionne aussi <strong>sans connexion</strong> : en coulisses, dans le
              métro ou en tournée, vos textes déjà ouverts restent disponibles pour répéter.
            </p>
            <ul className="text-xs text-gray-300 space-y-1 list-disc pl-4">
              <li>Les scripts que vous avez déjà consultés restent lisibles</li>
              <li>Ouvrez-les une fois en ligne pour les rendre disponibles</li>
              <li>Voix premium, Coach IA et synchronisation reviennent avec le réseau</li>
            </ul>
            <p className="text-[11px] text-emerald-300 font-bold">
              {isStandalone()
                ? "📲 Application installée : idéale hors ligne."
                : "💡 Astuce : ajoutez RépliCoach à votre écran d'accueil pour un accès hors ligne plus fiable."}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-bold"
            >
              Fermer
            </button>
          </div>
        </>
      )}
    </div>
  );
}
