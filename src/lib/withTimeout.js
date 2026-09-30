// Rejette si la promesse ne se résout pas dans le délai imparti, pour qu'un appel
// réseau ou auth suspendu ne laisse jamais l'interface figée sans message.
export function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
