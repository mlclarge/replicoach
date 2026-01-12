import { Outlet } from "react-router-dom";
import Header from "./Header";
import BottomNav from "./BottomNav";
import InstallPrompt from "../InstallPrompt";
import Onboarding from "../Onboarding";
import OfflineIndicator from "../OfflineIndicator";
import { useSessionTracker } from "../Monitoring";

function Layout() {
  // Tracker la session utilisateur pour le monitoring
  useSessionTracker();

  return (
    <div className="min-h-screen bg-darker flex flex-col">
      {/* Indicateur hors-ligne */}
      <OfflineIndicator />

      <Header />
      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />

      {/* Prompt d'installation PWA */}
      <InstallPrompt />

      {/* Tutoriel première visite */}
      <Onboarding />
    </div>
  );
}

export default Layout;
