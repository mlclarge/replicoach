import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useTheme, THEMES } from "../../context/ThemeContext";

export default function Header() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);

  const initials = user?.email?.slice(0, 2).toUpperCase() || "?";

  const handleSignOut = async () => {
    setShowMenu(false);
    await signOut();
    navigate("/login");
  };

  const handleSelectTheme = (newTheme) => {
    setTheme(newTheme);
    setShowMenu(false); // Retracte automatiquement le menu profil
  };

  return (
    <header className="bg-gradient-to-r from-primary-900 via-primary-800 to-primary-950 text-white px-4 py-3 flex items-center justify-between relative shadow-lg border-b border-primary-700/50 z-40">
      {/* Logo cliquable vers l'accueil avec sous-titre */}
      <Link to="/" className="hover:opacity-90 transition active:scale-95 flex items-center gap-2.5">
        <span className="text-2xl sm:text-3xl">🎭</span>
        <div>
          <h1 className="text-lg sm:text-xl font-display font-bold text-white leading-none flex items-center gap-1.5">
            RépliCoach
          </h1>
          <p className="text-[10px] sm:text-xs text-gold-400 font-semibold tracking-wide mt-0.5">
            L'app. qui accompagne le comédien !
          </p>
        </div>
      </Link>

      {/* Profil connecté & Sélecteur de thème */}
      <div className="flex items-center gap-2 relative">
        {/* Bouton rapide de bascule de thème */}
        <button
          onClick={() => {
            if (theme === THEMES.DARK) handleSelectTheme(THEMES.PAPER);
            else if (theme === THEMES.PAPER) handleSelectTheme(THEMES.LIGHT);
            else handleSelectTheme(THEMES.DARK);
          }}
          className="px-2.5 py-1.5 bg-black/40 hover:bg-black/60 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-300 transition flex items-center gap-1.5 shadow-sm active:scale-95"
          title="Changer le thème d'affichage"
        >
          {theme === THEMES.DARK && <span>🌙 Sombre</span>}
          {theme === THEMES.PAPER && <span>📜 Parchemin</span>}
          {theme === THEMES.LIGHT && <span>☀️ Clair</span>}
        </button>

        {/* Avatar Profil */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-gray-950 font-extrabold flex items-center justify-center hover:scale-105 transition active:scale-95 shadow-md border-2 border-amber-300"
          title="Mon compte"
        >
          {initials}
        </button>

        {/* Menu déroulant Profil / Déconnexion */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-12 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 min-w-64 py-2 animate-fadeIn text-white">
              <div className="px-4 py-2.5 border-b border-gray-800">
                <p className="text-[11px] text-gray-400 font-medium">Connecté en tant que</p>
                <p className="text-xs font-bold text-white truncate">{user?.email}</p>
              </div>

              {/* Choix interactif du Thème */}
              <div className="px-4 py-2.5 border-b border-gray-800 space-y-2">
                <p className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center justify-between">
                  <span>🎨 Thème d'affichage</span>
                  <span className="text-[9px] text-gray-400 font-normal">1-clic</span>
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => handleSelectTheme(THEMES.DARK)}
                    className={`py-1.5 px-1 rounded-xl text-[11px] font-bold transition flex flex-col items-center gap-0.5 border ${
                      theme === THEMES.DARK
                        ? "bg-amber-500 text-gray-950 border-amber-400 shadow-md font-black"
                        : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                    }`}
                  >
                    <span className="text-sm">🌙</span>
                    <span>Sombre</span>
                  </button>

                  <button
                    onClick={() => handleSelectTheme(THEMES.PAPER)}
                    className={`py-1.5 px-1 rounded-xl text-[11px] font-bold transition flex flex-col items-center gap-0.5 border ${
                      theme === THEMES.PAPER
                        ? "bg-amber-500 text-gray-950 border-amber-400 shadow-md font-black"
                        : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                    }`}
                  >
                    <span className="text-sm">📜</span>
                    <span>Parchemin</span>
                  </button>

                  <button
                    onClick={() => handleSelectTheme(THEMES.LIGHT)}
                    className={`py-1.5 px-1 rounded-xl text-[11px] font-bold transition flex flex-col items-center gap-0.5 border ${
                      theme === THEMES.LIGHT
                        ? "bg-amber-500 text-gray-950 border-amber-400 shadow-md font-black"
                        : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                    }`}
                  >
                    <span className="text-sm">☀️</span>
                    <span>Clair</span>
                  </button>
                </div>
              </div>

              {/* Lien vers la page Profil */}
              <Link
                to="/profile"
                onClick={() => setShowMenu(false)}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-gray-800 flex items-center gap-2 transition"
              >
                <span>👤</span> Mon Profil
              </Link>

              {/* Se déconnecter */}
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 transition border-t border-gray-800"
              >
                <span>🚪</span> Se déconnecter
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
