import { useState, useEffect } from "react";

const ONBOARDING_SLIDES = [
  {
    icon: "🎭",
    title: "Bienvenue sur RépliCoach !",
    description: "L'application dédiée aux comédiens pour mémoriser leurs textes et répéter en toute autonomie.",
    tip: "💡 Astuce : Importez votre pièce sous format PDF, Word ou Scan photo.",
  },
  {
    icon: "🔊",
    title: "Audio & Mode Italienne",
    description: "Écoutez les répliques de vos partenaires de jeu et masquez vos propres répliques pour tester votre mémoire.",
    tip: "🎭 Choisissez entre les voix de synthèse et vos propres enregistrements.",
  },
  {
    icon: "👥",
    title: "Espace Troupe & Partage",
    description: "Partagez vos textes avec les membres de votre troupe et accédez aux consignes du metteur en scène.",
    tip: "✨ Créez une troupe avec un code d'invitation à transmettre aux comédiens.",
  },
];

export default function Onboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const checkOnboarding = () => {
      const hasSeenOnboarding = localStorage.getItem("replicoach-onboarding-seen");
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
      }
    };

    checkOnboarding();

    const handleOpenEvent = () => {
      setCurrentSlide(0);
      setIsExiting(false);
      setShowOnboarding(true);
    };

    window.addEventListener("open-onboarding", handleOpenEvent);
    return () => window.removeEventListener("open-onboarding", handleOpenEvent);
  }, []);

  const handleNext = () => {
    if (currentSlide < ONBOARDING_SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      localStorage.setItem("replicoach-onboarding-seen", "true");
      setShowOnboarding(false);
    }, 300);
  };

  if (!showOnboarding) return null;

  const slide = ONBOARDING_SLIDES[currentSlide];
  const isLastSlide = currentSlide === ONBOARDING_SLIDES.length - 1;
  const isFirstSlide = currentSlide === 0;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isExiting ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div
        className={`relative bg-gradient-to-b from-gray-900 to-darker rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-700 transform transition-all duration-300 ${
          isExiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <button onClick={handleClose} className="absolute top-4 right-4 text-gray-500 hover:text-white p-2 z-10">
          ✕
        </button>

        <div className="p-8 pt-12 text-center">
          <div className="text-6xl mb-6 animate-bounce">{slide.icon}</div>
          <h2 className="text-2xl font-display text-gold-500 mb-4">{slide.title}</h2>
          <p className="text-gray-300 mb-4 leading-relaxed text-sm">{slide.description}</p>

          <div className="rounded-lg p-3 mb-6 bg-primary-900/30 border border-primary-700/50">
            <p className="text-xs text-primary-300 font-semibold">{slide.tip}</p>
          </div>

          <div className="flex justify-center gap-2 mb-6">
            {ONBOARDING_SLIDES.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentSlide ? "bg-gold-500 w-6" : "bg-gray-600 hover:bg-gray-500"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {!isFirstSlide && (
              <button
                onClick={handlePrevious}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full font-semibold transition text-xs"
              >
                ← Précédent
              </button>
            )}

            {isFirstSlide && (
              <button onClick={handleClose} className="flex-1 py-3 text-gray-400 hover:text-white transition text-xs">
                Passer
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-dark font-bold rounded-full transition shadow-lg text-xs"
            >
              {isLastSlide ? "Commencer 🎭" : "Suivant →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
