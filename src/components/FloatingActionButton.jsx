import React, { useState } from "react";
import { Link } from "react-router-dom";

/**
 * 🎭 FloatingActionButton - Bouton flottant Speed Dial Bordeaux / Wine
 * Restaure le menu dépliable à 4 actions
 * Bouton principal bordeaux avec + blanc en gras
 */
function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Arrière-plan sombre quand le menu est ouvert */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      <div className="fixed bottom-20 right-5 sm:bottom-24 sm:right-8 z-50 flex flex-col items-end">
        {/* Menu dépliable Speed Dial */}
        {isOpen && (
          <div className="flex flex-col gap-3 mb-4 items-end animate-fade-in">
            {/* Option 1 : Importer un texte */}
            <Link
              to="/upload"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 bg-gray-900 border border-gold-500/40 text-white px-4 py-2.5 rounded-xl shadow-xl hover:bg-gray-800 transition group"
            >
              <span className="text-xs font-bold text-gray-200 group-hover:text-gold-400">
                📄 Importer un texte
              </span>
              <div className="w-9 h-9 bg-emerald-600/30 border border-emerald-500/50 rounded-lg flex items-center justify-center text-emerald-400 font-bold">
                📤
              </div>
            </Link>

            {/* Option 2 : Troupes & Partages */}
            <Link
              to="/shared"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 bg-gray-900 border border-gold-500/40 text-white px-4 py-2.5 rounded-xl shadow-xl hover:bg-gray-800 transition group"
            >
              <span className="text-xs font-bold text-gray-200 group-hover:text-primary-300">
                👥 Troupes & Partages
              </span>
              <div className="w-9 h-9 bg-primary-600/30 border border-primary-500/50 rounded-lg flex items-center justify-center text-primary-300 font-bold">
                🔑
              </div>
            </Link>

            {/* Option 3 : Studio / Enregistrement (FreeRecordings.jsx) */}
            <Link
              to="/free-recordings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 bg-gray-900 border border-gold-500/40 text-white px-4 py-2.5 rounded-xl shadow-xl hover:bg-gray-800 transition group"
            >
              <span className="text-xs font-bold text-gray-200 group-hover:text-amber-400">
                🎙️ Studio / Enregistrement
              </span>
              <div className="w-9 h-9 bg-amber-600/30 border border-amber-500/50 rounded-lg flex items-center justify-center text-amber-400 font-bold">
                🎤
              </div>
            </Link>

            {/* Option 4 : Bibliothèque publique */}
            <Link
              to="/#library"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 bg-gray-900 border border-gold-500/40 text-white px-4 py-2.5 rounded-xl shadow-xl hover:bg-gray-800 transition group"
            >
              <span className="text-xs font-bold text-gray-200 group-hover:text-amber-300">
                📚 Bibliothèque publique
              </span>
              <div className="w-9 h-9 bg-amber-500/20 border border-amber-400/50 rounded-lg flex items-center justify-center text-amber-300 font-bold">
                📖
              </div>
            </Link>
          </div>
        )}

        {/* Bouton principal Flottant (Bordeaux/Wine avec + Blanc Gras) */}
        <button
          onClick={toggleMenu}
          aria-label="Actions rapides"
          className="w-14 h-14 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 border-2 border-gold-500/60 hover:border-gold-400 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center group"
        >
          <span
            className={`text-white text-3xl font-extrabold transition-transform duration-300 leading-none ${
              isOpen ? "rotate-45" : "group-hover:rotate-90"
            }`}
          >
            +
          </span>
        </button>
      </div>
    </>
  );
}

export default FloatingActionButton;
