/**
 * Modal d'introduction au Coaching IA
 * S'affiche une seule fois au premier usage (premier clic sur 💡)
 */

export default function CoachingIntroModal({ isOpen, onClose, onUnderstand }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-violet-600 to-violet-700 text-white p-4 sm:p-6 rounded-t-xl flex-shrink-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-3xl sm:text-4xl">✨</span>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold">Bienvenue !</h2>
              <p className="text-violet-100 text-xs sm:text-sm">Coaching IA pour votre jeu</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-8 space-y-4 sm:space-y-5 flex-1 overflow-y-auto">
          <div className="bg-violet-50 border-l-4 border-violet-600 p-3 sm:p-4 rounded">
            <p className="text-gray-800 font-semibold mb-2 text-sm sm:text-base">Voici comment ça marche :</p>
            <ol className="space-y-2 sm:space-y-3 text-gray-700 text-xs sm:text-sm">
              <li className="flex gap-2 sm:gap-3">
                <span className="font-bold text-violet-600 flex-shrink-0">1.</span>
                <span>Décrivez brièvement comment vous voulez jouer ce personnage</span>
              </li>
              <li className="flex gap-2 sm:gap-3">
                <span className="font-bold text-violet-600 flex-shrink-0">2.</span>
                <span>
                  L'IA vous propose 5-7 conseils de jeu : mouvements, intonation, psychologie...
                </span>
              </li>
              <li className="flex gap-2 sm:gap-3">
                <span className="font-bold text-violet-600 flex-shrink-0">3.</span>
                <span>
                  Sauvegardez les suggestions comme notes permanentes pour les relire plus tard
                </span>
              </li>
            </ol>
          </div>

          <div className="bg-green-50 border border-green-200 p-3 sm:p-4 rounded">
            <p className="text-xs sm:text-sm text-green-900">
              <strong>💰 Coût :</strong> Gratuit pour l'atelier du Tpt !<br />
              <em>(Coût pris en charge par Replicoach Company :) )</em><br />
              Pour info sinon : <strong>0.02€ par suggestion</strong>.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 p-3 sm:p-4 rounded">
            <p className="text-xs sm:text-sm text-green-900">
              <strong>🎭 Conseil :</strong> L'IA est un outil pour explorer votre personnage.
              <br />
              Si un conseil ne vous plaît pas, <strong>faites confiance à votre instinct</strong> !
              C'est VOUS l'artiste.
            </p>
          </div>

          <div className="text-xs text-gray-500 text-center">
            ✨ Plus de questions ? Consultez l'aide (?) une fois le coaching ouvert.
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="border-t border-gray-200 p-3 sm:p-6 bg-gray-50 rounded-b-xl flex gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 text-gray-700 py-2 sm:py-3 px-2 rounded-lg font-semibold hover:bg-gray-100 transition border border-gray-300 text-sm sm:text-base"
          >
            Pas maintenant
          </button>
          <button
            onClick={onUnderstand}
            className="flex-1 bg-violet-600 text-white py-2 sm:py-3 px-2 rounded-lg font-semibold hover:bg-violet-700 transition text-sm sm:text-base"
          >
            ✓ J'ai compris !
          </button>
        </div>
      </div>
    </div>
  );
}
