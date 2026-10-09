import { useState } from "react";
import { Link } from "react-router-dom";

function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <div className="fixed bottom-20 right-6 z-50">
      {/* Arrière-plan semi-transparent lors de l'ouverture */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Speed Dial Menu - Options secondaires */}
      <div
        className={`absolute bottom-16 right-0 flex flex-col gap-3 items-end z-50 transition-all duration-300 ${
          isOpen
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4 pointer-events-none"
        }`}
      >
        {/* Option 1 : Importer un texte */}
        <Link
          to="/upload"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-3 bg-gray-900 border border-gray-700 hover:border-gold-500 text-white px-4 py-2.5 rounded-2xl shadow-xl transition-all group hover:scale-105"
        >
          <span className="text-xs font-semibold text-gray-200 group-hover:text-gold-400">
            📄 Importer un texte
          </span>
          <span className="text-lg bg-gold-500/20 p-1.5 rounded-xl text-gold-400">
            📤
          </span>
        </Link>

        {/* Option 2 : Troupes & Partages */}
        <Link
          to="/shared"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-3 bg-gray-900 border border-gray-700 hover:border-primary-500 text-white px-4 py-2.5 rounded-2xl shadow-xl transition-all group hover:scale-105"
        >
          <span className="text-xs font-semibold text-gray-200 group-hover:text-primary-300">
            👥 Troupes & Partages
          </span>
          <span className="text-lg bg-primary-500/20 p-1.5 rounded-xl text-primary-400">
            🎭
          </span>
        </Link>

        {/* Option 3 : Studio / Auto-enregistrement */}
        <Link
          to="/free-recordings"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-3 bg-gray-900 border border-gray-700 hover:border-emerald-500 text-white px-4 py-2.5 rounded-2xl shadow-xl transition-all group hover:scale-105"
        >
          <span className="text-xs font-semibold text-gray-200 group-hover:text-emerald-400">
            🎙️ Studio Enregistrement
          </span>
          <span className="text-lg bg-emerald-500/20 p-1.5 rounded-xl text-emerald-400">
            🎤
          </span>
        </Link>

        {/* Option 4 : Bibliothèque publique (Active l'onglet Bibliothèque sur la Home) */}
        <Link
          to="/?tab=library#library"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-3 bg-gray-900 border border-gray-700 hover:border-amber-500 text-white px-4 py-2.5 rounded-2xl shadow-xl transition-all group hover:scale-105"
        >
          <span className="text-xs font-semibold text-gray-200 group-hover:text-amber-400">
            📚 Bibliothèque publique
          </span>
          <span className="text-lg bg-amber-500/20 p-1.5 rounded-xl text-amber-400">
            📖
          </span>
        </Link>
      </div>

      {/* Bouton Principal Bordeau/Wine (+) */}
      <button
        onClick={toggleMenu}
        aria-label="Menu d'actions rapides"
        className={`w-14 h-14 rounded-full bg-gradient-to-br from-primary-900 via-primary-800 to-red-950 border-2 border-amber-500/60 text-white shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 z-50 ${
          isOpen ? "rotate-45 bg-red-900 border-red-500" : ""
        }`}
      >
        <span className="text-3xl font-extrabold text-white leading-none select-none">
          +
        </span>
      </button>
    </div>
  );
}

export default FloatingActionButton;
