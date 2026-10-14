import { NavLink, useNavigate } from "react-router-dom";

export default function BottomNav() {
  const navigate = useNavigate();

  const handleOpenTutorial = () => {
    localStorage.removeItem("replicoach-onboarding-seen");
    window.dispatchEvent(new CustomEvent("open-onboarding"));
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-950/95 border-t border-gray-800/90 backdrop-blur-md flex items-center justify-between px-3 py-2 safe-area-pb z-50 shadow-2xl">
      {/* 1. Bouton RETOUR (Détaché visuellement à gauche) */}
      <button
        onClick={() => navigate(-1)}
        className="px-3.5 py-1.5 bg-gray-800/90 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs font-bold text-gray-200 transition active:scale-95 flex items-center gap-1.5 shadow-md mr-2"
        title="Page précédente"
      >
        <span className="text-base text-amber-400 font-extrabold">←</span>
        <span className="text-[11px] font-semibold">Retour</span>
      </button>

      {/* Groupe de navigation principal */}
      <div className="flex items-center justify-center gap-2 sm:gap-6 flex-1">
        {/* Mes textes */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-3 rounded-xl transition ${
              isActive
                ? "text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30"
                : "text-gray-400 hover:text-white"
            }`
          }
        >
          <span className="text-lg">📚</span>
          <span className="text-[10px] sm:text-xs">Mes textes</span>
        </NavLink>

        {/* Partagés / Troupes */}
        <NavLink
          to="/shared"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-3 rounded-xl transition ${
              isActive
                ? "text-purple-400 font-bold bg-purple-500/10 border border-purple-500/30"
                : "text-gray-400 hover:text-white"
            }`
          }
        >
          <span className="text-lg">🎭</span>
          <span className="text-[10px] sm:text-xs">Partagés</span>
        </NavLink>

        {/* Tutoriel */}
        <button
          onClick={handleOpenTutorial}
          className="flex flex-col items-center py-1 px-3 rounded-xl text-gray-400 hover:text-amber-300 transition"
          title="Accéder au tutoriel"
        >
          <span className="text-lg">📖</span>
          <span className="text-[10px] sm:text-xs">Tutoriel</span>
        </button>
      </div>
    </nav>
  );
}
