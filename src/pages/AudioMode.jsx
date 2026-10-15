import { useEffect, useState, useRef, forwardRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import { fetchCharacterRecordings, supabase } from "../lib/supabase";
import Loader from "../components/ui/Loader";

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return tmp.textContent || tmp.innerText || "";
}

function AudioMode() {
  const { id } = useParams();
  const { user, isPremium } = useAuthStore();
  const { currentScript, loading, fetchScript } = useScriptStore();

  useEffect(() => {
    if (id) fetchScript(id);
  }, [id, fetchScript]);

  if (loading || !currentScript) {
    return (
      <div className="flex justify-center py-12 min-h-screen">
        <Loader />
      </div>
    );
  }

  const { title, characters = [], replicas = [] } = currentScript;

  return (
    <div className="min-h-screen bg-darker pb-56 w-full">
      {/* En-tête Sticky Pleine Page */}
      <div className="bg-gradient-to-b from-primary-800 to-primary-900 p-4 shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between gap-3 w-full max-w-7xl mx-auto">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 px-3 py-2 bg-black/60 hover:bg-black text-white rounded-xl transition text-xs font-semibold border border-white/20"
          >
            <span className="text-base">←</span>
            <span>Retour</span>
          </button>
          <div className="min-w-0">
            <h2 className="text-gold-400 text-base sm:text-lg font-bold truncate">
              🔊 Mode Audio : {title}
            </h2>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 w-full max-w-7xl mx-auto">
        {replicas.map((replica, index) => {
          const character = characters.find((c) => c.id === replica.character_id);
          return (
            <AudioBubble
              key={replica.id}
              replica={replica}
              character={character}
              number={index + 1}
            />
          );
        })}
      </div>
    </div>
  );
}

const AudioBubble = forwardRef(({ replica, character, number }, ref) => {
  const bubbleColor = character?.color || "#6B7280";

  return (
    <div
      ref={ref}
      className="p-4 sm:p-5 rounded-2xl transition-all duration-300 shadow-md text-white"
      style={{ backgroundColor: bubbleColor }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs sm:text-sm font-bold text-white drop-shadow">
          {character?.name || "Personnage"}
        </span>
        <span className="text-[10px] text-white/80 font-mono">#{number}</span>
      </div>
      <p className="text-white text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
        {stripHtml(replica.text)}
      </p>
    </div>
  );
});

AudioBubble.displayName = "AudioBubble";

export default AudioMode;
