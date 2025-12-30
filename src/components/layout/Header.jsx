import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

function Header() {
  const { user, signOut } = useAuthStore()
  const [showMenu, setShowMenu] = useState(false)
  
  const initials = user?.email?.slice(0, 2).toUpperCase() || '?'
  
  const handleSignOut = async () => {
    setShowMenu(false)
    await signOut()
  }
  
  return (
    <header className="bg-primary-700 text-white px-4 py-3 flex items-center justify-between relative">
      {/* Logo cliquable vers l'accueil */}
      <Link to="/" className="hover:opacity-80 transition active:scale-95">
        <h1 className="text-xl font-display font-bold flex items-center gap-2">
          <span>🎭</span>
          <span>RépliCoach</span>
        </h1>
      </Link>
      
      <div className="relative">
        <button 
          onClick={() => setShowMenu(!showMenu)}
          className="w-10 h-10 rounded-full bg-gold-500 text-dark font-bold 
                     flex items-center justify-center hover:bg-gold-400 
                     transition active:scale-95"
        >
          {initials}
        </button>
        
        {/* Dropdown menu */}
        {showMenu && (
          <>
            <div 
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-12 bg-dark border border-gray-700 
                          rounded-lg shadow-xl z-20 min-w-48 py-2">
              <div className="px-4 py-2 border-b border-gray-700">
                <p className="text-sm text-gray-400">Connecté en tant que</p>
                <p className="text-sm font-medium truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-red-400 
                         hover:bg-gray-800 transition"
              >
                Se déconnecter
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

export default Header
