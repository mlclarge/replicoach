import { useEffect, useState } from 'react';

/**
 * Indicateur visuel des délais audio en cours
 * Affiche le compte à rebours pendant les pauses avant/après réplique
 */
export function AudioDelayIndicator({ isActive, delayMs, isBeforeReading = true }) {
  const [timeLeft, setTimeLeft] = useState(delayMs / 1000);

  useEffect(() => {
    if (!isActive || !delayMs || delayMs <= 0) {
      setTimeLeft(0);
      return;
    }

    setTimeLeft(delayMs / 1000);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - 0.1);
        return parseFloat(next.toFixed(1));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, delayMs]);

  if (!isActive || delayMs <= 0 || timeLeft <= 0) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-40 animate-pulse">
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold 
                      py-3 px-6 rounded-full shadow-xl flex items-center gap-3">
        <div className="text-2xl">
          {isBeforeReading ? '⏳ Attente' : '⏸️ Pause'}
        </div>
        <div className="text-3xl font-mono">
          {timeLeft.toFixed(1)}s
        </div>
        <div className="w-16 h-2 bg-white/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all"
            style={{
              width: `${(timeLeft / (delayMs / 1000)) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default AudioDelayIndicator;
