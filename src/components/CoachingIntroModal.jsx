/**
 * Modal d'introduction au Coaching IA
 * S'affiche une seule fois au premier usage (premier clic sur 💡)
 */

export default function CoachingIntroModal({ isOpen, onClose, onUnderstand }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center gap-3">
            <span className="text-4xl">💡</span>
            <div>
              <h2 className="text-2xl font-bold">Bienvenue !</h2>
              <p className="text-violet-100">Coaching IA pour votre jeu</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-5">
          <div className="bg-violet-50 border-l-4 border-violet-600 p-4 rounded">
            <p className="text-gray-800 font-semibold mb-2">Voici comment ça marche :</p>
            <ol className="space-y-3 text-gray-700 text-sm">
              <li className="flex gap-3">
                <span className="font-bold text-violet-600">1.</span>
                <span>Décrivez brièvement comment vous voulez jouer ce personnage</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-violet-600">2.</span>
                <span>
                  L'IA vous propose 5-7 conseils de jeu : mouvements, intonation, psychologie...
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-violet-600">3.</span>
                <span>
                  Sauvegardez les suggestions comme notes permanentes pour les relire plus tard
                </span>
              </li>
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded">
            <p className="text-sm text-blue-900">
              <strong>💰 Le coût :</strong> Très peu cher ! Environ <strong>0,02€ par suggestion</strong>.
              <br />
              <em>(Moins cher qu'un café ☕)</em>
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 p-4 rounded">
            <p className="text-sm text-green-900">
              <strong>🎭 Conseil :</strong> L'IA est un outil pour explorer votre personnage.
              <br />
              Si un conseil ne vous plaît pas, <strong>faites confiance à votre instinct</strong> !
              C'est VOUS l'artiste.
            </p>
          </div>

          <div className="text-xs text-gray-500 text-center mt-4">
            💡 Plus de questions ? Consultez l'aide (?) une fois le coaching ouvert.
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-100 transition border border-gray-300"
          >
            Pas maintenant
          </button>
          <button
            onClick={onUnderstand}
            className="flex-1 bg-violet-600 text-white py-3 rounded-lg font-semibold hover:bg-violet-700 transition"
          >
            ✓ J'ai compris !
          </button>
        </div>
      </div>
    </div>
  );
}
