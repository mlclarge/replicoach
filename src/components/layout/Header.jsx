import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function Header() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);

  const initials = user?.email?.slice(0, 2).toUpperCase() || "?";

  const handleSignOut = async () => {
    setShowMenu(false);
    await signOut();
    navigate("/login");
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

      {/* Profil connecté à droite avec avatar & menu déroulant */}
      <div className="relative">
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
            <div className="absolute right-0 top-12 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 min-w-56 py-2 animate-fadeIn">
              <div className="px-4 py-2.5 border-b border-gray-800">
                <p className="text-[11px] text-gray-400 font-medium">Connecté en tant que</p>
                <p className="text-xs font-bold text-white truncate">{user?.email}</p>
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
