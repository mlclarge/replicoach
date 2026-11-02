import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";
import { useScriptStore } from "../store/scriptStore";
import AICoachingModal from "./AICoachingModal";
import PremiumGateModal from "./PremiumGateModal";

const lastScriptKey = "coach-hub-script";
const roleKey = (scriptId) => `coach-hub-role-${scriptId}`;

export default function CoachingHub() {
  const { user, isPremium } = useAuthStore();
  const { scripts, addPersonalNote } = useScriptStore();

  const [scriptId, setScriptId] = useState("");
  const [characters, setCharacters] = useState([]);
  const [replicas, setReplicas] = useState([]);
  const [characterId, setCharacterId] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showPremium, setShowPremium] = useState(false);

  useEffect(() => {
    if (scriptId || !scripts?.length) return;
    const saved = localStorage.getItem(lastScriptKey);
    setScriptId(scripts.some((s) => s.id === saved) ? saved : scripts[0].id);
  }, [scripts, scriptId]);

  useEffect(() => {
    if (!scriptId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase.from("characters").select("*").eq("script_id", scriptId),
      supabase
        .from("replicas")
        .select("*")
        .eq("script_id", scriptId)
        .order("order_index", { ascending: true }),
    ]).then(([{ data: chars }, { data: reps }]) => {
      if (cancelled) return;
      const list = chars || [];
      setCharacters(list);
      setReplicas(reps || []);
      const savedRole = localStorage.getItem(roleKey(scriptId));
      setCharacterId(list.some((c) => c.id === savedRole) ? savedRole : "");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [scriptId]);

  const handleScriptChange = (id) => {
    setScriptId(id);
    localStorage.setItem(lastScriptKey, id);
  };

  const handleCharacterChange = (id) => {
    setCharacterId(id);
    if (id) localStorage.setItem(roleKey(scriptId), id);
  };

  const handleStart = () => {
    if (!isPremium) {
      setShowPremium(true);
      return;
    }
    setOpen(true);
  };

  const handleSaveAsNote = async ({ text, type }) => {
    await addPersonalNote({
      user_id: user.id,
      script_id: scriptId,
      after_replica_id: null,
      text,
      note_type: type,
    });
  };

  if (!scripts?.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-sm text-gray-300">
        <h2 className="text-lg font-extrabold text-white mb-1">✨ Coaching IA</h2>
        Importez d'abord un texte pour obtenir de l'aide au jeu.
      </div>
    );
  }

  const selectClass =
    "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400";

  return (
    <div className="bg-gradient-to-br from-primary-950/60 via-gray-900 to-purple-950/40 border border-amber-500/40 rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
          <span>✨</span> Coaching IA
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Choisissez votre texte et votre personnage : l'IA vous aide à construire votre jeu.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold text-gray-300 mb-1 block">Texte</span>
          <select
            value={scriptId}
            onChange={(e) => handleScriptChange(e.target.value)}
            className={selectClass}
          >
            {scripts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold text-gray-300 mb-1 block">
            Quel personnage jouez-vous ?
          </span>
          <select
            value={characterId}
            onChange={(e) => handleCharacterChange(e.target.value)}
            disabled={loading || !characters.length}
            className={selectClass}
          >
            <option value="">{loading ? "Chargement…" : "Choisir un personnage"}</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={handleStart}
        disabled={!characterId || loading}
        className="w-full py-3 rounded-xl font-bold text-sm bg-amber-500 text-gray-900 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        ✨ Lancer le coaching{!isPremium ? " (Premium)" : ""}
      </button>

      {open && (
        <AICoachingModal
          isOpen={true}
          onClose={() => setOpen(false)}
          characterName={characters.find((c) => c.id === characterId)?.name || "Personnage"}
          scriptText={replicas
            .map((r) => `${characters.find((c) => c.id === r.character_id)?.name || ""}: ${r.text}`)
            .join("\n\n")}
          coachingCharacterId={characterId}
          allCharacters={characters}
          allReplicas={replicas}
          onSaveAsNote={handleSaveAsNote}
        />
      )}

      {showPremium && (
        <PremiumGateModal featureKey="AI_COACHING" onClose={() => setShowPremium(false)} />
      )}
    </div>
  );
}
