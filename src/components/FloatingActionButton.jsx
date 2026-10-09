// src/components/FloatingActionButton.jsx
import React from "react";
import { Link } from "react-router-dom";

/**
 * 📍 POINT 4 : Bouton flottant couleur Bordeaux / Wine avec + blanc en gras
 */
function FloatingActionButton() {
  return (
    <Link
      to="/upload"
      className="fixed bottom-20 right-6 z-40 flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary-900 to-primary-800 hover:from-primary-800 hover:to-primary-700 text-white rounded-full shadow-2xl border-2 border-gold-500/50 hover:border-gold-400 transition-all duration-200 transform hover:scale-105 active:scale-95 group"
      title="Importer un nouveau texte"
    >
      <span className="text-3xl font-extrabold text-white leading-none -mt-0.5 group-hover:rotate-90 transition-transform duration-300">
        +
      </span>
    </Link>
  );
}

export default FloatingActionButton;
