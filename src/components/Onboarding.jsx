import { useState, useEffect } from "react";

const ONBOARDING_SLIDES = [
  {
    icon: "🎭",
    title: "Bienvenue sur RépliCoach !",
    description: "L'application dédiée aux comédiens pour mémoriser leurs textes, réviser leurs répliques et répéter en toute autonomie.",
    tip: "💡 Astuce : Importez facilement vos pièces et scénarios sous format PDF, Word, texte brut ou scan photo.",
  },
  {
    icon: "📄",
    title: "Importation & Scan OCR / IA",
    description: "Téléchargez vos documents PDF natifs ou numérisés. Grâce au Scan IA Gemini Vision, les personnages, scènes et répliques sont découpés automatiquement.",
    tip: "📸 Pour un document physique ou un livre, prenez simplement une photo avec votre smartphone.",
  },
  {
    icon: "🔊",
    title: "Audio & Mode Italienne",
    description: "Donnez la réplique à l'application ! Écoutez les voix de vos partenaires de jeu et masquez vos propres répliques pour tester votre mémoire.",
    tip: "🎭 Choisissez entre les voix de synthèse HD ou vos propres enregistrements audio.",
  },
  {
    icon: "🧠",
    title: "Exercices de Mémorisation",
    description: "Entraînez-vous avec les modes interactifs : mots masqués, premiers mots, répliques à trous et contrôle progressif de mémorisation.",
    tip: "🎯 Suivez vos progrès réplique par réplique pour être prêt le jour de la répétition.",
  },
  {
    icon: "👥",
    title: "Espace Troupe & Partages",
    description: "Partagez vos textes avec les membres de votre troupe et accédez aux consignes de jeu de votre metteur en scène.",
    tip: "✨ Créez une troupe avec un code d'invitation à 8 caractères à transmettre aux comédiens.",
  },
  {
    icon: "🎙️",
    title: "Studio & Notes Vocales",
    description: "Enregistrez librement vos intentions de jeu, vos essais de voix ou des notes personnelles associées à vos saynètes.",
    tip: "🎧 Vos enregistrements audio personnels restent conservés en toute sécurité dans votre espace.",
  },
  {
    icon: "🚀",
    title: "Vous êtes prêt pour la scène !",
    description: "Accédez directement à vos textes depuis la page d'accueil et commencez vos révisions dès maintenant.",
    tip: "📖 Retrouvez ce tutoriel à tout moment depuis le bouton 'Tutoriel' dans le menu inférieur.",
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
        className={`relative bg-gradient-to-b from-gray-900 via-gray-950 to-darker rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-700/80 transform transition-all duration-300 ${
          isExiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <button onClick={handleClose} className="absolute top-4 right-4 text-gray-500 hover:text-white p-2 z-10 text-xl font-bold">
          ✕
        </button>

        <div className="p-6 sm:p-8 pt-10 text-center">
          <div className="text-5xl sm:text-6xl mb-4 animate-bounce">{slide.icon}</div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-amber-400 mb-3">{slide.title}</h2>
          <p className="text-gray-200 mb-4 leading-relaxed text-xs sm:text-sm">{slide.description}</p>

          <div className="rounded-xl p-3 mb-5 bg-purple-950/40 border border-purple-500/30">
            <p className="text-xs text-purple-300 font-semibold">{slide.tip}</p>
          </div>

          <div className="flex justify-center gap-1.5 mb-6">
            {ONBOARDING_SLIDES.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide ? "bg-amber-400 w-6" : "bg-gray-700 hover:bg-gray-600 w-2"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {!isFirstSlide && (
              <button
                onClick={handlePrevious}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl font-bold transition text-xs border border-gray-700"
              >
                ← Précédent
              </button>
            )}

            {isFirstSlide && (
              <button onClick={handleClose} className="flex-1 py-3 text-gray-400 hover:text-white transition text-xs font-semibold">
                Passer
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-extrabold rounded-xl transition shadow-lg text-xs"
            >
              {isLastSlide ? "Commencer 🎭" : "Suivant →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
