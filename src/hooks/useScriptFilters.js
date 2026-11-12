import { useState, useEffect, useCallback, useRef } from "react";

const DEFAULT_FILTERS = {
  myCharacterId: null,
  selectedCharacter: null,
  filterMode: "all", // "all" | "role"
  contextBefore: 1, // 0, 1, 2, 3
  selectedSceneKey: null,
  hideMyReplicas: false,
};

/**
 * Hook réutilisable pour persister les filtres de lecture d'un script (par texte).
 * Sauvegarde automatique dans localStorage ; le rôle choisi est partagé avec le Mode Audio.
 */
export function useScriptFilters(scriptId) {
  const storageKey = scriptId ? `replicoach_filters_${scriptId}` : null;
  const rehearsalKey = scriptId ? `rehearsal-${scriptId}` : null;

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  // Valeur la plus récente : plusieurs setters peuvent être appelés dans le même rendu
  const filtersRef = useRef(DEFAULT_FILTERS);

  const persist = useCallback(
    (next) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));

        // Seul le rôle est synchronisé avec le Mode Audio (ses modes d'écoute sont distincts)
        if (rehearsalKey) {
          const existing = JSON.parse(localStorage.getItem(rehearsalKey) || "{}");
          localStorage.setItem(
            rehearsalKey,
            JSON.stringify({ ...existing, myRole: next.myCharacterId || null })
          );
        }
      } catch (e) {
        console.error("Erreur sauvegarde des filtres:", e);
      }
    },
    [storageKey, rehearsalKey]
  );

  // Charger les filtres au montage / changement de scriptId
  useEffect(() => {
    let loaded = { ...DEFAULT_FILTERS };
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) loaded = { ...loaded, ...JSON.parse(saved) };

        // Le rôle fait foi dans `rehearsal-${scriptId}` (modifiable aussi depuis le Mode Audio)
        const rehearsalSaved = rehearsalKey && localStorage.getItem(rehearsalKey);
        if (rehearsalSaved) {
          const parsed = JSON.parse(rehearsalSaved);
          if ("myRole" in parsed) loaded.myCharacterId = parsed.myRole || null;
        }
      } catch (e) {
        console.error("Erreur chargement des filtres persistant:", e);
      }
    }
    filtersRef.current = loaded;
    setFilters(loaded);
  }, [storageKey, rehearsalKey]);

  const update = useCallback(
    (patch) => {
      const next = { ...filtersRef.current, ...patch };
      filtersRef.current = next;
      setFilters(next);
      persist(next);
    },
    [persist]
  );

  // Remise à zéro explicite
  const resetFilters = useCallback(() => {
    filtersRef.current = { ...DEFAULT_FILTERS };
    setFilters({ ...DEFAULT_FILTERS });

    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
    }
    if (rehearsalKey) {
      try {
        const existing = JSON.parse(localStorage.getItem(rehearsalKey) || "{}");
        delete existing.myRole;
        existing.listenMode = "all";
        localStorage.setItem(rehearsalKey, JSON.stringify(existing));
      } catch (e) {}
    }
  }, [storageKey, rehearsalKey]);

  const hasActiveFilters = Boolean(
    filters.myCharacterId ||
      filters.selectedCharacter ||
      filters.filterMode !== "all" ||
      filters.selectedSceneKey ||
      filters.hideMyReplicas ||
      filters.contextBefore !== 1
  );

  return {
    myCharacterId: filters.myCharacterId,
    setMyCharacterId: (val) => update({ myCharacterId: val }),
    selectedCharacter: filters.selectedCharacter,
    setSelectedCharacter: (val) => update({ selectedCharacter: val }),
    filterMode: filters.filterMode,
    setFilterMode: (val) => update({ filterMode: val }),
    contextBefore: filters.contextBefore,
    setContextBefore: (val) => update({ contextBefore: val }),
    selectedSceneKey: filters.selectedSceneKey,
    setSelectedSceneKey: (val) => update({ selectedSceneKey: val }),
    hideMyReplicas: filters.hideMyReplicas,
    setHideMyReplicas: (val) => update({ hideMyReplicas: val }),
    resetFilters,
    hasActiveFilters,
  };
}

export default useScriptFilters;
