import { useState, useEffect } from 'react';
import { 
  addTroupeVideo, 
  fetchTroupeVideos, 
  deleteTroupeVideo,
  extractYoutubeId,
  isUserTroupeAdmin 
} from '../lib/supabase';

/**
 * Composant pour gérer les vidéos YouTube d'une troupe
 */
export function TroupeVideos({ troupeId, userId, troupeName }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Formulaire
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [troupeId, userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [videosData, adminStatus] = await Promise.all([
        fetchTroupeVideos(troupeId),
        isUserTroupeAdmin(troupeId, userId)
      ]);
      setVideos(videosData);
      setIsAdmin(adminStatus);
    } catch (err) {
      console.error('Error loading videos:', err);
    }
    setLoading(false);
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    
    const videoId = extractYoutubeId(youtubeUrl);
    if (!videoId) {
      setError('URL YouTube invalide. Exemple: https://youtu.be/xxx ou https://youtube.com/watch?v=xxx');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await addTroupeVideo(troupeId, userId, title, youtubeUrl, description);
      setSuccess('Vidéo ajoutée !');
      setShowAddForm(false);
      setTitle('');
      setYoutubeUrl('');
      setDescription('');
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur: ' + err.message);
    }
    setSaving(false);
  };

  const handleDelete = async (video) => {
    if (!confirm(`Supprimer "${video.title}" ?`)) return;

    try {
      await deleteTroupeVideo(video.id);
      loadData();
    } catch (err) {
      setError('Erreur suppression: ' + err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          📹 Vidéos - {troupeName}
        </h3>
        {isAdmin && (
          <span className="text-xs bg-gold-500 text-dark px-2 py-1 rounded-full font-bold">
            Admin
          </span>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Aide UX */}
      {isAdmin && !showAddForm && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-blue-400 text-sm font-semibold mb-2">💡 Comment ajouter une vidéo :</p>
          <ol className="text-blue-300 text-xs space-y-1 list-decimal list-inside">
            <li>Uploadez votre vidéo sur YouTube en mode <strong>"Non répertorié"</strong></li>
            <li>Copiez le lien de la vidéo</li>
            <li>Collez-le ci-dessous</li>
          </ol>
          <p className="text-blue-400/70 text-xs mt-2">
            ℹ️ "Non répertorié" = seuls ceux avec le lien peuvent voir
          </p>
        </div>
      )}

      {/* Bouton ajouter (admin only) */}
      {isAdmin && !showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-600 rounded-xl
                     text-gray-400 hover:border-gold-500 hover:text-gold-500 transition"
        >
          + Ajouter une vidéo YouTube
        </button>
      )}

      {/* Formulaire ajout */}
      {showAddForm && (
        <form onSubmit={handleAddVideo} className="p-4 bg-gray-800 rounded-xl border border-gray-600">
          <h4 className="font-semibold text-white mb-3">Nouvelle vidéo</h4>
          
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la vidéo"
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white mb-3"
            required
          />
          
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://youtu.be/xxxxx ou https://youtube.com/watch?v=xxxxx"
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white mb-3"
            required
          />
          
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optionnel)"
            rows={2}
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white mb-3 resize-none"
          />
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setTitle('');
                setYoutubeUrl('');
                setDescription('');
              }}
              className="flex-1 py-2 bg-gray-700 text-gray-300 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !title || !youtubeUrl}
              className="flex-1 py-2 bg-gold-500 text-dark rounded-lg font-semibold 
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '⏳...' : '📤 Ajouter'}
            </button>
          </div>
        </form>
      )}

      {/* Liste des vidéos */}
      {videos.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-4xl mb-2">📹</p>
          <p className="text-gray-500">Aucune vidéo pour le moment</p>
          {!isAdmin && (
            <p className="text-gray-600 text-sm mt-1">
              Le metteur en scène ajoutera les vidéos ici
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((video) => {
            const videoId = extractYoutubeId(video.youtube_url);
            
            return (
              <div
                key={video.id}
                className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700"
              >
                {/* Thumbnail YouTube */}
                {videoId && (
                  <div 
                    className="relative w-full aspect-video bg-gray-900 cursor-pointer group"
                    onClick={() => window.open(video.youtube_url, '_blank')}
                  >
                    <img
                      src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 
                                    flex items-center justify-center transition">
                      <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center
                                      shadow-lg group-hover:scale-110 transition">
                        <span className="text-white text-2xl ml-1">▶</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{video.title}</h4>
                      {video.description && (
                        <p className="text-gray-400 text-sm mt-1">{video.description}</p>
                      )}
                      <p className="text-gray-600 text-xs mt-2">
                        {new Date(video.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    
                    <div className="flex gap-1">
                      <button
                        onClick={() => window.open(video.youtube_url, '_blank')}
                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                        title="Voir sur YouTube"
                      >
                        ▶️
                      </button>
                      
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(video)}
                          className="p-2 bg-gray-700 text-red-400 rounded-lg hover:bg-red-900"
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info pour les membres */}
      {!isAdmin && videos.length > 0 && (
        <p className="text-xs text-gray-500 text-center">
          📹 Vidéos ajoutées par le metteur en scène
        </p>
      )}
    </div>
  );
}

export default TroupeVideos;
