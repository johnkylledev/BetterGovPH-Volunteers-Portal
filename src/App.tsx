import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import UserDashboard from "./pages/dashboard/UserDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Verify from "./pages/public/Verify";
import Landing from "./pages/public/Landing";
import Privacy from "./pages/public/Privacy";
import Terms from "./pages/public/Terms";
import Projects from "./pages/public/Projects";
import { useStore } from "./store/useStore";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { useUser } from "@clerk/react";
import { getUserData } from "./services/supabase";

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { currentUser } = useStore();
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) return <LoadingOverlay />;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  if (!currentUser) return <LoadingOverlay />;
  if (adminOnly && !currentUser?.isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useStore();
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) return <LoadingOverlay />;
  if (isSignedIn) {
    return <Navigate to={currentUser?.isAdmin ? "/admin" : "/dashboard"} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { setCurrentUser, setAuthInitialized } = useStore();
  const { isLoaded, user } = useUser();

  useEffect(() => {
    let cancelled = false;
    if (!isLoaded) return;
    setAuthInitialized(true);
    if (!user) {
      setCurrentUser(null);
      return;
    }
    (async () => {
      const profile = await getUserData(user.id).catch(() => null);
      if (cancelled) return;
      setCurrentUser(profile);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, user, setAuthInitialized, setCurrentUser]);

  const isEmbed = window.location.pathname.includes('/verify') && window.location.search.includes('embed=true');

  return (
    <>
      {!isLoaded && !isEmbed && <LoadingOverlay />}
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/verify/:id" element={<Verify />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </Router>
    </>
  );
}
