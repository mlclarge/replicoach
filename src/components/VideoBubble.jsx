/**
 * Composant Lecteur Vidéo Immersif ancré dans le fil du texte ou d'une scène
 * Design réactif optimisé sur Mobile et PC
 */
export default function VideoBubble({
  video,
  character,
  onDelete,
}) {
  const characterColor = character?.color || "#8B5CF6";

  return (
    <div
      className="my-4 p-3.5 sm:p-4 bg-gradient-to-r from-gray-900 via-gray-950 to-gray-900 border-2 rounded-2xl shadow-2xl animate-fade-in w-full max-w-lg mx-auto clear-both"
      style={{ borderColor: characterColor }}
    >
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base font-extrabold shadow-sm flex-shrink-0"
            style={{ backgroundColor: `${characterColor}33`, color: characterColor }}
          >
            🎥
          </div>
          <div className="min-w-0">
            <h4 className="font-extrabold text-amber-300 text-xs sm:text-sm truncate">
              {video.title || "Vidéo de travail"}
            </h4>
            <p className="text-[10px] text-gray-400 font-semibold truncate">
              {character?.name ? `Rôle : ${character.name}` : "Enregistrement vidéo"}
            </p>
          </div>
        </div>

        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition flex-shrink-0"
            title="Supprimer la vidéo"
          >
            🗑️
          </button>
        )}
      </div>

      {/* Container vidéo adapté Mobile & PC */}
      <div className="relative bg-black rounded-xl overflow-hidden shadow-inner border border-white/10 flex items-center justify-center max-h-[380px]">
        <video
          src={video.data}
          controls
          playsInline
          className="w-full max-h-[360px] object-contain mx-auto rounded-lg"
        />
      </div>

      {video.date && (
        <div className="mt-2 flex justify-end">
          <span className="text-[10px] text-gray-400 font-mono">
            📅 {new Date(video.date).toLocaleDateString("fr-FR")} à {new Date(video.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )}
    </div>
  );
}
