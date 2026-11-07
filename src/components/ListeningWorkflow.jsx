import { useState } from "react";
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
  delayBeforeMs,
  delayAfterMs,
  delayBeforeOptions = [1000, 1500, 2000, 2500, 3000],
  delayAfterOptions = [500, 1000, 1500, 2000],
  onDelaysChange,
  onResetFilters,
  hasActiveFilters,
}) {
  const hasRole = !!rehearsal.myRole;
  const formatSeconds = (ms) => `${String(ms / 1000).replace(".", ",")} s`;
  const [open, setOpen] = useState(false);

  return (
    <div className="p-3 bg-amber-100/90 border-b border-amber-200 w-full max-w-7xl mx-auto rounded-xl my-2 space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <span className="text-xs sm:text-sm text-amber-900 font-bold flex items-center gap-1.5 flex-wrap">
          <span>🎭</span>
          <span>Réglages d'écoute</span>
          <span className="font-normal text-amber-800">
            · rôle, répliques, vitesse, annexes — {scopeLabel}
          </span>
        </span>
        <span className="text-xs text-amber-900 flex-shrink-0">{open ? "▲" : "▼"}</span>
      </button>
      {!open && listenSummary && (
        <p className="text-[11px] text-amber-800 -mt-1">{listenSummary}</p>
      )}
      {open && (
      <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-amber-900 font-bold flex items-center gap-1.5">
          <span>📍</span> Périmètre d'écoute
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
          {onResetFilters && (hasActiveFilters ?? (!!rehearsal.myRole || rehearsal.listenMode !== LISTEN_MODES.all || scopeLabel !== "Pièce entière")) && (
            <button
              type="button"
              onClick={onResetFilters}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white border border-red-700 text-xs font-extrabold rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
              title="Remise à zéro de tous les filtres"
            >
              <span>🔄</span>
              <span>Remise à zéro des filtres</span>
            </button>
          )}
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
                  selected
                    ? "ring-2 ring-offset-1 ring-gray-800"
                    : hasRole && rehearsal.dimOthers
                    ? "opacity-40 blur-[1.5px] hover:opacity-90 hover:blur-0 active:blur-0 active:opacity-90"
                    : "opacity-70 hover:opacity-100"
                }`}
                style={{ backgroundColor: char.color }}
              >
                {char.name} {hasRec && <span className="text-[10px]">🎙️</span>}
              </button>
            );
          })}
        </div>
        {hasRole && (
          <>
            <Toggle checked={rehearsal.hideMyRole} onChange={(v) => onUpdate({ hideMyRole: v })}>
              🙈 Masquer mon texte à la lecture
            </Toggle>
            <Toggle checked={rehearsal.dimOthers} onChange={(v) => onUpdate({ dimOthers: v })}>
              🌫️ Estomper les autres rôles
            </Toggle>
          </>
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
          <div className="space-y-2">
            <div>
              <span className="text-xs font-bold text-gray-800 block mb-1">
                Répliques entendues avant la mienne
              </span>
              <Segmented
                label="Répliques avant"
                value={rehearsal.beforeCount}
                onChange={(v) => onUpdate({ beforeCount: v })}
                options={[0, 1, 2, 3].map((n) => ({ value: n, label: String(n) }))}
              />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-800 block mb-1">
                Répliques entendues après la mienne
              </span>
              <Segmented
                label="Répliques après"
                value={rehearsal.afterCount}
                onChange={(v) => onUpdate({ afterCount: v })}
                options={[0, 1, 2, 3].map((n) => ({ value: n, label: String(n) }))}
              />
            </div>
          </div>
        )}
        {hasRole && rehearsal.listenMode === LISTEN_MODES.mineOnly && (
          <p className="text-[11px] text-gray-600">
            N'écoute que les répliques de votre rôle, sur la pièce entière ou la scène choisie.
          </p>
        )}
        {listenSummary && <p className="text-[11px] text-emerald-800 font-semibold">{listenSummary}</p>}

        {/* ⚡ OPTIMISATION : Toggle pour filtrage visuel des répliques non écoutées */}
        {hasRole && rehearsal.listenMode !== LISTEN_MODES.all && (
          <div className="mt-2 pt-2 border-t border-amber-200">
            <Toggle
              checked={rehearsal.hideUnlistened || false}
              onChange={(v) => onUpdate({ hideUnlistened: v })}
            >
              👁️ Masquer visuellement les répliques non écoutées
            </Toggle>
          </div>
        )}

        {hasRole && rehearsal.hideMyRole && (
          <div className="mt-2">
            <span className="text-xs font-bold text-gray-800 block mb-1">Quand arrive ma réplique</span>
            <Segmented
              label="Quand arrive ma réplique"
              value={rehearsal.readMine}
              onChange={(v) => onUpdate({ readMine: v })}
              options={[
                { value: "memory", label: "🤫 Je la dis de mémoire" },
                { value: "read", label: "🔊 L'application me la lit" },
              ]}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              {rehearsal.readMine === "read"
                ? "Votre réplique est lue à voix haute, puis la lecture vous laisse la répéter."
                : "L'application se tait et attend. Cliquez sur votre réplique pour la révéler si besoin."}
            </p>
          </div>
        )}

        {hasRole && onDelaysChange && (
          <div className="space-y-2 rounded-lg bg-amber-50 border border-amber-300 p-2 mt-2">
            <span className="text-xs font-extrabold text-amber-900 block">
              ⏱️ Temps pour dire ma réplique
            </span>
            {rehearsal.hideMyRole && rehearsal.readMine === "read" && (
              <div>
                <span className="text-xs font-bold text-gray-800 block mb-1">
                  Attente avant que l'application lise ma réplique
                </span>
                <Segmented
                  label="Attente avant ma réplique"
                  value={delayBeforeMs}
                  onChange={(v) => onDelaysChange(v, delayAfterMs)}
                  options={delayBeforeOptions.map((ms) => ({ value: ms, label: formatSeconds(ms) }))}
                />
              </div>
            )}
            <div>
              <span className="text-xs font-bold text-gray-800 block mb-1">
                Pause après ma réplique (avant la réplique suivante)
              </span>
              <Segmented
                label="Pause après ma réplique"
                value={delayAfterMs}
                onChange={(v) => onDelaysChange(delayBeforeMs, v)}
                options={delayAfterOptions.map((ms) => ({ value: ms, label: formatSeconds(ms) }))}
              />
            </div>
            <p className="text-[11px] text-gray-500">
              Un compte à rebours s'affiche pendant ces pauses. Enregistré automatiquement.
            </p>
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
      </>
      )}
    </div>
  );
}
