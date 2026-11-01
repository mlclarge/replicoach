/**
 * Composant Lecteur Vidéo Immersif ancré dans le fil du texte ou d'une scène
 */
export default function VideoBubble({
  video,
  character,
  onDelete,
}) {
  const characterColor = character?.color || "#8B5CF6";

  return (
    <div className="my-3 p-3.5 bg-gradient-to-r from-gray-900 via-gray-950 to-gray-900 border-2 rounded-2xl shadow-xl animate-fade-in max-w-[95%] sm:max-w-[85%] mx-auto"
      style={{ borderColor: characterColor }}
    >
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎥</span>
          <div>
            <h4 className="font-extrabold text-amber-300 text-xs sm:text-sm">
              {video.title || "Vidéo de travail"}
            </h4>
            <p className="text-[10px] text-gray-400 font-semibold">
              {character?.name ? `Pour ${character.name}` : "Enregistrement vidéo"}
            </p>
          </div>
        </div>

        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
          title="Supprimer la vidéo"
        >
          🗑️
        </button>
      </div>

      <div className="relative bg-black rounded-xl overflow-hidden aspect-video shadow-inner border border-white/10">
        <video
          src={video.data}
          controls
          playsInline
          className="w-full h-full object-cover"
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
