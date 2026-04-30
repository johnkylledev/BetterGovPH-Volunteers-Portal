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
import { onAuthStateChange } from "./services/supabase";
import { LoadingOverlay } from "./components/LoadingOverlay";

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { currentUser, authInitialized } = useStore();

  if (!authInitialized) return <LoadingOverlay />;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (adminOnly && !currentUser.isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, authInitialized } = useStore();

  if (!authInitialized) return <LoadingOverlay />;
  if (currentUser) {
    return <Navigate to={currentUser.isAdmin ? "/admin" : "/dashboard"} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { updateCurrentUserFromSupabase } = useStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        await updateCurrentUserFromSupabase(user.uid || user.id);
      } else {
        useStore.getState().setCurrentUser(null);
      }
      useStore.getState().setAuthInitialized(true);
    });

    return () => unsubscribe();
  }, [updateCurrentUserFromSupabase]);

  const { authInitialized } = useStore();

  const isEmbed = window.location.pathname.includes('/verify') && window.location.search.includes('embed=true');

  return (
    <>
      {!authInitialized && !isEmbed && <LoadingOverlay />}
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
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
