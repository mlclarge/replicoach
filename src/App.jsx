import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "./store/authStore";

// Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Upload from "./pages/Upload";
import ScriptDetail from "./pages/ScriptDetail";
import AudioMode from "./pages/AudioMode";
import NotFound from "./pages/NotFound";

// Components
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Layout from "./components/layout/Layout";
import Loader from "./components/ui/Loader";

// Composant pour nettoyer l'URL apres OAuth
function OAuthCleanup() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    // Si l'URL contient un token OAuth et qu'on est connecte, nettoyer
    if (location.hash && location.hash.includes("access_token")) {
      // Attendre un peu que Supabase traite le token
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 100);
    }
  }, [location.hash, navigate, user]);

  return null;
}

function AppContent() {
  return (
    <>
      <OAuthCleanup />
      <Routes>
        {/* Routes publiques */}
        <Route path="/login" element={<Login />} />

        {/* Routes protegees */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/script/:id" element={<ScriptDetail />} />
          <Route path="/script/:id/audio" element={<AudioMode />} />
          <Route path="/shared" element={<Home />} />
          <Route path="/settings" element={<Home />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function App() {
  const { initialize, loading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-darker">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
