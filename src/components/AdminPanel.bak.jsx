import { useState, useEffect } from 'react';
import { 
  getUserRole, 
  setUserRole, 
  getAllUsersWithRoles,
  supabase 
} from '../lib/supabase';

/**
 * Panneau d'administration pour gérer les rôles utilisateurs
 * Accessible uniquement aux devs
 */
export function AdminPanel({ currentUserId }) {
  const [isDevUser, setIsDevUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('director');

  useEffect(() => {
    checkAccess();
  }, [currentUserId]);

  const checkAccess = async () => {
    setLoading(true);
    try {
      const role = await getUserRole(currentUserId);
      setIsDevUser(role === 'dev');
      
      if (role === 'dev') {
        await loadUsers();
      }
    } catch (err) {
      console.error('Error checking access:', err);
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    try {
      const roles = await getAllUsersWithRoles();
      setUsers(roles);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      setError(null);
      await setUserRole(userId, newRole);
      setSuccess('Rôle mis à jour !');
      loadUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur: ' + err.message);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (!newUserEmail.trim()) return;

    try {
      setError(null);
      
      // Chercher l'utilisateur par email dans auth.users (via RPC ou autre méthode)
      // Note: Ceci nécessite une fonction RPC côté Supabase ou un autre moyen
      // Pour simplifier, on demande l'ID utilisateur directement
      
      setError('Pour ajouter un utilisateur, utilisez son ID Supabase. ' +
               'L\'email ne peut pas être recherché directement pour des raisons de sécurité.');
      
    } catch (err) {
      setError('Erreur: ' + err.message);
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'dev': return { label: 'Développeur', color: 'bg-purple-500' };
      case 'director': return { label: 'Metteur en scène', color: 'bg-gold-500' };
      default: return { label: 'Membre', color: 'bg-gray-500' };
    }
  };

  const getRoleEmoji = (role) => {
    switch (role) {
      case 'dev': return '👨‍💻';
      case 'director': return '🎬';
      default: return '👤';
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-800 rounded-xl">
        <p className="text-gray-400 text-center">Vérification des droits...</p>
      </div>
    );
  }

  if (!isDevUser) {
    return (
      <div className="p-4 bg-gray-800 rounded-xl border border-red-500/30">
        <p className="text-red-400 text-center">
          🔒 Accès réservé aux développeurs
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-purple-500/30 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-purple-900/50 border-b border-purple-500/30">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          👨‍💻 Panneau Admin
        </h2>
        <p className="text-sm text-purple-300">Gérer les rôles utilisateurs</p>
      </div>

      <div className="p-4">
        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* Légende des rôles */}
        <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-400 mb-2 font-semibold">Rôles disponibles :</p>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-purple-500 text-white text-xs rounded-full">
              👨‍💻 Dev - Tous les droits
            </span>
            <span className="px-2 py-1 bg-gold-500 text-dark text-xs rounded-full">
              🎬 Metteur en scène - Créer troupes
            </span>
            <span className="px-2 py-1 bg-gray-500 text-white text-xs rounded-full">
              👤 Membre - Lecture seule
            </span>
          </div>
        </div>

        {/* Liste des utilisateurs avec rôles */}
        <div className="space-y-2">
          <h3 className="text-white font-semibold mb-2">
            Utilisateurs avec rôles ({users.length})
          </h3>
          
          {users.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucun rôle défini</p>
          ) : (
            users.map((userRole) => {
              const roleInfo = getRoleLabel(userRole.role);
              return (
                <div 
                  key={userRole.id}
                  className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getRoleEmoji(userRole.role)}</span>
                    <div>
                      <p className="text-white text-sm font-mono">
                        {userRole.user_id.substring(0, 8)}...
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full text-white ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </div>
                  </div>
                  
                  {userRole.user_id !== currentUserId && (
                    <select
                      value={userRole.role}
                      onChange={(e) => handleChangeRole(userRole.user_id, e.target.value)}
                      className="p-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                    >
                      <option value="member">Membre</option>
                      <option value="director">Metteur en scène</option>
                      <option value="dev">Développeur</option>
                    </select>
                  )}
                  
                  {userRole.user_id === currentUserId && (
                    <span className="text-xs text-gray-400">(vous)</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Ajouter un utilisateur par ID */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h3 className="text-white font-semibold mb-2">Ajouter un rôle</h3>
          
          {!showAddUser ? (
            <button
              onClick={() => setShowAddUser(true)}
              className="w-full py-2 border-2 border-dashed border-gray-600 rounded-lg
                         text-gray-400 hover:border-purple-500 hover:text-purple-400 transition"
            >
              + Ajouter un utilisateur
            </button>
          ) : (
            <div className="p-3 bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-400 mb-2">
                Entrez l'ID Supabase de l'utilisateur (visible dans Supabase Dashboard → Auth → Users)
              </p>
              
              <input
                type="text"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="ID utilisateur (UUID)"
                className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white mb-2"
              />
              
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white mb-3"
              >
                <option value="director">🎬 Metteur en scène</option>
                <option value="dev">👨‍💻 Développeur</option>
              </select>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAddUser(false);
                    setNewUserEmail('');
                  }}
                  className="flex-1 py-2 bg-gray-600 text-gray-300 rounded"
                >
                  Annuler
                </button>
                <button
                  onClick={async () => {
                    if (!newUserEmail.trim()) return;
                    try {
                      await setUserRole(newUserEmail.trim(), newUserRole);
                      setSuccess('Rôle ajouté !');
                      setShowAddUser(false);
                      setNewUserEmail('');
                      loadUsers();
                    } catch (err) {
                      setError('Erreur: ' + err.message);
                    }
                  }}
                  disabled={!newUserEmail.trim()}
                  className="flex-1 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-blue-400 text-xs">
            💡 <strong>Astuce :</strong> Pour trouver l'ID d'un utilisateur, allez dans 
            Supabase Dashboard → Authentication → Users → cliquez sur l'utilisateur → copiez l'UID
          </p>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
