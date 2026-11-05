/**
 * Utilitaires pour la lecture audio avec délais
 * Gère l'injection des pauses avant et après les répliques
 */

/**
 * Attend un délai donné (en ms)
 * @param {number} ms - Millisecondes à attendre
 * @returns {Promise<void>}
 */
export const sleep = (ms) => {
  if (ms <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Parle le texte avec délais avant/après
 * Utilise la SpeechSynthesis API avec les paramètres audio stockés
 * 
 * @param {string} text - Texte à prononcer
 * @param {Object} utterance - Configuration de l'utterance
 * @param {number} delayBeforeMs - Délai avant la lecture (ms)
 * @param {number} delayAfterMs - Délai après la lecture (ms)
 * @returns {Promise<void>}
 */
export const speakWithDelays = async (text, utterance, delayBeforeMs = 0, delayAfterMs = 0) => {
  // Attendre avant la lecture
  if (delayBeforeMs > 0) {
    await sleep(delayBeforeMs);
  }

  // Prononcer le texte
  return new Promise((resolve) => {
    utterance.onend = () => {
      // Attendre après la lecture
      if (delayAfterMs > 0) {
        setTimeout(resolve, delayAfterMs);
      } else {
        resolve();
      }
    };
    utterance.onerror = () => {
      resolve();
    };
    window.speechSynthesis.speak(utterance);
  });
};

/**
 * Lit un fichier audio avec délais
 * @param {string} audioUrl - URL du fichier audio
 * @param {HTMLAudioElement} audioEl - Élément audio
 * @param {number} delayBeforeMs - Délai avant la lecture (ms)
 * @param {number} delayAfterMs - Délai après la lecture (ms)
 * @returns {Promise<void>}
 */
export const playAudioWithDelays = async (audioUrl, audioEl, delayBeforeMs = 0, delayAfterMs = 0) => {
  // Attendre avant la lecture
  if (delayBeforeMs > 0) {
    await sleep(delayBeforeMs);
  }

  // Charger et jouer le fichier audio
  audioEl.src = audioUrl;
  await audioEl.play();

  // Attendre la fin de la lecture + délai après
  return new Promise((resolve) => {
    audioEl.onended = () => {
      if (delayAfterMs > 0) {
        setTimeout(resolve, delayAfterMs);
      } else {
        resolve();
      }
    };
    audioEl.onerror = () => {
      resolve();
    };
  });
};
