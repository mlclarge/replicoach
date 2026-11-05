import { useState, useEffect, useCallback } from 'react';
import { getUserAudioSettings, updateUserAudioSettings } from '../lib/supabase';

const DEFAULT_BEFORE_MS = 1500;
const DEFAULT_AFTER_MS = 1000;

const storageKey = (userId) => `audio_settings_${userId || 'anon'}`;

const readLocal = (userId) => {
  try {
    const stored = localStorage.getItem(storageKey(userId));
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return {
      delayBeforeMs: Number.isFinite(parsed.delayBeforeMs) ? parsed.delayBeforeMs : DEFAULT_BEFORE_MS,
      delayAfterMs: Number.isFinite(parsed.delayAfterMs) ? parsed.delayAfterMs : DEFAULT_AFTER_MS,
    };
  } catch {
    return null;
  }
};

const writeLocal = (userId, delayBeforeMs, delayAfterMs) => {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ delayBeforeMs, delayAfterMs }));
  } catch {
    // stockage indisponible : on ignore
  }
};

/**
 * Délais audio du comédien (attente avant / pause après sa réplique).
 * Le stockage local est la source immédiate ; Supabase synchronise entre appareils.
 */
export const useAudioSettings = (userId) => {
  const [settings, setSettings] = useState(() => ({
    delayBeforeMs: DEFAULT_BEFORE_MS,
    delayAfterMs: DEFAULT_AFTER_MS,
    loading: true,
    error: null,
    ...(readLocal(userId) || {}),
  }));

  useEffect(() => {
    if (!userId) {
      setSettings((prev) => ({ ...prev, loading: false }));
      return undefined;
    }

    let cancelled = false;
    const local = readLocal(userId);
    if (local) setSettings((prev) => ({ ...prev, ...local }));

    (async () => {
      try {
        const data = await getUserAudioSettings(userId);
        if (cancelled) return;
        // data.id null = aucune ligne distante : on garde le réglage local
        if (data && data.id) {
          const next = {
            delayBeforeMs: data.delay_before_ms || DEFAULT_BEFORE_MS,
            delayAfterMs: data.delay_after_ms || DEFAULT_AFTER_MS,
          };
          writeLocal(userId, next.delayBeforeMs, next.delayAfterMs);
          setSettings((prev) => ({ ...prev, ...next, loading: false, error: null }));
        } else {
          setSettings((prev) => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.error('Error loading audio settings:', err);
        if (!cancelled) setSettings((prev) => ({ ...prev, loading: false, error: err.message }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveSettings = useCallback(
    async (delayBeforeMs, delayAfterMs) => {
      // Appliqué tout de suite : la lecture suivante utilise les nouvelles valeurs
      writeLocal(userId, delayBeforeMs, delayAfterMs);
      setSettings((prev) => ({ ...prev, delayBeforeMs, delayAfterMs }));

      if (!userId) return { success: true, synced: false };
      try {
        await updateUserAudioSettings(userId, delayBeforeMs, delayAfterMs);
        setSettings((prev) => ({ ...prev, error: null }));
        return { success: true, synced: true };
      } catch (err) {
        console.error('Error saving audio settings:', err);
        setSettings((prev) => ({ ...prev, error: err.message }));
        return { success: true, synced: false };
      }
    },
    [userId]
  );

  return {
    ...settings,
    saveSettings,
    delayBeforeOptions: [1000, 1500, 2000, 2500, 3000],
    delayAfterOptions: [500, 1000, 1500, 2000],
  };
};

export default useAudioSettings;
