import { useState, useEffect, useMemo } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useScriptStore, extractScenes } from "../../store/scriptStore";
import VideoRecorderModal from "../VideoRecorderModal";
import { saveReplicaVideoDB, saveFreeVideoDB } from "../../lib/videoStorage";

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const isScriptView = location.pathname.includes("/script");
  const { currentScript } = useScriptStore();

  const [showStudioMenu, setShowStudioMenu] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);

  const replicas = useMemo(() => currentScript?.replicas || [], [currentScript]);
  const characters = useMemo(() => currentScript?.characters || [], [currentScript]);
  const { scenes } = useMemo(() => extractScenes(replicas), [replicas]);

  useEffect(() => {
    const handleStudioMenuEvent = () => {
      setShowStudioMenu(true);
    };
    window.addEventListener("open-studio-menu", handleStudioMenuEvent);
    return () => window.removeEventListener("open-studio-menu", handleStudioMenuEvent);
  }, []);

  const handleStudioClick = (e) => {
    e.preventDefault();
    setShowStudioMenu(true);
  };

  const handleTutoConsignesClick = () => {
    if (isScriptView) {
      window.dispatchEvent(new CustomEvent("open-aicoaching"));
    } else {
      window.dispatchEvent(new CustomEvent("open-onboarding"));
    }
  };

  const handleSaveVideo = (targetReplicaId, videoData) => {
    if (currentScript?.id && targetReplicaId) {
      saveReplicaVideoDB(currentScript.id, targetReplicaId, videoData);
      window.dispatchEvent(
        new CustomEvent("replica-video-updated", {
          detail: { targetReplicaId, videoData },
        })
      );
    } else {
      saveFreeVideoDB(videoData);
    }
  };

  const isDirectorActive = location.pathname === "/" && location.search.includes("tab=director");
  const isLibraryActive = location.pathname === "/" && location.search.includes("tab=library");

  return (
    <>
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

          {/* 3. Studio Centralisé */}
          <NavLink
            to="#studio"
            onClick={handleStudioClick}
            className={() =>
              `flex flex-col items-center py-1 px-2 rounded-xl transition text-center ${
                showStudioMenu || showVideoRecorder || isScriptView
                  ? "text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30"
                  : "text-white font-medium hover:text-amber-300"
              }`
            }
            title="Studio (Note, Réplique, Personnage, Audio libre, Vidéo)"
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

      {/* 🎙️ STUDIO MENU DRAWER (TIROIR CENTRALISÉ DU STUDIO) */}
      {showStudioMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setShowStudioMenu(false)}
          />
          <div className="relative w-full max-w-lg bg-gray-900 border-t-2 border-amber-500 rounded-t-3xl p-5 text-white shadow-2xl z-10 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎙️</span>
                <h3 className="text-base font-extrabold text-amber-400">
                  Studio RépliCoach — Menu Créatif
                </h3>
              </div>
              <button
                onClick={() => setShowStudioMenu(false)}
                className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400 font-medium">
              Choisissez une action à insérer dans votre travail :
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setShowStudioMenu(false);
                  window.dispatchEvent(new CustomEvent("open-add-note"));
                }}
                className="p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-left transition active:scale-95"
              >
                <span className="text-2xl">📝</span>
                <div>
                  <div className="font-extrabold text-amber-300 text-xs">Ajouter une note</div>
                  <div className="text-[10px] text-gray-400">Note d'intention ou mise en scène</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowStudioMenu(false);
                  window.dispatchEvent(new CustomEvent("open-add-replica"));
                }}
                className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-left transition active:scale-95"
              >
                <span className="text-2xl">💬</span>
                <div>
                  <div className="font-extrabold text-emerald-300 text-xs">Ajouter réplique</div>
                  <div className="text-[10px] text-gray-400">Insérer un dialogue</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowStudioMenu(false);
                  window.dispatchEvent(new CustomEvent("open-add-character"));
                }}
                className="p-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-2xl flex items-center gap-3 text-left transition active:scale-95"
              >
                <span className="text-2xl">👤</span>
                <div>
                  <div className="font-extrabold text-purple-300 text-xs">Ajouter personnage</div>
                  <div className="text-[10px] text-gray-400">Créer un nouveau rôle</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowStudioMenu(false);
                  navigate("/free-recordings");
                }}
                className="p-3 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded-2xl flex items-center gap-3 text-left transition active:scale-95"
              >
                <span className="text-2xl">🎙️</span>
                <div>
                  <div className="font-extrabold text-yellow-300 text-xs">S'enregistrer (Audio)</div>
                  <div className="text-[10px] text-gray-400">Mes enregistrements libres</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowStudioMenu(false);
                  setShowVideoRecorder(true);
                }}
                className="p-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-left transition active:scale-95 col-span-1 sm:col-span-2"
              >
                <span className="text-2xl">🎥</span>
                <div>
                  <div className="font-extrabold text-rose-300 text-xs">Se filmer (Vidéo)</div>
                  <div className="text-[10px] text-gray-400">Enregistrer une vidéo caméra et l'ancrer dans le texte</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎥 MODALE GLOBAL ENREGISTREUR VIDÉO (Invoquée depuis n'importe où via Studio) */}
      {showVideoRecorder && (
        <VideoRecorderModal
          isOpen={true}
          onClose={() => setShowVideoRecorder(false)}
          onSave={handleSaveVideo}
          replicas={replicas}
          characters={characters}
          scenes={scenes}
        />
      )}
    </>
  );
}
