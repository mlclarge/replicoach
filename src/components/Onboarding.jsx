import { useState, useEffect } from "react";

/**
 * Composant d'onboarding pour les nouveaux utilisateurs
 * S'affiche uniquement à la première visite
 */

const ONBOARDING_SLIDES = [
  {
    icon: "🎭",
    title: "Bienvenue sur RépliCoach !",
    description:
      "L'application qui vous aide à mémoriser vos répliques de théâtre.",
    tip: "Parcourez ce tutoriel pour découvrir les fonctionnalités",
  },
  {
    icon: "📄",
    title: "Importez vos textes",
    description:
      "Uploadez vos scripts en PDF, Word ou TXT. L'application détecte automatiquement les personnages et répliques.",
    tip: "💡 Les fichiers .txt et .docx donnent les meilleurs résultats",
  },
  {
    icon: "✏️",
    title: "Corrigez si nécessaire",
    description:
      "Après l'import, vous pouvez modifier, ajouter ou supprimer des répliques. Cliquez sur une réplique pour l'éditer, ou utilisez le bouton + pour en ajouter.",
    tip: "💡 Utilisez ✂️ pour diviser une réplique mal scannée en deux",
  },
  {
    icon: "📝",
    title: "Vos notes personnelles",
    description:
      "Ajoutez vos propres notes de jeu : déplacements, intentions, accessoires, repères... Elles s'affichent entre les répliques.",
    tip: "💡 Cliquez sur 📝 après une réplique pour y ajouter votre note",
  },
  {
    icon: "🎙️",
    title: "Notes vocales",
    description:
      "Enregistrez des notes audio pour mémoriser une intonation, une indication de jeu ou un rappel personnel.",
    tip: "💡 Parfait pour capturer le ton exact voulu par le metteur en scène",
  },
  {
    icon: "🏷️",
    title: "Organisez avec des tags",
    description:
      'Créez des tags pour catégoriser vos textes : "Comédie", "À réviser", "Maîtrisé"... Retrouvez-les facilement en filtrant par tag.',
    tip: "💡 Parfait quand vous avez beaucoup de textes à gérer",
  },
  {
    icon: "📚",
    title: "Sous-ensembles de répliques",
    description:
      'Créez des groupes de répliques pour réviser par acte, scène ou passage difficile. Cliquez sur "📚 Groupes" dans un texte.',
    tip: "💡 Concentrez-vous sur les passages que vous devez travailler",
  },
  {
    icon: "🎨",
    title: "Chaque personnage a sa couleur",
    description:
      "Les répliques sont affichées comme des bulles de conversation, avec une couleur unique par personnage.",
    tip: "💡 Filtrez par personnage pour vous concentrer sur votre rôle",
  },
  {
    icon: "🔖",
    title: "Nouveaux modes d'apprentissage",
    description:
      "Progressez étape par étape : 📖 Complet → 🔤 Trous (lettres masquées) → 3️⃣ 3 mots → 🟢 Début/Fin (1er + dernier mot) → 🟣 Derniers Mots (seul le dernier mot) → 🎭 Répliques (indices seulement).",
    tip: '💡 Touchez une bulle pour révéler le texte complet dans tous les modes exercices',
  },
  {
    icon: "👤",
    title: "Cacher mon personnage",
    description:
      "Marquez votre personnage avec l'étoile ⭐ dans la liste des personnages, puis activez 'Cacher' en mode exercice pour masquer uniquement VOS répliques — pratique pour répéter sans les lire.",
    tip: '💡 Le placeholder indique "(Réplique cachée)" — touchez-le pour révéler temporairement',
  },
  {
    icon: "🔊",
    title: "Mode Audio & Italienne",
    description:
      "Écoutez vos répliques avec des voix distinctes (♀ aiguë, ♂ grave). Chaque bulle a son bouton ▶️ pour l'écouter individuellement.",
    tip: "💡 Les didascalies (texte entre parenthèses) ne sont pas lues",
  },
  {
    icon: "🎙️",
    title: "Enregistrez les voix",
    description:
      "Remplacez la synthèse vocale par VOS enregistrements ! Enregistrez la voix de chaque personnage pour une lecture plus naturelle et personnalisée.",
    tip: "💡 Cliquez sur 🎙️ en mode audio puis enregistrez chaque personnage",
  },
  {
    icon: "🎭",
    title: "Mode Italienne",
    description:
      "Masquez VOS répliques, écoutez les autres, puis cliquez sur votre bulle quand c'est à vous de parler !",
    tip: "💡 Cliquez sur un personnage pour masquer ses répliques",
  },
  {
    icon: "👥",
    title: "Partagez avec votre troupe",
    description:
      "Rejoignez une troupe avec un code, recevez les textes partagés et créez votre copie personnelle à annoter.",
    tip: '💡 Cliquez sur "☑️ Sélectionner" pour copier plusieurs textes en une fois',
  },
  {
    icon: "📹",
    title: "Vidéos du metteur en scène",
    description:
      "Le metteur en scène peut partager des vidéos YouTube (mises en scène, conseils) avec toute la troupe.",
    tip: '💡 Uploadez sur YouTube en mode "Non répertorié" pour la confidentialité',
  },
  {
    icon: "📲",
    title: "Installez l'application",
    description:
      "Ajoutez RépliCoach à votre écran d'accueil pour un accès rapide, même hors connexion !",
    tip: '💡 Sur Android : Menu ⋮ → "Installer l\'application"',
  },
  {
    icon: "🚀",
    title: "C'est parti !",
    description:
      "Vous êtes prêt à mémoriser vos répliques comme un pro. Bonne répétition !",
    tip: "🎭 Merde ! (comme on dit au théâtre)",
  },
];

function Onboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Vérifier si l'utilisateur a déjà vu l'onboarding
    const hasSeenOnboarding = localStorage.getItem(
      "replicoach-onboarding-seen"
    );
    if (!hasSeenOnboarding) {
      // Petit délai pour laisser l'app se charger
      setTimeout(() => setShowOnboarding(true), 500);
    }
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

  const handleSkip = () => {
    handleClose();
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  if (!showOnboarding) return null;

  const slide = ONBOARDING_SLIDES[currentSlide];
  const isLastSlide = currentSlide === ONBOARDING_SLIDES.length - 1;
  const isFirstSlide = currentSlide === 0;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300
        ${isExiting ? "opacity-0" : "opacity-100"}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal */}
      <div
        className={`relative bg-gradient-to-b from-gray-900 to-darker rounded-2xl 
                    max-w-md w-full overflow-hidden shadow-2xl border border-gray-700
                    transform transition-all duration-300
                    ${
                      isExiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
                    }`}
      >
        {/* Bouton fermer */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-gray-500 hover:text-white p-2 z-10"
        >
          ✕
        </button>

        {/* Contenu du slide */}
        <div className="p-8 pt-12 text-center">
          {/* Icône animée */}
          <div className="text-6xl mb-6 animate-bounce">{slide.icon}</div>

          {/* Titre */}
          <h2 className="text-2xl font-display text-gold-500 mb-4">
            {slide.title}
          </h2>

          {/* Description */}
          <p className="text-gray-300 mb-4 leading-relaxed">
            {slide.description}
          </p>

          {/* Astuce */}
          <div
            className={`rounded-lg p-3 mb-6 ${
              slide.isFuture
                ? "bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/50"
                : "bg-primary-900/30 border border-primary-700/50"
            }`}
          >
            <p
              className={`text-sm ${
                slide.isFuture ? "text-purple-200" : "text-primary-300"
              }`}
            >
              {slide.tip}
            </p>
          </div>

          {/* Indicateurs de progression (dots) */}
          <div className="flex justify-center gap-2 mb-6">
            {ONBOARDING_SLIDES.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 rounded-full transition-all
                  ${
                    index === currentSlide
                      ? "bg-gold-500 w-6"
                      : "bg-gray-600 hover:bg-gray-500"
                  }`}
              />
            ))}
          </div>

          {/* Boutons de navigation */}
          <div className="flex gap-3">
            {!isFirstSlide && (
              <button
                onClick={handlePrevious}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full font-semibold transition"
              >
                ← Précédent
              </button>
            )}

            {isFirstSlide && (
              <button
                onClick={handleSkip}
                className="flex-1 py-3 text-gray-400 hover:text-white transition"
              >
                Passer
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-gradient-to-r from-gold-600 to-gold-500 
                         hover:from-gold-500 hover:to-gold-400 
                         text-dark font-semibold rounded-full transition shadow-lg"
            >
              {isLastSlide ? "Commencer 🎭" : "Suivant →"}
            </button>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-primary-600 to-gold-500 transition-all duration-300"
            style={{
              width: `${
                ((currentSlide + 1) / ONBOARDING_SLIDES.length) * 100
              }%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
