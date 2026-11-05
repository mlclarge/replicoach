import { useState, useEffect } from 'react';
import { getUserAudioSettings, updateUserAudioSettings } from '../lib/supabase';

/**
 * Hook pour récupérer/gérer les paramètres audio du comédien
 * (délai avant et après réplique en mode audio)
 * Persiste dans Supabase + fallback localStorage
 */
export const useAudioSettings = (userId) => {
  const [settings, setSettings] = useState({
    delayBeforeMs: 1500,    // 1.5s par défaut
    delayAfterMs: 1000,     // 1s par défaut
    loading: true,
    error: null,
  });

  // Charger les settings depuis Supabase ou localStorage
  useEffect(() => {
    if (!userId) {
      setSettings(prev => ({ ...prev, loading: false }));
      return;
    }

    const loadSettings = async () => {
      try {
        setSettings(prev => ({ ...prev, loading: true }));
        
        // Charger depuis Supabase
        const data = await getUserAudioSettings(userId);
        
        if (data) {
          setSettings(prev => ({
            ...prev,
            delayBeforeMs: data.delay_before_ms || 1500,
            delayAfterMs: data.delay_after_ms || 1000,
            loading: false,
            error: null,
          }));
        } else {
          setSettings(prev => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.error('Error loading audio settings:', err);
        // Fallback to localStorage
        try {
          const stored = localStorage.getItem(`audio_settings_${userId}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            setSettings(prev => ({
              ...prev,
              delayBeforeMs: parsed.delayBeforeMs || 1500,
              delayAfterMs: parsed.delayAfterMs || 1000,
              loading: false,
              error: null,
            }));
          } else {
            setSettings(prev => ({
              ...prev,
              loading: false,
              error: err.message,
            }));
          }
        } catch (localErr) {
          setSettings(prev => ({
            ...prev,
            loading: false,
            error: err.message,
          }));
        }
      }
    };

    loadSettings();
  }, [userId]);

  // Sauvegarder les settings
  const saveSettings = async (delayBeforeMs, delayAfterMs) => {
    try {
      // Sauvegarder dans Supabase
      if (userId) {
        await updateUserAudioSettings(userId, delayBeforeMs, delayAfterMs);
      }

      // Backup localStorage
      if (userId) {
        localStorage.setItem(`audio_settings_${userId}`, JSON.stringify({
          delayBeforeMs,
          delayAfterMs,
        }));
      }

      setSettings(prev => ({
        ...prev,
        delayBeforeMs,
        delayAfterMs,
        error: null,
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
