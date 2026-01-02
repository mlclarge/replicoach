import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', icon: '📚', label: 'Mes textes' },
  { to: '/shared', icon: '👥', label: 'Partagés' },
  { to: '/profile', icon: '⚙️', label: 'Profil' },
]

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark border-t border-gray-800
                    flex justify-around py-2 px-4 safe-area-pb z-50">
      {navItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `
            flex flex-col items-center py-2 px-4 rounded-lg transition
            ${isActive
              ? 'text-primary-500'
              : 'text-gray-500 hover:text-gray-300'}
          `}
        >
          <span className="text-xl">{item.icon}</span>
          <span className="text-xs mt-1">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default BottomNav
