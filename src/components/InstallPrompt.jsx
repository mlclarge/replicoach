import { useState, useEffect } from 'react';

/**
 * Composant pour afficher le prompt d'installation PWA
 * - Sur Android/PC : utilise le prompt natif avec feedback
 * - Sur iOS : affiche un tutoriel
 */
function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSTutorial, setShowIOSTutorial] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installState, setInstallState] = useState('idle'); // 'idle', 'installing', 'success', 'error'

  useEffect(() => {
    // Vérifier si déjà installé en mode standalone
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone === true;
    setIsStandalone(standalone);
    
    if (standalone) return;

    // Vérifier si déjà refusé récemment (7 jours)
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const now = new Date();
      const daysDiff = (now - dismissedDate) / (1000 * 60 * 60 * 24);
      if (daysDiff < 7) return;
    }

    // Détecter iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    if (iOS) {
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
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Écouter si l'app est installée
    const handleInstalled = () => {
      setInstallState('success');
      setTimeout(() => {
        setShowPrompt(false);
        setDeferredPrompt(null);
        setInstallState('idle');
      }, 3000);
    };

    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setInstallState('installing');

    try {
      // Afficher le prompt natif
      deferredPrompt.prompt();
      
      // Attendre le choix de l'utilisateur
      const { outcome } = await deferredPrompt.userChoice;
      console.log('Choix utilisateur:', outcome);
      
      if (outcome === 'accepted') {
        // L'événement 'appinstalled' sera déclenché
        // On reste sur 'installing' en attendant
      } else {
        // Utilisateur a refusé
        setInstallState('idle');
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Erreur installation:', error);
      setInstallState('error');
      setTimeout(() => {
        setInstallState('idle');
        setShowPrompt(false);
      }, 3000);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSTutorial(false);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
  };

  if (isStandalone || !showPrompt) return null;

  // État : Installation en cours
  if (installState === 'installing') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm mx-4 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 text-center">
            <div className="w-20 h-20 mx-auto mb-4 relative">
              {/* Spinner animé */}
              <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-white rounded-full border-t-transparent animate-spin"></div>
              <span className="absolute inset-0 flex items-center justify-center text-3xl">🎭</span>
            </div>
            <h3 className="text-white font-bold text-xl">Installation en cours...</h3>
          </div>
          <div className="p-6 text-center">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-left">
                <span className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="animate-pulse">⏳</span>
                </span>
                <span className="text-gray-600">Téléchargement de l'application...</span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                  2
                </span>
                <span className="text-gray-400">Ajout à l'écran d'accueil</span>
              </div>
            </div>
            <p className="text-gray-500 text-sm mt-4">
              Veuillez patienter quelques secondes...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // État : Installation réussie
  if (installState === 'success') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm mx-4 overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-5xl animate-bounce">✅</span>
            </div>
            <h3 className="text-white font-bold text-xl">Installation réussie !</h3>
          </div>
          <div className="p-6 text-center">
            <p className="text-gray-600 mb-4">
              RépliCoach a été ajouté à votre écran d'accueil.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-700 text-sm">
                📲 Vous pouvez maintenant lancer l'app depuis votre écran d'accueil !
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // État : Erreur
  if (installState === 'error') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm mx-4 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-5xl">❌</span>
            </div>
            <h3 className="text-white font-bold text-xl">Erreur d'installation</h3>
          </div>
          <div className="p-6 text-center">
            <p className="text-gray-600 mb-4">
              L'installation n'a pas pu être complétée.
            </p>
            <p className="text-gray-500 text-sm">
              Essayez via le menu de votre navigateur :<br/>
              <strong>⋮ → "Installer l'application"</strong>
            </p>
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
          <div className="bg-gradient-to-r from-primary-700 to-primary-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎭</span>
              <span className="text-white font-semibold">Installer RépliCoach</span>
            </div>
            <button onClick={handleDismiss} className="text-white/70 hover:text-white p-1">
              ✕
            </button>
          </div>
          
          <div className="p-4">
            <p className="text-gray-600 text-sm mb-4">
              Ajoutez l'app à votre écran d'accueil pour un accès rapide :
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-gray-800 text-sm">
                    Appuyez sur <span className="inline-flex items-center bg-gray-200 px-2 py-0.5 rounded">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </span> Partager
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                  2
                </div>
                <p className="text-gray-800 text-sm flex-1">
                  Choisissez <strong>"Sur l'écran d'accueil"</strong>
                </p>
              </div>
              
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">
                  ✓
                </div>
                <p className="text-gray-800 text-sm flex-1">
                  Appuyez sur <strong>"Ajouter"</strong>
                </p>
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
      </div>
    );
  }

  // Prompt Android/PC
  return (
    <div className="fixed bottom-28 left-4 right-4 z-50 animate-slideUp">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-w-md mx-auto">
        <div className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center text-2xl shadow-lg">
              🎭
            </div>
            
            <div className="flex-1">
              <h3 className="text-gray-900 font-semibold">Installer RépliCoach</h3>
              <p className="text-gray-500 text-sm mt-0.5">
                Accédez rapidement à vos textes depuis l'écran d'accueil
              </p>
            </div>
            
            <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 p-1">
              ✕
            </button>
          </div>
          
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
