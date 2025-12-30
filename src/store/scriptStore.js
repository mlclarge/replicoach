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

  clearCurrentScript: () => {
    set({ currentScript: null });
  },
}));
