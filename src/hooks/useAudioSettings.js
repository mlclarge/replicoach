import { useState, useEffect } from 'react';

/**
 * Hook pour récupérer/gérer les paramètres audio du comédien
 * (délai avant et après réplique en mode audio)
 */
export const useAudioSettings = (userId) => {
  const [settings, setSettings] = useState({
    delayBeforeMs: 1500,    // 1.5s par défaut
    delayAfterMs: 1000,     // 1s par défaut
    loading: true,
    error: null,
  });

  // Charger les settings depuis localStorage ou DB
  useEffect(() => {
    if (!userId) {
      setSettings(prev => ({ ...prev, loading: false }));
      return;
    }

    const loadSettings = async () => {
      try {
        // TODO: Charger depuis Supabase quand DB prête
        // const data = await getUserAudioSettings(userId);
        
        // Pour l'instant, utiliser localStorage
        const stored = localStorage.getItem(`audio_settings_${userId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings(prev => ({
            ...prev,
            delayBeforeMs: parsed.delayBeforeMs || 1500,
            delayAfterMs: parsed.delayAfterMs || 1000,
            loading: false,
          }));
        } else {
          setSettings(prev => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.error('Error loading audio settings:', err);
        setSettings(prev => ({
          ...prev,
          loading: false,
          error: err.message,
        }));
      }
    };

    loadSettings();
  }, [userId]);

  // Sauvegarder les settings
  const saveSettings = async (delayBeforeMs, delayAfterMs) => {
    try {
      const newSettings = {
        delayBeforeMs,
        delayAfterMs,
      };

      // TODO: Sauvegarder dans Supabase quand DB prête
      // await updateUserAudioSettings(userId, delayBeforeMs, delayAfterMs);

      // Pour l'instant, utiliser localStorage
      if (userId) {
        localStorage.setItem(`audio_settings_${userId}`, JSON.stringify(newSettings));
      }

      setSettings(prev => ({
        ...prev,
        delayBeforeMs,
        delayAfterMs,
      }));

      return { success: true };
    } catch (err) {
      console.error('Error saving audio settings:', err);
      setSettings(prev => ({
        ...prev,
        error: err.message,
      }));
      throw err;
    }
  };

  return {
    ...settings,
    saveSettings,
    delayBeforeOptions: [1000, 1500, 2000, 2500, 3000],
    delayAfterOptions: [500, 1000, 1500, 2000],
  };
};

export default useAudioSettings;
