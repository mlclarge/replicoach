import { PREMIUM_FEATURES } from "../lib/premiumFeatures";

/**
 * Modale de paywall Premium réutilisable.
 * Affiche un message dédié selon la fonctionnalité demandée (voir premiumFeatures.js).
 *
 * @param {Object} props
 * @param {string} props.featureKey - Clé de PREMIUM_FEATURES (ex: 'AI_COACHING', 'OCR_AUTO')
 * @param {() => void} props.onClose - Appelé à la fermeture de la modale
 * @param {() => void} [props.onDiscoverPremium] - Appelé au clic sur "Découvrir Premium"
 */
function PremiumGateModal({ featureKey, onClose, onDiscoverPremium }) {
  const feature = PREMIUM_FEATURES[featureKey] || {
    title: "Fonctionnalité Premium",
    description:
      "Cette fonctionnalité est réservée aux abonnés Premium. Passez au niveau supérieur pour la débloquer !",
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full border border-gold-500/30 text-center shadow-2xl">
        <span className="text-5xl block mb-4">✨</span>
        <h3 className="text-xl font-bold text-gold-400 mb-2">
          {feature.title}
        </h3>
        <p className="text-gray-300 mb-6 text-sm">{feature.description}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              onClose();
              if (onDiscoverPremium) onDiscoverPremium();
            }}
            className="w-full py-3 bg-gradient-to-r from-gold-600 to-gold-500 text-dark font-bold rounded-lg hover:from-gold-500 hover:to-gold-400"
          >
            Découvrir Premium
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}

export default PremiumGateModal;
