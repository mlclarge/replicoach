import { useState, useEffect } from 'react';

/**
 * Composant pour afficher le prompt d'installation PWA
 * - Sur Android/PC : utilise le prompt natif
 * - Sur iOS : affiche un tutoriel
 */
function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSTutorial, setShowIOSTutorial] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Vérifier si déjà installé en mode standalone
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone === true;
    setIsStandalone(standalone);
    
    if (standalone) return; // Déjà installé, ne rien afficher

    // Vérifier si déjà refusé récemment (7 jours)
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const now = new Date();
      const daysDiff = (now - dismissedDate) / (1000 * 60 * 60 * 24);
      if (daysDiff < 7) return; // Moins de 7 jours, ne pas afficher
    }

    // Détecter iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    if (iOS) {
      // Sur iOS, afficher après un délai
      const timer = setTimeout(() => {
        setShowIOSTutorial(true);
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Sur Android/PC, écouter l'événement beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Afficher après un court délai pour ne pas être intrusif
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Écouter si l'app est installée
    window.addEventListener('appinstalled', () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      console.log('PWA installée !');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Afficher l'état d'installation
    setIsInstalling(true);

    // Afficher le prompt natif
    deferredPrompt.prompt();
    
    // Attendre le choix de l'utilisateur
    const { outcome } = await deferredPrompt.userChoice;
    console.log('Choix utilisateur:', outcome);
    
    if (outcome === 'accepted') {
      // Garder le message d'installation quelques secondes
      setTimeout(() => {
        setIsInstalling(false);
        setDeferredPrompt(null);
        setShowPrompt(false);
      }, 2000);
    } else {
      setIsInstalling(false);
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSTutorial(false);
    // Sauvegarder la date de refus
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
  };

  // Ne rien afficher si déjà en standalone ou si pas de prompt à afficher
  if (isStandalone || !showPrompt) return null;

  // État d'installation en cours
  if (isInstalling) {
    return (
      <div className="fixed bottom-28 left-4 right-4 z-50 animate-slideUp">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-w-md mx-auto">
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              {/* Spinner */}
              <div className="absolute inset-0 border-4 border-primary-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin"></div>
              <span className="absolute inset-0 flex items-center justify-center text-2xl">🎭</span>
            </div>
            <h3 className="text-gray-900 font-semibold text-lg">Installation en cours...</h3>
            <p className="text-gray-500 text-sm mt-1">RépliCoach s'ajoute à votre écran d'accueil</p>
          </div>
        </div>
      </div>
    );
  }

  // Tutoriel iOS
  if (isIOS && showIOSTutorial) {
    return (
      <div className="fixed bottom-28 left-4 right-4 z-50 animate-slideUp">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-w-md mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-700 to-primary-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎭</span>
              <span className="text-white font-semibold">Installer RépliCoach</span>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/70 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
          
          {/* Contenu */}
          <div className="p-4">
            <p className="text-gray-600 text-sm mb-4">
              Ajoutez l'app à votre écran d'accueil pour un accès rapide :
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-gray-800 text-sm">
                    Appuyez sur <span className="inline-flex items-center bg-gray-200 px-2 py-0.5 rounded text-xs font-mono">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </span> Partager
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                  2
                </div>
                <div className="flex-1">
                  <p className="text-gray-800 text-sm">
                    Choisissez <strong>"Sur l'écran d'accueil"</strong>
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white">
                  ✓
                </div>
                <div className="flex-1">
                  <p className="text-gray-800 text-sm">
                    Appuyez sur <strong>"Ajouter"</strong>
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleDismiss}
              className="w-full mt-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition"
            >
              OK, compris !
            </button>
          </div>
        </div>
        
        {/* Flèche vers le bas (vers Safari) */}
        <div className="flex justify-center mt-2">
          <div className="w-4 h-4 bg-white rotate-45 transform -translate-y-2 shadow-lg border-r border-b border-gray-200"></div>
        </div>
      </div>
    );
  }

  // Prompt Android/PC
  return (
    <div className="fixed bottom-28 left-4 right-4 z-50 animate-slideUp">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-w-md mx-auto">
        <div className="p-4">
          <div className="flex items-start gap-4">
            {/* Icône */}
            <div className="w-14 h-14 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center text-2xl shadow-lg">
              🎭
            </div>
            
            {/* Texte */}
            <div className="flex-1">
              <h3 className="text-gray-900 font-semibold">Installer RépliCoach</h3>
              <p className="text-gray-500 text-sm mt-0.5">
                Accédez rapidement à vos textes depuis l'écran d'accueil
              </p>
            </div>
            
            {/* Bouton fermer */}
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              ✕
            </button>
          </div>
          
          {/* Boutons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition"
            >
              Plus tard
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-lg text-sm font-semibold transition shadow-md"
            >
              📲 Installer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InstallPrompt;
