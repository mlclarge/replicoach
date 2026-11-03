import { SPEED_OPTIONS, LISTEN_MODES } from "../lib/listeningFilter";

function Step({ number, title, children }) {
  return (
    <section className="bg-white/80 rounded-xl border border-amber-300 p-3 space-y-2">
      <h3 className="text-xs font-extrabold text-amber-900 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px]">
          {number}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="flex gap-1" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          aria-pressed={value === opt.value}
          disabled={opt.disabled}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-40 ${
            value === opt.value
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-emerald-600"
      />
      <span className="text-xs font-bold text-gray-800">{children}</span>
    </label>
  );
}

export default function ListeningWorkflow({
  characters,
  rehearsal,
  onUpdate,
  onMyRoleChange,
  characterRecordings,
  voiceMode,
  scopeLabel,
  onOpenScenes,
  onCoach,
  speed,
  onSpeedChange,
  listenSummary,
  windowInvalid,
}) {
  const hasRole = !!rehearsal.myRole;

  return (
    <div className="p-3 bg-amber-100/90 border-b border-amber-200 w-full max-w-7xl mx-auto rounded-xl my-2 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-amber-900 font-bold flex items-center gap-1.5">
          <span>🎭</span> Réglages d'écoute
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenScenes}
            className="px-3 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-900 hover:bg-amber-50"
            title="Choisir la pièce entière ou une scène"
          >
            📍 {scopeLabel} ▾
          </button>
          {characters?.length > 0 && (
            <button
              type="button"
              onClick={onCoach}
              className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold rounded-lg text-xs shadow active:scale-95"
              title="Accompagnement Coach IA"
            >
              <span>✨</span>
              <span>Coach IA</span>
            </button>
          )}
        </div>
      </div>

      <Step number={1} title="Mon rôle">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            aria-pressed={!hasRole}
            onClick={() => onMyRoleChange("")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${
              !hasRole ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            Aucun
          </button>
          {characters.map((char) => {
            const selected = rehearsal.myRole === char.id;
            const hasRec = !!characterRecordings[char.id] && voiceMode[char.id] === "recorded";
            return (
              <button
                key={char.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onMyRoleChange(char.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap text-white transition ${
                  selected ? "ring-2 ring-offset-1 ring-gray-800" : "opacity-70 hover:opacity-100"
                }`}
                style={{ backgroundColor: char.color }}
              >
                {char.name} {hasRec && <span className="text-[10px]">🎙️</span>}
              </button>
            );
          })}
        </div>
        {hasRole && (
          <Toggle checked={rehearsal.hideMyRole} onChange={(v) => onUpdate({ hideMyRole: v })}>
            🙈 Masquer mon texte à la lecture
          </Toggle>
        )}
      </Step>

      <Step number={2} title="Répliques à écouter">
        <Segmented
          label="Filtrer l'écoute"
          value={rehearsal.listenMode}
          onChange={(v) => onUpdate({ listenMode: v })}
          options={[
            { value: LISTEN_MODES.all, label: "Tout" },
            { value: LISTEN_MODES.aroundMine, label: "Autour de mon rôle", disabled: !hasRole },
            { value: LISTEN_MODES.mineOnly, label: "Mon rôle seul", disabled: !hasRole },
          ]}
        />
        {!hasRole && (
          <p className="text-[11px] text-gray-500">Choisissez un rôle (étape 1) pour filtrer l'écoute.</p>
        )}
        {hasRole && rehearsal.listenMode === LISTEN_MODES.aroundMine && (
          <label className="block">
            <span className="text-xs font-bold text-gray-800 block mb-1">
              Durée écoutée avant et après chacune de mes répliques (en secondes)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={rehearsal.windowSec}
              onChange={(e) => onUpdate({ windowSec: e.target.value })}
              placeholder="ex. 10"
              aria-invalid={windowInvalid}
              className={`w-28 p-2 border rounded-lg text-xs bg-white font-semibold ${
                windowInvalid ? "border-red-500" : "border-gray-300"
              }`}
            />
            {windowInvalid && (
              <span className="text-[11px] text-red-600 block mt-1">
                Saisissez un nombre de secondes pour activer ce filtre.
              </span>
            )}
          </label>
        )}
        {listenSummary && <p className="text-[11px] text-emerald-800 font-semibold">{listenSummary}</p>}

        {hasRole && rehearsal.hideMyRole && (
          <div>
            <span className="text-xs font-bold text-gray-800 block mb-1">Lire mes répliques à voix haute</span>
            <Segmented
              label="Lecture de mes répliques"
              value={rehearsal.readMine}
              onChange={(v) => onUpdate({ readMine: v })}
              options={[
                { value: "none", label: "Non" },
                { value: "before", label: "Avant" },
                { value: "after", label: "Après" },
                { value: "both", label: "Les deux" },
              ]}
            />
          </div>
        )}
      </Step>

      <Step number={3} title="Vitesse de lecture">
        <Segmented
          label="Vitesse"
          value={speed}
          onChange={onSpeedChange}
          options={SPEED_OPTIONS.map((o) => ({ ...o, label: `${o.label} (${o.value}×)` }))}
        />
      </Step>

      <Step number={4} title="Annexes">
        <Toggle checked={rehearsal.hideStageDirections} onChange={(v) => onUpdate({ hideStageDirections: v })}>
          Cacher les didascalies
        </Toggle>
        <Toggle checked={!rehearsal.showNumbers} onChange={(v) => onUpdate({ showNumbers: !v })}>
          Cacher les numéros de répliques
        </Toggle>
        <div>
          <span className="text-xs font-bold text-gray-800 block mb-1">Mode d'écoute</span>
          <Segmented
            label="Mode d'écoute"
            value={rehearsal.playback}
            onChange={(v) => onUpdate({ playback: v })}
            options={[
              { value: "auto", label: "Automatique (continu)" },
              { value: "manual", label: "Manuel (réplique par réplique)" },
            ]}
          />
          {rehearsal.playback === "manual" && (
            <p className="text-[11px] text-gray-500 mt-1">
              Chaque appui sur ▶️ lit une réplique, puis la lecture s'arrête.
            </p>
          )}
        </div>
      </Step>
    </div>
  );
}
