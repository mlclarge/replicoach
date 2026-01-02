import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { supabase } from "../lib/supabase";
import Loader from "../components/ui/Loader";

/**
 * Page des textes partagés
 * - Affiche les textes partagés par d'autres utilisateurs
 * - Permet de rejoindre une troupe
 */
function Shared() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [sharedScripts, setSharedScripts] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    loadSharedScripts();
  }, [user]);

  const loadSharedScripts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Charger les scripts partagés avec l'utilisateur
      // Pour l'instant, cette table n'existe pas encore
      // On prépare l'interface pour quand elle sera créée
      
      const { data, error } = await supabase
        .from('shared_scripts')
        .select(`
          *,
          scripts (
            id,
            title,
            characters,
            replicas
          ),
          shared_by:users!shared_scripts_shared_by_fkey (
            email
          )
        `)
        .eq('shared_with', user.id);

      if (error) {
        // Table n'existe pas encore, c'est normal
        console.log("Partage pas encore configuré:", error.message);
        setSharedScripts([]);
      } else {
        setSharedScripts(data || []);
      }
    } catch (err) {
      console.log("Fonctionnalité partage en cours de développement");
      setSharedScripts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTroupe = async () => {
    if (!joinCode.trim()) return;
    
    // TODO: Implémenter la logique pour rejoindre une troupe avec un code
    alert("Fonctionnalité en cours de développement ! 🚧");
    setShowJoinModal(false);
    setJoinCode("");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-display text-gold-500 mb-6">
        👥 Textes partagés
      </h1>

      {/* Bouton rejoindre une troupe */}
      <button
        onClick={() => setShowJoinModal(true)}
        className="w-full mb-6 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl border-2 border-dashed 
                   border-gray-600 hover:border-primary-500 transition flex items-center justify-center gap-3"
      >
        <span className="text-2xl">🎭</span>
        <span className="text-gray-300 font-medium">Rejoindre une troupe</span>
      </button>

      {/* Liste des scripts partagés */}
      {sharedScripts.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-6 bg-gray-800 rounded-full flex items-center justify-center">
            <span className="text-5xl">📭</span>
          </div>
          
          <h2 className="text-xl font-semibold text-white mb-2">
            Aucun texte partagé
          </h2>
          
          <p className="text-gray-400 mb-6 max-w-sm mx-auto">
            Quand un membre de votre troupe partagera un texte avec vous, 
            il apparaîtra ici.
          </p>

          <div className="bg-gray-800/50 rounded-xl p-6 max-w-md mx-auto text-left">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              💡 Comment ça marche ?
            </h3>
            <ul className="text-gray-400 text-sm space-y-3">
              <li className="flex items-start gap-2">
                <span className="text-gold-500">1.</span>
                <span>Un membre de la troupe importe un texte</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-500">2.</span>
                <span>Il clique sur l'icône de partage 📤</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-500">3.</span>
                <span>Vous recevez le texte dans cet espace</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-500">4.</span>
                <span>Chacun peut s'entraîner sur ses répliques !</span>
              </li>
            </ul>
          </div>

          <div className="mt-8">
            <Link to="/upload" className="btn-gold inline-flex items-center gap-2">
              ➕ Importer mon premier texte
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sharedScripts.map((shared) => (
            <Link
              key={shared.id}
              to={`/script/${shared.scripts?.id}`}
              className="card block hover:border-primary-500 transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📜</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">
                    {shared.scripts?.title || "Sans titre"}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Partagé par {shared.shared_by?.email || "un membre"}
                  </p>
                </div>
                <div className="text-gray-500">
                  →
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal rejoindre une troupe */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl max-w-sm w-full border border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                🎭 Rejoindre une troupe
              </h3>
            </div>

            <div className="p-4">
              <p className="text-gray-400 text-sm mb-4">
                Entrez le code de votre troupe pour accéder aux textes partagés.
              </p>
              
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CODE-TROUPE"
                className="input w-full text-center text-lg tracking-widest uppercase"
                maxLength={12}
              />

              <p className="text-gray-500 text-xs mt-2 text-center">
                Demandez le code à votre metteur en scène
              </p>
            </div>

            <div className="p-4 border-t border-gray-700 flex gap-3">
              <button
                onClick={() => setShowJoinModal(false)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleJoinTroupe}
                className="btn-gold flex-1"
                disabled={!joinCode.trim()}
              >
                Rejoindre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Shared;
