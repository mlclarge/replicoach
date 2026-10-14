import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useTheme, THEMES } from "../../context/ThemeContext";

export default function Header() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { theme, cycleTheme, setTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);

  const initials = user?.email?.slice(0, 2).toUpperCase() || "?";

  const handleSignOut = async () => {
    setShowMenu(false);
    await signOut();
    navigate("/login");
  };

  const getThemeInfo = () => {
    if (theme === THEMES.PAPER)
      return { icon: "📜", label: "Papier", badge: "bg-amber-800/40 text-amber-200 border-amber-600/50" };
    if (theme === THEMES.LIGHT)
      return { icon: "☀️", label: "Clair", badge: "bg-blue-800/40 text-blue-200 border-blue-600/50" };
    return { icon: "🌙", label: "Sombre", badge: "bg-gray-800/80 text-amber-300 border-gray-700" };
  };

  const themeInfo = getThemeInfo();

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

      {/* Profil connecté & Bascule de thème */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Bouton rapide de changement de thème */}
        <button
          onClick={cycleTheme}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 ${themeInfo.badge}`}
          title="Changer le thème d'affichage (Sombre / Papier Sépia / Clair)"
        >
          <span className="text-base">{themeInfo.icon}</span>
          <span className="hidden sm:inline">{themeInfo.label}</span>
        </button>

        {/* Avatar Profil avec menu déroulant */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-gray-950 font-extrabold flex items-center justify-center hover:scale-105 transition active:scale-95 shadow-md border-2 border-amber-300"
            title="Mon compte"
          >
            {initials}
          </button>

          {/* Menu déroulant Profil / Déconnexion / Thèmes */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-12 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 min-w-60 py-2 animate-fadeIn">
                <div className="px-4 py-2.5 border-b border-gray-800">
                  <p className="text-[11px] text-gray-400 font-medium">Connecté en tant que</p>
                  <p className="text-xs font-bold text-white truncate">{user?.email}</p>
                </div>

                {/* Sélecteur de Thème dans le menu */}
                <div className="px-4 py-2.5 border-b border-gray-800 space-y-1.5">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Thème d'affichage
                  </p>
                  <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-xl">
                    <button
                      onClick={() => setTheme(THEMES.DARK)}
                      className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                        theme === THEMES.DARK
                          ? "bg-amber-500 text-gray-950 shadow"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <span>🌙</span> Sombre
                    </button>
                    <button
                      onClick={() => setTheme(THEMES.PAPER)}
                      className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                        theme === THEMES.PAPER
                          ? "bg-amber-500 text-gray-950 shadow"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <span>📜</span> Papier
                    </button>
                    <button
                      onClick={() => setTheme(THEMES.LIGHT)}
                      className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                        theme === THEMES.LIGHT
                          ? "bg-amber-500 text-gray-950 shadow"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <span>☀️</span> Clair
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
      </div>
    </header>
  );
}
