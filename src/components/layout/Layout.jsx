import { Outlet } from "react-router-dom";
import Header from "./Header";
import BottomNav from "./BottomNav";
import InstallPrompt from "../InstallPrompt";
import Onboarding from "../Onboarding";
import OfflineIndicator from "../OfflineIndicator";
import { useSessionTracker } from "../Monitoring";

export default function Layout() {
  useSessionTracker();

  return (
    <div className="min-h-screen bg-darker flex flex-col text-gray-100">
      <OfflineIndicator />
      <Header />
      <main className="flex-1 pb-24 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
      <InstallPrompt />
      <Onboarding />
    </div>
  );
}
