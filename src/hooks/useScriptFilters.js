import { useState, useEffect, useCallback } from "react";

/**
 * Hook réutilisable pour verrouiller/persister les filtres de lecture et d'écoute audio d'un script.
 * Sauvegarde automatique dans localStorage et synchronisation entre Mode Lecture et Mode Audio.
 */
export function useScriptFilters(scriptId) {
  const storageKey = scriptId ? `replicoach_filters_${scriptId}` : null;
  const rehearsalKey = scriptId ? `rehearsal-${scriptId}` : null;

  const [myCharacterId, setMyCharacterIdState] = useState(null);
  const [selectedCharacter, setSelectedCharacterState] = useState(null);
  const [filterMode, setFilterModeState] = useState("all"); // "all" | "role"
  const [contextBefore, setContextBeforeState] = useState(1); // 0, 1, 2, 3
  const [selectedSceneKey, setSelectedSceneKeyState] = useState(null);
  const [hideMyReplicas, setHideMyReplicasState] = useState(false);

  // Charger les filtres au montage / changement de scriptId
  useEffect(() => {
    if (!storageKey) return;
    try {
      // 1. Lire depuis `replicoach_filters_${scriptId}`
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.myCharacterId !== undefined) setMyCharacterIdState(parsed.myCharacterId);
        if (parsed.selectedCharacter !== undefined) setSelectedCharacterState(parsed.selectedCharacter);
        if (parsed.filterMode !== undefined) setFilterModeState(parsed.filterMode);
        if (parsed.contextBefore !== undefined) setContextBeforeState(parsed.contextBefore);
        if (parsed.selectedSceneKey !== undefined) setSelectedSceneKeyState(parsed.selectedSceneKey);
        if (parsed.hideMyReplicas !== undefined) setHideMyReplicasState(parsed.hideMyReplicas);
        return;
      }

      // 2. Fallback : lire depuis `rehearsal-${scriptId}` si présent
      if (rehearsalKey) {
        const rehearsalSaved = localStorage.getItem(rehearsalKey);
        if (rehearsalSaved) {
          const parsedRehearsal = JSON.parse(rehearsalSaved);
          if (parsedRehearsal.myRole) setMyCharacterIdState(parsedRehearsal.myRole);
          if (parsedRehearsal.listenMode) setFilterModeState(parsedRehearsal.listenMode === "role" ? "role" : "all");
          if (parsedRehearsal.contextLines !== undefined) setContextBeforeState(parsedRehearsal.contextLines);
        }
      }
    } catch (e) {
      console.error("Erreur chargement des filtres persistant:", e);
    }
  }, [scriptId, storageKey, rehearsalKey]);

  // Fonction helper pour persister l'état courant
  const saveFilters = (newFilters) => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(newFilters));

      // Également synchroniser avec `rehearsal-${scriptId}` pour le Mode Audio
      if (rehearsalKey) {
        const existingRehearsal = JSON.parse(localStorage.getItem(rehearsalKey) || "{}");
        const updatedRehearsal = {
          ...existingRehearsal,
          myRole: newFilters.myCharacterId,
          listenMode: newFilters.filterMode,
          contextLines: newFilters.contextBefore,
        };
        localStorage.setItem(rehearsalKey, JSON.stringify(updatedRehearsal));
      }
    } catch (e) {
      console.error("Erreur sauvegarde des filtres:", e);
    }
  };

  const updateMyCharacterId = (val) => {
    setMyCharacterIdState(val);
    saveFilters({
      myCharacterId: val,
      selectedCharacter,
      filterMode,
      contextBefore,
      selectedSceneKey,
      hideMyReplicas,
    });
  };

  const updateSelectedCharacter = (val) => {
    setSelectedCharacterState(val);
    saveFilters({
      myCharacterId,
      selectedCharacter: val,
      filterMode,
      contextBefore,
      selectedSceneKey,
      hideMyReplicas,
    });
  };

  const updateFilterMode = (val) => {
    setFilterModeState(val);
    saveFilters({
      myCharacterId,
      selectedCharacter,
      filterMode: val,
      contextBefore,
      selectedSceneKey,
      hideMyReplicas,
    });
  };

  const updateContextBefore = (val) => {
    setContextBeforeState(val);
    saveFilters({
      myCharacterId,
      selectedCharacter,
      filterMode,
      contextBefore: val,
      selectedSceneKey,
      hideMyReplicas,
    });
  };

  const updateSelectedSceneKey = (val) => {
    setSelectedSceneKeyState(val);
    saveFilters({
      myCharacterId,
      selectedCharacter,
      filterMode,
      contextBefore,
      selectedSceneKey: val,
      hideMyReplicas,
    });
  };

  const updateHideMyReplicas = (val) => {
    setHideMyReplicasState(val);
    saveFilters({
      myCharacterId,
      selectedCharacter,
      filterMode,
      contextBefore,
      selectedSceneKey,
      hideMyReplicas: val,
    });
  };

  // Remise à zéro explicite
  const resetFilters = useCallback(() => {
    setMyCharacterIdState(null);
    setSelectedCharacterState(null);
    setFilterModeState("all");
    setContextBeforeState(1);
    setSelectedSceneKeyState(null);
    setHideMyReplicasState(false);

    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
    }
    if (rehearsalKey) {
      try {
        const existingRehearsal = JSON.parse(localStorage.getItem(rehearsalKey) || "{}");
        delete existingRehearsal.myRole;
        existingRehearsal.listenMode = "all";
        existingRehearsal.contextLines = 1;
        localStorage.setItem(rehearsalKey, JSON.stringify(existingRehearsal));
      } catch (e) {}
    }
  }, [storageKey, rehearsalKey]);

  const hasActiveFilters = Boolean(
    myCharacterId || selectedCharacter || filterMode !== "all" || selectedSceneKey || hideMyReplicas || contextBefore !== 1
  );

  return {
    myCharacterId,
    setMyCharacterId: updateMyCharacterId,
    selectedCharacter,
    setSelectedCharacter: updateSelectedCharacter,
    filterMode,
    setFilterMode: updateFilterMode,
    contextBefore,
    setContextBefore: updateContextBefore,
    selectedSceneKey,
    setSelectedSceneKey: updateSelectedSceneKey,
    hideMyReplicas,
    setHideMyReplicas: updateHideMyReplicas,
    resetFilters,
    hasActiveFilters,
  };
}

export default useScriptFilters;
