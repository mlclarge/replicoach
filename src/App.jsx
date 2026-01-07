import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuthStore } from "./store/authStore";

// Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Upload from "./pages/Upload";
import ScriptDetail from "./pages/ScriptDetail";
import AudioMode from "./pages/AudioMode";
import Shared from "./pages/Shared";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import FreeRecordings from "./pages/FreeRecordings";

// Components
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Layout from "./components/layout/Layout";
import Loader from "./components/ui/Loader";

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
      <Routes>
        {/* Routes publiques */}
        <Route path="/login" element={<Login />} />

        {/* Routes protégées */}
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
          <Route path="/shared" element={<Shared />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/recordings" element={<FreeRecordings />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
