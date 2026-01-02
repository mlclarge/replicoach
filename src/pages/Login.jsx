import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

function Login() {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle } = useAuthStore();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    if (isSignUp) {
      if (password.length < 6) {
        setError("Le mot de passe doit contenir au moins 6 caractères");
        return;
      }
      if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas");
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            setError("Cet email est déjà utilisé");
          } else {
            setError(signUpError.message);
          }
        } else {
          // Afficher la page de confirmation
          setShowConfirmation(true);
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          if (signInError.message.includes("Invalid login")) {
            setError("Email ou mot de passe incorrect");
          } else if (signInError.message.includes("Email not confirmed")) {
            setError("Veuillez d'abord confirmer votre email en cliquant sur le lien reçu");
          } else {
            setError(signInError.message);
          }
        } else {
          navigate("/");
        }
      }
    } catch (err) {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError("Erreur de connexion avec Google");
      }
    } catch (err) {
      setError("Une erreur est survenue avec Google");
    } finally {
      setLoading(false);
    }
  };

  // Page de confirmation après inscription
  if (showConfirmation) {
    return (
      <div className="min-h-screen bg-darker flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="card text-center">
            {/* Icône email */}
            <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full 
                            flex items-center justify-center">
              <span className="text-5xl">📧</span>
            </div>

            <h2 className="text-xl font-semibold text-white mb-3">
              Vérifiez votre boîte mail !
            </h2>

            <p className="text-gray-400 mb-6">
              Un email de confirmation a été envoyé à :
            </p>

            <p className="text-gold-500 font-semibold mb-6 break-all">
              {email}
            </p>

            <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
              <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                📋 Étapes suivantes :
              </h3>
              <ol className="text-gray-400 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-gold-500 font-bold">1.</span>
                  <span>Ouvrez votre boîte mail</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold-500 font-bold">2.</span>
                  <span>Cherchez l'email de RépliCoach</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold-500 font-bold">3.</span>
                  <span>Cliquez sur le lien de confirmation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold-500 font-bold">4.</span>
                  <span>Revenez ici pour vous connecter</span>
                </li>
              </ol>
            </div>

            <p className="text-gray-500 text-xs mb-6">
              💡 Pensez à vérifier vos spams si vous ne trouvez pas l'email
            </p>

            <button
              onClick={() => {
                setShowConfirmation(false);
                setIsSignUp(false);
                setPassword("");
                setConfirmPassword("");
              }}
              className="btn-gold w-full"
            >
              ← Retour à la connexion
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-gray-600 text-sm mt-8">
          Une application pour les comédiens 🎭
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darker flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-display text-gold-500 flex items-center justify-center gap-2">
          🎭 RépliCoach
        </h1>
        <p className="text-gray-400 mt-2">Mémorisez vos répliques facilement</p>
      </div>

      {/* Formulaire */}
      <div className="w-full max-w-sm">
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            {isSignUp ? "Créer un compte" : "Se connecter"}
          </h2>

          {/* Bouton Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 
                       text-gray-800 font-semibold py-3 px-4 rounded-full transition mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuer avec Google
          </button>

          {/* Séparateur */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gray-700"></div>
            <span className="text-gray-500 text-sm">ou</span>
            <div className="flex-1 h-px bg-gray-700"></div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full"
                placeholder="votre@email.com"
                disabled={loading}
              />
            </div>

            {/* Mot de passe */}
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full"
                placeholder={
                  isSignUp ? "Minimum 6 caractères" : "Votre mot de passe"
                }
                disabled={loading}
              />
            </div>

            {/* Confirmation mot de passe */}
            {isSignUp && (
              <div className="mb-4">
                <label className="block text-gray-400 text-sm mb-2">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input w-full"
                  placeholder="Retapez votre mot de passe"
                  disabled={loading}
                />
              </div>
            )}

            {/* Messages d'erreur/succès */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500 rounded-lg">
                <p className="text-green-400 text-sm">{success}</p>
              </div>
            )}

            {/* Bouton principal */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mb-4"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> Chargement...
                </span>
              ) : isSignUp ? (
                "S'inscrire"
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          {/* Toggle inscription/connexion */}
          <div className="text-center pt-4 border-t border-gray-700">
            <p className="text-gray-400 text-sm">
              {isSignUp ? "Déjà un compte ?" : "Pas encore de compte ?"}
            </p>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccess(null);
              }}
              className="text-gold-500 hover:text-gold-400 font-semibold mt-1"
            >
              {isSignUp ? "Se connecter" : "S'inscrire"}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="text-gray-600 text-sm mt-8">
        Une application pour les comédiens 🎭
      </p>
    </div>
  );
}

export default Login;
