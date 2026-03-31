/**
 * Modal FAQ et Aide pour le Coaching IA
 */
import { useState } from "react";

export default function CoachingHelpModal({ isOpen, onClose }) {
  const [expandedFaq, setExpandedFaq] = useState(null);

  const faqs = [
    {
      id: 1,
      q: "Comment accéder au coaching IA ?",
      a: "Ouvrez un script, allez à la lecture du texte. À côté de chaque personnage, vous verrez un bouton 💡 violet. Cliquez dessus pour lancer le coaching.",
    },
    {
      id: 2,
      q: "Que doit-je écrire dans 'Comment avez-vous prévu de jouer ce personnage ?'",
      a: "Décrivez brièvement votre vision du rôle. Par exemple : 'Je la joue timide et fragile', 'Je veux qu'il soit énergique et comique', 'Elle doit être mystérieuse'... L'IA utilisera cette info pour vous donner des conseils ciblés.",
    },
    {
      id: 3,
      q: "Quel est le coût des suggestions IA ?",
      a: "Environ 0,02€ par suggestion. C'est très peu coûteux ! Une alerte apparaît si vous dépassez 5€ en une session pour vous protéger.",
    },
    {
      id: 4,
      q: "Je peux sauvegarder les suggestions ?",
      a: "Oui ! En bas du résultat, cliquez 'Sauvegarder comme note' et les suggestions deviennent une note permanente dans votre profil.",
    },
    {
      id: 5,
      q: "Puis-je régénérer ou modifier ma demande ?",
      a: "Oui ! Vous pouvez : régénérer (relancer avec le même contexte), ou modifier votre approche du rôle et redemander.",
    },
    {
      id: 6,
      q: "L'IA fonctionne hors-ligne ?",
      a: "Non, vous devez être connecté à Internet. C'est une feature en ligne qui appelle une IA depuis le cloud.",
    },
    {
      id: 7,
      q: "Pourquoi 'API Gemini non configurée' ?",
      a: "C'est un problème de configuration. Rafraîchissez la page. Si ça persiste, contactez l'administrateur.",
    },
    {
      id: 8,
      q: "L'IA donne toujours de bons conseils ?",
      a: "L'IA est un outil d'aide. Elle connaît la théorie théâtrale, mais c'est VOUS l'artiste ! Si un conseil ne vous plaît pas, ignorez-le et faites confiance à votre instinct.",
    },
  ];

  const toggleFaq = (id) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-violet-600 to-violet-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💡</span>
              <h2 className="text-2xl font-bold">Besoin d'aide ?</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-violet-800 rounded-lg p-2 transition"
            >
              ✕
            </button>
          </div>
          <p className="text-violet-100 mt-2">
            Questions fréquentes sur le coaching IA pour votre jeu d'acteur
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {faqs.map((faq) => (
            <div key={faq.id} className="border border-violet-200 rounded-lg">
              <button
                onClick={() => toggleFaq(faq.id)}
                className="w-full text-left p-4 hover:bg-violet-50 transition flex items-center justify-between font-semibold text-gray-800"
              >
                <span>{faq.q}</span>
                <span
                  className={`text-violet-600 transition-transform ${
                    expandedFaq === faq.id ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>
              {expandedFaq === faq.id && (
                <div className="px-4 pb-4 text-gray-700 border-t border-violet-200 bg-violet-50 py-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}

          {/* Additional Info */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>💡 Conseil :</strong> Les conseils de l'IA sont sauvegardables ! 
              Cliquez "Sauvegarder comme note" pour les archiver et les relire plus tard.
            </p>
          </div>

          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-900">
              <strong>🎭 Astuce :</strong> N'hésitez pas à régénérer les suggestions plusieurs fois 
              avec des approches différentes. L'IA proposera chaque fois des angles différents !
            </p>
          </div>
        </div>

        {/* Footer Button */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full bg-violet-600 text-white py-3 rounded-lg font-semibold hover:bg-violet-700 transition"
          >
            ✓ J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
}
