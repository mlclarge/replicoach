import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

function ProtectedRoute({ children }) {
  const { user } = useAuthStore()
  const location = useLocation()
  
  if (!user) {
    // Rediriger vers login en gardant l'URL d'origine
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  
  return children
}

export default ProtectedRoute
