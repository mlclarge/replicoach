import { create } from "zustand";
import { supabase } from "../lib/supabase";

export const useScriptStore = create((set, get) => ({
  scripts: [],
  currentScript: null,
  loading: false,
  error: null,

  // Récupérer tous les scripts de l'utilisateur
  fetchScripts: async (userId) => {
    set({ loading: true, error: null });

    const { data: scripts, error } = await supabase
      .from("scripts")
      .select(
        `
        *,
        characters (*)
      `
      )
      .eq("user_id", userId)
      .order("display_order", { ascending: true });

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }

    set({ scripts: scripts || [], loading: false });
  },

  // Récupérer un script avec ses personnages et répliques
  fetchScript: async (scriptId) => {
    set({ loading: true, error: null });

    const { data: script, error } = await supabase
      .from("scripts")
      .select(
        `
        *,
        characters (*),
        replicas (*)
      `
      )
      .eq("id", scriptId)
      .single();

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }

    // Trier les répliques par order_index
    if (script.replicas) {
      script.replicas.sort((a, b) => a.order_index - b.order_index);
    }

    set({ currentScript: script, loading: false });
  },

  // Créer un nouveau script
  createScript: async (scriptData) => {
    // Récupérer le prochain display_order
    const { data: existingScripts } = await supabase
      .from("scripts")
      .select("display_order")
      .eq("user_id", scriptData.user_id)
      .order("display_order", { ascending: false })
      .limit(1);

    const nextOrder =
      existingScripts && existingScripts.length > 0
        ? (existingScripts[0].display_order || 0) + 1
        : 1;

    const { data, error } = await supabase
      .from("scripts")
      .insert([{ ...scriptData, display_order: nextOrder }])
      .select()
      .single();

    if (error) throw error;

    set((state) => ({
      scripts: [...state.scripts, { ...data, characters: [] }],
    }));

    return data;
  },

  // Mettre à jour un script
  updateScript: async (scriptId, updates) => {
    const { data, error } = await supabase
      .from("scripts")
      .update(updates)
      .eq("id", scriptId)
      .select()
      .single();

    if (error) throw error;

    set((state) => ({
      scripts: state.scripts.map((s) =>
        s.id === scriptId ? { ...s, ...data } : s
      ),
      currentScript:
        state.currentScript?.id === scriptId
          ? { ...state.currentScript, ...data }
          : state.currentScript,
    }));

    return data;
  },

  // Supprimer un script
  deleteScript: async (scriptId) => {
    const { error } = await supabase
      .from("scripts")
      .delete()
      .eq("id", scriptId);

    if (error) throw error;

    set((state) => ({
      scripts: state.scripts.filter((s) => s.id !== scriptId),
      currentScript:
        state.currentScript?.id === scriptId ? null : state.currentScript,
    }));
  },

  // Ajouter un personnage
  addCharacter: async (scriptId, characterData) => {
    const { data, error } = await supabase
      .from("characters")
      .insert([{ script_id: scriptId, ...characterData }])
      .select()
      .single();

    if (error) throw error;

    set((state) => ({
      currentScript: state.currentScript
        ? {
            ...state.currentScript,
            characters: [...(state.currentScript.characters || []), data],
          }
        : null,
    }));

    return data;
  },

  // Mettre à jour un personnage
  updateCharacter: async (characterId, updates) => {
    const { data, error } = await supabase
      .from("characters")
      .update(updates)
      .eq("id", characterId)
      .select()
      .single();

    if (error) throw error;

    set((state) => ({
      currentScript: state.currentScript
        ? {
            ...state.currentScript,
            characters: state.currentScript.characters.map((c) =>
              c.id === characterId ? { ...c, ...data } : c
            ),
          }
        : null,
    }));

    return data;
  },

  // Ajouter des répliques en lot
  addReplicas: async (replicasData) => {
    const { data, error } = await supabase
      .from("replicas")
      .insert(replicasData)
      .select();

    if (error) throw error;

    set((state) => ({
      currentScript: state.currentScript
        ? {
            ...state.currentScript,
            replicas: [
              ...(state.currentScript.replicas || []),
              ...data,
            ].sort((a, b) => a.order_index - b.order_index),
          }
        : null,
    }));

    return data;
  },

  // Ajouter une seule réplique
  addReplica: async (replicaData) => {
    const { data, error } = await supabase
      .from("replicas")
      .insert([replicaData])
      .select()
      .single();

    if (error) throw error;

    set((state) => ({
      currentScript: state.currentScript
        ? {
            ...state.currentScript,
            replicas: [...(state.currentScript.replicas || []), data].sort(
              (a, b) => a.order_index - b.order_index
            ),
          }
        : null,
    }));

    return data;
  },

  // Mettre à jour une réplique
  updateReplica: async (replicaId, updates) => {
    // Générer le texte à trous si le texte change
    if (updates.text) {
      updates.text_gaps = generateGapsText(updates.text);
    }

    const { data, error } = await supabase
      .from("replicas")
      .update(updates)
      .eq("id", replicaId)
      .select()
      .single();

    if (error) throw error;

    // Mettre à jour le state local immédiatement
    set((state) => ({
      currentScript: state.currentScript
        ? {
            ...state.currentScript,
            replicas: state.currentScript.replicas.map((r) =>
              r.id === replicaId ? { ...r, ...data } : r
            ),
          }
        : null,
    }));

    return data;
  },

  // Supprimer une réplique
  deleteReplica: async (replicaId) => {
    const { error } = await supabase
      .from("replicas")
      .delete()
      .eq("id", replicaId);

    if (error) throw error;

    set((state) => ({
      currentScript: state.currentScript
        ? {
            ...state.currentScript,
            replicas: state.currentScript.replicas.filter(
              (r) => r.id !== replicaId
            ),
          }
        : null,
    }));
  },

  // Réordonner les répliques
  reorderReplicas: async (scriptId, replicaIds) => {
    const updates = replicaIds.map((id, index) => ({
      id,
      order_index: index,
    }));

    for (const update of updates) {
      await supabase
        .from("replicas")
        .update({ order_index: update.order_index })
        .eq("id", update.id);
    }

    set((state) => ({
      currentScript: state.currentScript
        ? {
            ...state.currentScript,
            replicas: state.currentScript.replicas
              .map((r) => {
                const newIndex = replicaIds.indexOf(r.id);
                return newIndex !== -1 ? { ...r, order_index: newIndex } : r;
              })
              .sort((a, b) => a.order_index - b.order_index),
          }
        : null,
    }));
  },

  // Mettre à jour l'ordre des scripts
  updateScriptOrder: async (updates) => {
    for (const update of updates) {
      await supabase
        .from("scripts")
        .update({ display_order: update.display_order })
        .eq("id", update.id);
    }

    set((state) => ({
      scripts: state.scripts
        .map((script) => {
          const update = updates.find((u) => u.id === script.id);
          return update
            ? { ...script, display_order: update.display_order }
            : script;
        })
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
    }));
  },

  // Vider le script courant
  clearCurrentScript: () => {
    set({ currentScript: null });
  },
}));

// Helper pour générer le texte à trous
function generateGapsText(text) {
  return text.replace(/\b(\w)(\w+)\b/g, (match, first, rest) => {
    return first + "_".repeat(Math.min(rest.length, 5));
  });
}
