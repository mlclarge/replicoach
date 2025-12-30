import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="min-h-screen bg-darker flex flex-col items-center justify-center p-4">
      <p className="text-6xl mb-4">🎭</p>
      <h1 className="text-2xl font-display text-gold-500 mb-2">
        Page introuvable
      </h1>
      <p className="text-gray-400 mb-6 text-center">
        Cette scène n'existe pas dans notre pièce !
      </p>
      <Link to="/" className="btn-primary">
        Retour à l'accueil
      </Link>
    </div>
  )
}

export default NotFound
