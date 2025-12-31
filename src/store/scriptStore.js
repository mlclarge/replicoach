import { create } from "zustand";
import { supabase } from "../lib/supabase";

export const useScriptStore = create((set, get) => ({
  scripts: [],
  currentScript: null,
  loading: false,
  error: null,

  fetchScripts: async (userId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("scripts")
        .select(
          `
          *,
          characters (*),
          replicas (*)
        `
        )
        .eq("user_id", userId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      set({ scripts: data || [], loading: false });
    } catch (error) {
      console.error("Fetch scripts error:", error);
      set({ error: error.message, loading: false });
    }
  },

  fetchScript: async (scriptId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
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

      if (error) throw error;

      // Trier les répliques par order_index
      if (data.replicas) {
        data.replicas.sort((a, b) => a.order_index - b.order_index);
      }

      set({ currentScript: data, loading: false });
    } catch (error) {
      console.error("Fetch script error:", error);
      set({ error: error.message, loading: false });
    }
  },

  createScript: async (scriptData) => {
    try {
      // Récupérer le plus grand display_order actuel
      const { data: existingScripts } = await supabase
        .from("scripts")
        .select("display_order")
        .eq("user_id", scriptData.user_id)
        .order("display_order", { ascending: false })
        .limit(1);

      const nextOrder = (existingScripts?.[0]?.display_order || 0) + 1;

      const { data, error } = await supabase
        .from("scripts")
        .insert([{ ...scriptData, display_order: nextOrder }])
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        scripts: [...state.scripts, data],
      }));

      return data;
    } catch (error) {
      console.error("Create script error:", error);
      throw error;
    }
  },

  updateScript: async (scriptId, updates) => {
    try {
      const { data, error } = await supabase
        .from("scripts")
        .update(updates)
        .eq("id", scriptId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        scripts: state.scripts.map((s) => (s.id === scriptId ? { ...s, ...data } : s)),
        currentScript: state.currentScript?.id === scriptId 
          ? { ...state.currentScript, ...data } 
          : state.currentScript,
      }));

      return data;
    } catch (error) {
      console.error("Update script error:", error);
      throw error;
    }
  },

  updateScriptOrder: async (updates) => {
    try {
      // Mettre à jour chaque script avec son nouvel ordre
      for (const update of updates) {
        const { error } = await supabase
          .from("scripts")
          .update({ display_order: update.display_order })
          .eq("id", update.id);

        if (error) throw error;
      }

      // Mettre à jour le state local
      set((state) => ({
        scripts: state.scripts.map((script) => {
          const update = updates.find((u) => u.id === script.id);
          if (update) {
            return { ...script, display_order: update.display_order };
          }
          return script;
        }),
      }));
    } catch (error) {
      console.error("Update script order error:", error);
      throw error;
    }
  },

  deleteScript: async (scriptId) => {
    try {
      const { error } = await supabase
        .from("scripts")
        .delete()
        .eq("id", scriptId);

      if (error) throw error;

      set((state) => ({
        scripts: state.scripts.filter((s) => s.id !== scriptId),
      }));
    } catch (error) {
      console.error("Delete script error:", error);
      throw error;
    }
  },

  addCharacter: async (scriptId, characterData) => {
    try {
      const { data, error } = await supabase
        .from("characters")
        .insert([{ script_id: scriptId, ...characterData }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Add character error:", error);
      throw error;
    }
  },

  updateCharacter: async (characterId, updates) => {
    try {
      const { data, error } = await supabase
        .from("characters")
        .update(updates)
        .eq("id", characterId)
        .select()
        .single();

      if (error) throw error;

      // Mettre à jour le currentScript si nécessaire
      set((state) => {
        if (state.currentScript?.characters) {
          return {
            currentScript: {
              ...state.currentScript,
              characters: state.currentScript.characters.map((c) =>
                c.id === characterId ? { ...c, ...data } : c
              ),
            },
          };
        }
        return state;
      });

      return data;
    } catch (error) {
      console.error("Update character error:", error);
      throw error;
    }
  },

  addReplicas: async (replicas) => {
    try {
      const { data, error } = await supabase
        .from("replicas")
        .insert(replicas)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Add replicas error:", error);
      throw error;
    }
  },

  /**
   * Met à jour une réplique (texte et/ou personnage)
   * @param {string} replicaId - ID de la réplique
   * @param {object} updates - { character_id?, text?, text_gaps?, cue_words? }
   */
  updateReplica: async (replicaId, updates) => {
    try {
      // Si le texte change, recalculer text_gaps
      if (updates.text && !updates.text_gaps) {
        updates.text_gaps = generateGapsText(updates.text);
      }

      const { data, error } = await supabase
        .from("replicas")
        .update(updates)
        .eq("id", replicaId)
        .select()
        .single();

      if (error) throw error;

      // Mettre à jour le state local
      set((state) => {
        if (state.currentScript?.replicas) {
          return {
            currentScript: {
              ...state.currentScript,
              replicas: state.currentScript.replicas.map((r) =>
                r.id === replicaId ? { ...r, ...data } : r
              ),
            },
          };
        }
        return state;
      });

      return data;
    } catch (error) {
      console.error("Update replica error:", error);
      throw error;
    }
  },

  /**
   * Supprime une réplique
   */
  deleteReplica: async (replicaId) => {
    try {
      const { error } = await supabase
        .from("replicas")
        .delete()
        .eq("id", replicaId);

      if (error) throw error;

      // Mettre à jour le state local
      set((state) => {
        if (state.currentScript?.replicas) {
          return {
            currentScript: {
              ...state.currentScript,
              replicas: state.currentScript.replicas.filter((r) => r.id !== replicaId),
            },
          };
        }
        return state;
      });
    } catch (error) {
      console.error("Delete replica error:", error);
      throw error;
    }
  },

  /**
   * Ajoute une nouvelle réplique
   */
  addReplica: async (replicaData) => {
    try {
      // Générer text_gaps si non fourni
      if (replicaData.text && !replicaData.text_gaps) {
        replicaData.text_gaps = generateGapsText(replicaData.text);
      }

      const { data, error } = await supabase
        .from("replicas")
        .insert([replicaData])
        .select()
        .single();

      if (error) throw error;

      // Mettre à jour le state local
      set((state) => {
        if (state.currentScript) {
          const newReplicas = [...(state.currentScript.replicas || []), data];
          newReplicas.sort((a, b) => a.order_index - b.order_index);
          return {
            currentScript: {
              ...state.currentScript,
              replicas: newReplicas,
            },
          };
        }
        return state;
      });

      return data;
    } catch (error) {
      console.error("Add replica error:", error);
      throw error;
    }
  },

  /**
   * Réordonne les répliques
   */
  reorderReplicas: async (scriptId, replicaIds) => {
    try {
      // Mettre à jour l'order_index de chaque réplique
      for (let i = 0; i < replicaIds.length; i++) {
        const { error } = await supabase
          .from("replicas")
          .update({ order_index: i })
          .eq("id", replicaIds[i]);

        if (error) throw error;
      }

      // Mettre à jour le state local
      set((state) => {
        if (state.currentScript?.replicas) {
          const replicasMap = new Map(
            state.currentScript.replicas.map((r) => [r.id, r])
          );
          const reorderedReplicas = replicaIds
            .map((id, index) => {
              const replica = replicasMap.get(id);
              return replica ? { ...replica, order_index: index } : null;
            })
            .filter(Boolean);

          return {
            currentScript: {
              ...state.currentScript,
              replicas: reorderedReplicas,
            },
          };
        }
        return state;
      });
    } catch (error) {
      console.error("Reorder replicas error:", error);
      throw error;
    }
  },

  clearCurrentScript: () => {
    set({ currentScript: null });
  },
}));

/**
 * Génère le texte à trous
 */
function generateGapsText(text) {
  return text.replace(/\b(\w)(\w+)\b/g, (match, first, rest) => {
    return first + '_'.repeat(Math.min(rest.length, 5));
  });
}
