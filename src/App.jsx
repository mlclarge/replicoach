import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuthStore } from "./store/authStore";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Upload = lazy(() => import("./pages/Upload"));
const ScriptDetail = lazy(() => import("./pages/ScriptDetail"));
const AudioMode = lazy(() => import("./pages/AudioMode"));
const Shared = lazy(() => import("./pages/Shared"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const FreeRecordings = lazy(() => import("./pages/FreeRecordings"));

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
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-darker">
            <Loader size="lg" />
          </div>
        }
      >
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
