import { useState, useMemo, useEffect } from "react";
import { SCRIPT_VIDEO_KEY, actVideoKey, sceneVideoKey } from "../lib/videoStorage";

/**
 * Sélecteur d'emplacement d'une vidéo dans un script :
 * pièce entière, acte, scène ou réplique (#numéro).
 * Remonte la clé de stockage via onChange(targetKey).
 */
export default function VideoAnchorPicker({ replicas = [], characters = [], scenes = [], onChange }) {
  const [scope, setScope] = useState("script");
  const [replicaNumber, setReplicaNumber] = useState(1);
  const [actTitle, setActTitle] = useState("");
  const [sceneIndex, setSceneIndex] = useState(0);

  const acts = useMemo(
    () => [...new Set(scenes.map((s) => s.actTitle).filter(Boolean))],
    [scenes]
  );

  const availableScopes = useMemo(() => {
    const list = [{ id: "script", label: "🎭 Pièce entière" }];
    if (acts.length > 0) list.push({ id: "act", label: "🎬 Un acte" });
    if (scenes.length > 0) list.push({ id: "scene", label: "🎞️ Une scène" });
    if (replicas.length > 0) list.push({ id: "replica", label: "#️⃣ Une réplique" });
    return list;
  }, [acts, scenes, replicas]);

  useEffect(() => {
    if (acts.length > 0 && !acts.includes(actTitle)) setActTitle(acts[0]);
  }, [acts, actTitle]);

  const targetKey = useMemo(() => {
    if (scope === "act") return actTitle ? actVideoKey(actTitle) : null;
    if (scope === "scene") {
      const scene = scenes[sceneIndex];
      return scene ? sceneVideoKey(scene.actTitle, scene.sceneTitle) : null;
    }
    if (scope === "replica") return replicas[replicaNumber - 1]?.id ?? null;
    return SCRIPT_VIDEO_KEY;
  }, [scope, actTitle, sceneIndex, replicaNumber, scenes, replicas]);

  useEffect(() => {
    if (onChange) onChange(targetKey, scope);
  }, [targetKey, scope]);

  const selectedReplica = replicas[replicaNumber - 1];
  const selectedReplicaCharacter = characters.find((c) => c.id === selectedReplica?.character_id);

  return (
    <div className="space-y-3 bg-gray-950/60 p-3.5 rounded-2xl border border-white/10 text-xs text-left">
      <label className="block text-gray-400 font-bold">📌 Insérer la vidéo dans le script :</label>
      <div className="flex flex-wrap gap-1.5">
        {availableScopes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScope(s.id)}
            className={`px-3 py-1.5 rounded-xl font-bold border transition ${
              scope === s.id
                ? "bg-amber-500 text-gray-950 border-amber-400"
                : "bg-gray-900 text-gray-300 border-gray-700 hover:border-amber-400"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {scope === "act" && (
        <select
          value={actTitle}
          onChange={(e) => setActTitle(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-amber-400"
        >
          {acts.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}

      {scope === "scene" && (
        <select
          value={sceneIndex}
          onChange={(e) => setSceneIndex(Number(e.target.value))}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-amber-400"
        >
          {scenes.map((s, idx) => (
            <option key={s.id} value={idx}>
              {s.fullLabel}
            </option>
          ))}
        </select>
      )}

      {scope === "replica" && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <label className="text-gray-400 font-bold">Réplique #</label>
            <input
              type="number"
              min={1}
              max={replicas.length}
              value={replicaNumber}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) setReplicaNumber(Math.min(Math.max(n, 1), replicas.length));
              }}
              className="w-24 bg-gray-900 border border-gray-700 rounded-xl p-2 text-white font-medium focus:outline-none focus:border-amber-400"
            />
            <span className="text-gray-500">/ {replicas.length}</span>
          </div>
          {selectedReplica && (
            <p className="text-gray-400 italic truncate">
              {selectedReplicaCharacter?.name || "Perso"} : {selectedReplica.text?.substring(0, 60)}...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
