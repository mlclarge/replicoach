import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useScriptStore = create((set, get) => ({
  scripts: [],
  currentScript: null,
  loading: false,
  error: null,

  // 1. Charger tous les scripts de l'utilisateur (découplé anti-PGRST201)
  fetchScripts: async (userId) => {
    let targetUserId = userId;
    if (!targetUserId) {
      const { data } = await supabase.auth.getUser();
      targetUserId = data?.user?.id;
    }
    if (!targetUserId) return;

    set({ loading: true, error: null });
    try {
      const { data: scriptsData, error: scriptsError } = await supabase
        .from('scripts')
        .select('*')
        .eq('user_id', targetUserId)
        .order('updated_at', { ascending: false });

      if (scriptsError) throw scriptsError;

      if (!scriptsData || scriptsData.length === 0) {
        set({ scripts: [], loading: false });
        return;
      }

      const scriptIds = scriptsData.map((s) => s.id);
      const [{ data: charsData }, { data: repsData }] = await Promise.all([
        supabase.from('characters').select('*').in('script_id', scriptIds),
        supabase.from('replicas').select('*').in('script_id', scriptIds),
      ]);

      const combinedScripts = scriptsData.map((s) => ({
        ...s,
        characters: charsData?.filter((c) => c.script_id === s.id) || [],
        replicas: repsData?.filter((r) => r.script_id === s.id) || [],
      }));

      set({ scripts: combinedScripts, loading: false });
    } catch (err) {
      console.error('Error fetching scripts:', err);
      set({ error: err.message, loading: false });
    }
  },

  // 2. Charger un script complet par son ID (découplé anti-PGRST201)
  fetchScript: async (scriptId) => {
    if (!scriptId) return;
    set({ loading: true, error: null });
    try {
      // 2.1 Charger le script principal
      const { data: scriptData, error: scriptError } = await supabase
        .from('scripts')
        .select('*')
        .eq('id', scriptId)
        .single();

      if (scriptError) throw scriptError;

      // 2.2 Charger personnages et répliques de façon découplée (anti-PGRST201)
      const [{ data: charsData }, { data: repsData }] = await Promise.all([
        supabase.from('characters').select('*').eq('script_id', scriptId),
        supabase
          .from('replicas')
          .select('*')
          .eq('script_id', scriptId)
          .order('order_index', { ascending: true }),
      ]);

      const fullScript = {
        ...scriptData,
        characters: charsData || [],
        replicas: repsData || [],
      };

      set({ currentScript: fullScript, loading: false });
    } catch (err) {
      console.error('Error fetching script:', err);
      set({ error: err.message, loading: false });
    }
  },

  // Réinitialiser le script courant
  clearCurrentScript: () => set({ currentScript: null }),

  // Alias pour la rétrocompatibilité
  createScript: async (scriptData, userId) => {
    return get().addScript(scriptData, userId);
  },

  // 3. Ajouter un nouveau script (résistant aux erreurs d'authentification et RLS)
  addScript: async (scriptData, userId) => {
    set({ loading: true, error: null });
    try {
      // Vérifier et rafraîchir la session si nécessaire
      let activeUser = null;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          activeUser = sessionData.session.user;
        } else {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) activeUser = userData.user;
        }
      } catch (authErr) {
        console.warn('Auth check warning:', authErr);
      }

      const targetUserId = activeUser?.id || userId || scriptData?.user_id || scriptData?.userId;

      if (!targetUserId) {
        throw new Error("Session expirée ou utilisateur non identifié. Veuillez vous re-connecter.");
      }

      // Payload épuré avec uniquement les colonnes réelles de la table scripts dans Supabase
      const payload = {
        title: scriptData.title || 'Sans titre',
        full_text: scriptData.full_text || scriptData.fullText || '',
        pdf_url: scriptData.pdf_url || scriptData.pdfUrl || null,
        user_id: targetUserId,
      };

      const { data: script, error: scriptError } = await supabase
        .from('scripts')
        .insert([payload])
        .select()
        .single();

      if (scriptError) {
        if (scriptError.code === '42501' || scriptError.status === 401) {
          throw new Error("Erreur de droits d'accès Supabase (RLS 42501 / 401). Votre session a peut-être expiré. Veuillez recharger la page et vous reconnecter.");
        }
        throw scriptError;
      }

      // Créer les personnages s'ils sont fournis
      let createdCharacters = [];
      if (scriptData.characters && scriptData.characters.length > 0) {
        const charactersData = scriptData.characters.map((char, index) => ({
          script_id: script.id,
          name: typeof char === 'string' ? char : char.name,
          color: typeof char === 'string' ? getRandomColor(index) : char.color || getRandomColor(index),
        }));

        const { data: cData, error: charError } = await supabase
          .from('characters')
          .insert(charactersData)
          .select();

        if (charError) {
          console.warn("Erreur d'insertion des personnages:", charError);
        } else {
          createdCharacters = cData || [];
        }
      }

      // Map pour associer nom -> id du personnage
      const charMap = {};
      createdCharacters.forEach((c) => {
        if (c?.name) charMap[c.name.toLowerCase()] = c.id;
      });

      // Créer les répliques si fournies
      if (scriptData.replicas && scriptData.replicas.length > 0) {
        const replicasData = scriptData.replicas.map((rep, index) => {
          const charName = (rep.character || rep.character_name || '').toLowerCase();
          const fallbackCharId = createdCharacters.length > 0 ? createdCharacters[0].id : null;
          const characterId = charMap[charName] || fallbackCharId;

          return {
            script_id: script.id,
            character_id: characterId,
            text: rep.text || '',
            text_gaps: generateGapsText(rep.text || ''),
            cue_words: index > 0 ? getCueWords(scriptData.replicas[index - 1]?.text || '') : '',
            order_index: (index + 1) * 1000,
            act_title: rep.act_title || null,
            scene_title: rep.scene_title || null,
            is_context: !!rep.is_context,
            page_number: rep.page_number || null,
          };
        });

        let { error: repError } = await supabase
          .from('replicas')
          .insert(replicasData);

        if (repError && repError.code === 'PGRST204') {
          console.warn("Colonnes de segmentation non trouvées dans 'replicas', repli standard:", repError);
          const fallbackReplicasData = replicasData.map(({ act_title, scene_title, is_context, page_number, ...rest }) => rest);
          const fallbackRes = await supabase
            .from('replicas')
            .insert(fallbackReplicasData);
          if (fallbackRes.error) throw fallbackRes.error;
        } else if (repError) {
          console.warn("Erreur répliques:", repError);
        }
      }

      // Recharger le script complet de façon découplée
      await get().fetchScript(script.id);
      return script;
    } catch (err) {
      console.error('Error adding script:', err);
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // 4. Helper d'insertion en masse de répliques
  addReplicas: async (replicasArray) => {
    if (!Array.isArray(replicasArray) || replicasArray.length === 0) return;
    
    const cleanReplicas = replicasArray.map((rep, idx) => ({
      script_id: rep.script_id,
      character_id: rep.character_id || null,
      order_index: (rep.order_index !== undefined ? rep.order_index : (idx + 1) * 1000),
      text: rep.text || '',
      text_gaps: rep.text_gaps || rep.textGaps || '',
      cue_words: rep.cue_words || rep.cueWords || '',
      act_title: rep.act_title || null,
      scene_title: rep.scene_title || null,
      is_context: !!rep.is_context,
      page_number: rep.page_number || null,
    }));

    const { error } = await supabase.from('replicas').insert(cleanReplicas);
    if (error && error.code === 'PGRST204') {
      const basicReplicas = cleanReplicas.map(({ act_title, scene_title, is_context, page_number, ...rest }) => rest);
      const { error: fallbackError } = await supabase.from('replicas').insert(basicReplicas);
      if (fallbackError) throw fallbackError;
    } else if (error) {
      throw error;
    }
  },

  // Modifier un script (ex: titre)
  updateScript: async (scriptId, updates) => {
    try {
      const { error } = await supabase
        .from('scripts')
        .update(updates)
        .eq('id', scriptId);

      if (error) throw error;

      set((state) => ({
        currentScript: state.currentScript
          ? { ...state.currentScript, ...updates }
          : null,
        scripts: state.scripts.map((s) =>
          s.id === scriptId ? { ...s, ...updates } : s
        ),
      }));
    } catch (err) {
      console.error('Error updating script:', err);
      throw err;
    }
  },

  // Supprimer un script
  deleteScript: async (scriptId) => {
    try {
      const { error } = await supabase
        .from('scripts')
        .delete()
        .eq('id', scriptId);

      if (error) throw error;

      set((state) => ({
        scripts: state.scripts.filter((s) => s.id !== scriptId),
        currentScript: state.currentScript?.id === scriptId ? null : state.currentScript,
      }));
    } catch (err) {
      console.error('Error deleting script:', err);
      throw err;
    }
  },

  // Modifier une réplique
  updateReplica: async (replicaId, updates) => {
    try {
      const { error } = await supabase
        .from('replicas')
        .update(updates)
        .eq('id', replicaId);

      if (error) throw error;

      set((state) => {
        if (!state.currentScript) return state;
        const updatedReplicas = state.currentScript.replicas.map((r) =>
          r.id === replicaId ? { ...r, ...updates } : r
        );
        return {
          currentScript: {
            ...state.currentScript,
            replicas: updatedReplicas,
          },
        };
      });
    } catch (err) {
      console.error('Error updating replica:', err);
      throw err;
    }
  },

  // Ajouter une seule réplique à un script existant
  addSingleReplica: async (replicaData) => {
    try {
      const { data, error } = await supabase
        .from('replicas')
        .insert([replicaData])
        .select()
        .single();

      if (error) throw error;

      set((state) => {
        if (!state.currentScript) return state;
        const replicas = [...(state.currentScript.replicas || []), data];
        replicas.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        return {
          currentScript: {
            ...state.currentScript,
            replicas,
          },
        };
      });

      return data;
    } catch (err) {
      console.error('Error adding single replica:', err);
      throw err;
    }
  },

  // Supprimer une réplique
  deleteReplica: async (replicaId) => {
    try {
      const { error } = await supabase
        .from('replicas')
        .delete()
        .eq('id', replicaId);

      if (error) throw error;

      set((state) => {
        if (!state.currentScript) return state;
        return {
          currentScript: {
            ...state.currentScript,
            replicas: state.currentScript.replicas.filter((r) => r.id !== replicaId),
          },
        };
      });
    } catch (err) {
      console.error('Error deleting replica:', err);
      throw err;
    }
  },

  // Réordonner les répliques
  reorderReplicas: async (scriptId, newOrderReplicaIds) => {
    try {
      const updates = newOrderReplicaIds.map((id, index) => ({
        id,
        order_index: (index + 1) * 1000,
      }));

      for (const update of updates) {
        await supabase
          .from('replicas')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
      }

      set((state) => {
        if (!state.currentScript) return state;
        const replicasMap = {};
        state.currentScript.replicas.forEach((r) => {
          replicasMap[r.id] = r;
        });

        const reordered = newOrderReplicaIds
          .map((id, index) => {
            const rep = replicasMap[id];
            return rep ? { ...rep, order_index: (index + 1) * 1000 } : null;
          })
          .filter(Boolean);

        return {
          currentScript: {
            ...state.currentScript,
            replicas: reordered,
          },
        };
      });
    } catch (err) {
      console.error('Error reordering replicas:', err);
      throw err;
    }
  },

  // Ajouter un personnage
  addCharacter: async (scriptId, characterData) => {
    try {
      const { data, error } = await supabase
        .from('characters')
        .insert([
          {
            script_id: scriptId,
            name: characterData.name,
            color: characterData.color || getRandomColor(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      set((state) => {
        if (!state.currentScript) return state;
        return {
          currentScript: {
            ...state.currentScript,
            characters: [...(state.currentScript.characters || []), data],
          },
        };
      });

      return data;
    } catch (err) {
      console.error('Error adding character:', err);
      throw err;
    }
  },

  // Modifier un personnage
  updateCharacter: async (characterId, updates) => {
    try {
      const { error } = await supabase
        .from('characters')
        .update(updates)
        .eq('id', characterId);

      if (error) throw error;

      set((state) => {
        if (!state.currentScript) return state;
        return {
          currentScript: {
            ...state.currentScript,
            characters: state.currentScript.characters.map((c) =>
              c.id === characterId ? { ...c, ...updates } : c
            ),
          },
        };
      });
    } catch (err) {
      console.error('Error updating character:', err);
      throw err;
    }
  },

  // Supprimer un personnage
  deleteCharacter: async (characterId) => {
    try {
      const { error: replicasError } = await supabase
        .from('replicas')
        .delete()
        .eq('character_id', characterId);

      if (replicasError) throw replicasError;

      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', characterId);

      if (error) throw error;

      set((state) => {
        if (!state.currentScript) return state;
        return {
          currentScript: {
            ...state.currentScript,
            characters: state.currentScript.characters.filter((c) => c.id !== characterId),
            replicas: state.currentScript.replicas.filter((r) => r.character_id !== characterId),
          },
        };
      });
    } catch (err) {
      console.error('Error deleting character:', err);
      throw err;
    }
  },

  // Charger les notes personnelles pour un script
  fetchPersonalNotes: async (scriptId, userId) => {
    if (!scriptId || !userId) return;
    try {
      const { data, error } = await supabase
        .from('personal_notes')
        .select('*')
        .eq('script_id', scriptId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      set((state) => {
        if (!state.currentScript) return state;
        return {
          currentScript: {
            ...state.currentScript,
            personalNotes: data,
          },
        };
      });
    } catch (err) {
      console.error('Error fetching personal notes:', err);
    }
  },

  // Compter le nombre de notes pour une liste de scripts
  countNotesForScripts: async (scriptIds, userId) => {
    if (!scriptIds?.length || !userId) return {};
    try {
      const { data, error } = await supabase
        .from('personal_notes')
        .select('script_id')
        .in('script_id', scriptIds)
        .eq('user_id', userId);

      if (error) throw error;

      const counts = {};
      data.forEach((note) => {
        counts[note.script_id] = (counts[note.script_id] || 0) + 1;
      });

      return counts;
    } catch (err) {
      console.error('Count notes error:', err);
      return {};
    }
  },

  // Ajouter une note personnelle
  addPersonalNote: async (noteData) => {
    try {
      const { data, error } = await supabase
        .from('personal_notes')
        .insert([noteData])
        .select()
        .single();

      if (error) throw error;

      set((state) => {
        if (!state.currentScript) return state;
        return {
          currentScript: {
            ...state.currentScript,
            personalNotes: [...(state.currentScript.personalNotes || []), data],
          },
        };
      });

      return data;
    } catch (err) {
      console.error('Error adding personal note:', err);
      throw err;
    }
  },

  // Modifier une note personnelle
  updatePersonalNote: async (noteId, updates) => {
    try {
      const { error } = await supabase
        .from('personal_notes')
        .update(updates)
        .eq('id', noteId);

      if (error) throw error;

      set((state) => {
        if (!state.currentScript) return state;
        return {
          currentScript: {
            ...state.currentScript,
            personalNotes: state.currentScript.personalNotes.map((n) =>
              n.id === noteId ? { ...n, ...updates } : n
            ),
          },
        };
      });
    } catch (err) {
      console.error('Error updating personal note:', err);
      throw err;
    }
  },

  // Supprimer une note personnelle
  deletePersonalNote: async (noteId) => {
    try {
      const { error } = await supabase
        .from('personal_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      set((state) => {
        if (!state.currentScript) return state;
        return {
          currentScript: {
            ...state.currentScript,
            personalNotes: state.currentScript.personalNotes.filter((n) => n.id !== noteId),
          },
        };
      });
    } catch (err) {
      console.error('Error deleting personal note:', err);
      throw err;
    }
  },
}));

// Helpers
function getRandomColor(index) {
  const colors = [
    '#E53E3E', '#DD6B20', '#D69E2E', '#38A169', '#319795',
    '#3182CE', '#00B5D8', '#805AD5', '#D53F8C', '#B83280',
  ];
  if (index !== undefined) {
    return colors[index % colors.length];
  }
  return colors[Math.floor(Math.random() * colors.length)];
}

function generateGapsText(text) {
  if (!text) return '';
  return text.replace(/\b(\w)(\w+)\b/g, (match, first, rest) => {
    return first + '_'.repeat(Math.min(rest.length, 5));
  });
}

function getCueWords(text) {
  if (!text) return '';
  const plain = text.replace(/<[^>]+>/g, '').trim();
  const words = plain.split(/\s+/);
  if (words.length <= 3) return plain;
  return '...' + words.slice(-3).join(' ');
}

/**
 * Extrait la liste ordonnée des Actes et des Scènes à partir des répliques d'un script.
 * @param {Array} replicas - Tableau des répliques du script
 * @returns {Object} { hasScenes: boolean, scenes: Array }
 */
export function extractScenes(replicas = []) {
  if (!Array.isArray(replicas) || replicas.length === 0) {
    return { hasScenes: false, scenes: [] };
  }

  const scenes = [];
  let currentKey = null;

  replicas.forEach((replica, index) => {
    const actTitle = replica.act_title || null;
    const sceneTitle = replica.scene_title || null;

    if (actTitle || sceneTitle) {
      const key = `${actTitle || ''}_${sceneTitle || ''}`;

      if (key !== currentKey) {
        currentKey = key;
        scenes.push({
          id: `scene-anchor-${replica.id}`,
          firstReplicaId: replica.id,
          actTitle: actTitle || '',
          sceneTitle: sceneTitle || `Scène ${scenes.length + 1}`,
          fullLabel: actTitle 
            ? `${actTitle} • ${sceneTitle || "Scène"}`
            : (sceneTitle || "Scène"),
          index: scenes.length,
          startIndex: index,
        });
      }
    }
  });

  return {
    hasScenes: scenes.length > 0,
    scenes,
  };
}
