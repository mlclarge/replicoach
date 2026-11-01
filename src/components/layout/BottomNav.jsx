import { useState, useEffect, useMemo } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useScriptStore, extractScenes } from "../store/scriptStore";
import VideoRecorderModal from "../components/VideoRecorderModal";
import { saveReplicaVideoDB, saveFreeVideoDB } from "../lib/videoStorage";

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentScript } = useScriptStore();

  const [showStudioMenu, setShowStudioMenu] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);

  const isScriptView = location.pathname.includes("/script");

  useEffect(() => {
    const handleOpenStudio = () => setShowStudioMenu(true);
    window.addEventListener("open-studio-menu", handleOpenStudio);
    return () => window.removeEventListener("open-studio-menu", handleOpenStudio);
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

  const { scenes } = useMemo(() => {
    return extractScenes(currentScript?.replicas || []);
  }, [currentScript?.replicas]);

  const handleSaveVideo = (targetReplicaId, videoData) => {
    if (currentScript?.id && targetReplicaId) {
      saveReplicaVideoDB(currentScript.id, targetReplicaId, videoData);
      window.dispatchEvent(new CustomEvent("replica-video-updated"));
    } else {
      saveFreeVideoDB(videoData);
      window.dispatchEvent(new CustomEvent("free-video-updated"));
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
              
            }
          >
            <span className="text-base sm:text-lg">📚</span>
            <span className="text-[10px] sm:text-xs text-white font-medium">Textes</span>
          </NavLink>

          {/* 2. Importer */}
          <NavLink
            to="/upload"
            className={({ isActive }) =>
              
            }
          >
            <span className="text-base sm:text-lg">➕</span>
            <span className="text-[10px] sm:text-xs text-white font-medium">Importer</span>
          </NavLink>

          {/* 3. Studio Centralisé */}
          <button
            onClick={handleStudioClick}
            className={}
            title="Studio unifié (Notes, Répliques, Personnage, Audio, Vidéo)"
          >
            <span className="text-base sm:text-lg">🎙️</span>
            <span className="text-[10px] sm:text-xs text-white font-medium">Studio</span>
          </button>

          {/* 4. Tuto / Consignes */}
          <NavLink
            to="/?tab=director"
            onClick={handleTutoConsignesClick}
            className={() =>
              
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
              
            }
          >
            <span className="text-base sm:text-lg">👥</span>
            <span className="text-[10px] sm:text-xs text-white font-medium">Partagés</span>
          </NavLink>
        </div>
      </nav>

      {/* 🎙️ STUDIO MENU DRAWER */}
      {showStudioMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setShowStudioMenu(false)}
          />
          <div className="relative w-full max-w-lg bg-gray-900 border-t-2 border-amber-500 rounded-t-3xl p-5 text-white shadow-2xl z-10 space-y-4 animate-slide-up mb-14">
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
              Choisissez une action à créer ou insérer :
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setShowStudioMenu(false);
                  if (isScriptView) {
                    window.dispatchEvent(new CustomEvent("open-add-note"));
                  } else {
                    alert("Ouvrez une pièce dans votre bibliothèque pour y ajouter une note.");
                  }
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
                  if (isScriptView) {
                    window.dispatchEvent(new CustomEvent("open-add-replica"));
                  } else {
                    alert("Ouvrez une pièce dans votre bibliothèque pour y ajouter une réplique.");
                  }
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
                  if (isScriptView) {
                    window.dispatchEvent(new CustomEvent("open-add-character"));
                  } else {
                    alert("Ouvrez une pièce dans votre bibliothèque pour y ajouter un personnage.");
                  }
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
                className="p-3 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/30 rounded-2xl flex items-center gap-3 text-left transition active:scale-95"
              >
                <span className="text-2xl">🎙️</span>
                <div>
                  <div className="font-extrabold text-gold-300 text-xs">S'enregistrer (Audio)</div>
                  <div className="text-[10px] text-gray-400">Enregistrements audio libres</div>
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

      {/* 🎥 MODALE ENREGISTREUR VIDÉO */}
      {showVideoRecorder && (
        <VideoRecorderModal
          isOpen={true}
          onClose={() => setShowVideoRecorder(false)}
          onSave={handleSaveVideo}
          replicas={currentScript?.replicas || []}
          characters={currentScript?.characters || []}
          scenes={scenes}
        />
      )}
    </>
  );
}
