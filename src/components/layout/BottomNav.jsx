import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const isScriptView = location.pathname.includes("/script");

  const handleStudioClick = (e) => {
    if (isScriptView) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("open-studio-menu"));
    }
  };

  const handleTutoConsignesClick = () => {
    if (isScriptView) {
      window.dispatchEvent(new CustomEvent("open-aicoaching"));
    } else {
      window.dispatchEvent(new CustomEvent("open-onboarding"));
    }
  };

  const isDirectorActive = location.pathname === "/" && location.search.includes("tab=director");
  const isLibraryActive = location.pathname === "/" && location.search.includes("tab=library");

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-950/95 border-t border-gray-800/90 backdrop-blur-md flex items-center justify-between px-2 sm:px-4 py-2 safe-area-pb z-50 shadow-2xl">
      {/* Bouton RETOUR */}
      <button
        onClick={() => navigate(-1)}
        className="px-3 py-1.5 bg-gray-800/90 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs font-bold text-gray-200 transition active:scale-95 flex items-center gap-1 shadow-md mr-1 flex-shrink-0"
        title="Page précédente"
      >
        <span className="text-base text-amber-400 font-extrabold">←</span>
        <span className="text-[11px] font-semibold hidden xs:inline">Retour</span>
      </button>

      {/* Groupe de navigation principal */}
      <div className="flex items-center justify-around flex-1 gap-1 sm:gap-2">
        {/* 1. Textes-biblio */}
        <NavLink
          to="/?tab=library#library"
          className={() =>
            `flex flex-col items-center py-1 px-2 rounded-xl transition text-center ${
              isLibraryActive
                ? "text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30"
                : "text-white font-medium hover:text-amber-300"
            }`
          }
        >
          <span className="text-base sm:text-lg">📚</span>
          <span className="text-[10px] sm:text-xs text-white font-medium">Textes</span>
        </NavLink>

        {/* 2. Importer */}
        <NavLink
          to="/upload"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-xl transition text-center ${
              isActive
                ? "text-blue-400 font-bold bg-blue-500/10 border border-blue-500/30"
                : "text-white font-medium hover:text-amber-300"
            }`
          }
        >
          <span className="text-base sm:text-lg">➕</span>
          <span className="text-[10px] sm:text-xs text-white font-medium">Importer</span>
        </NavLink>

        {/* 3. Studio Centralisé (Menu d'action immersif) */}
        <NavLink
          to={isScriptView ? "#studio" : "/free-recordings"}
          onClick={handleStudioClick}
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-xl transition text-center ${
              isActive || isScriptView
                ? "text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30"
                : "text-white font-medium hover:text-amber-300"
            }`
          }
          title="Studio unifié (Ajouter note, réplique, vidéo, audio, personnage)"
        >
          <span className="text-base sm:text-lg">🎙️</span>
          <span className="text-[10px] sm:text-xs text-white font-medium">Studio</span>
        </NavLink>

        {/* 4. Tuto / Consignes */}
        <NavLink
          to="/?tab=director"
          onClick={handleTutoConsignesClick}
          className={() =>
            `flex flex-col items-center py-1 px-2 rounded-xl transition text-center ${
              isDirectorActive
                ? "text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30"
                : "text-white font-medium hover:text-amber-300"
            }`
          }
          title="Coaching IA & Consignes"
        >
          <span className="text-base sm:text-lg">✨</span>
          <span className="text-[10px] sm:text-xs text-white font-medium">Tuto/Consignes</span>
        </NavLink>

        {/* 5. Partagés */}
        <NavLink
          to="/shared"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-xl transition text-center ${
              isActive
                ? "text-purple-400 font-bold bg-purple-500/10 border border-purple-500/30"
                : "text-white font-medium hover:text-amber-300"
            }`
          }
        >
          <span className="text-base sm:text-lg">👥</span>
          <span className="text-[10px] sm:text-xs text-white font-medium">Partagés</span>
        </NavLink>
      </div>
    </nav>
  );
}
