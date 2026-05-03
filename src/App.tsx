import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
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
import { getUserData } from "./services/supabase";
import { supabase } from "./services/supabase";

const isProfileComplete = (u: any) => {
  if (!u) return false;
  const fullNameOk = typeof u.fullName === 'string' && u.fullName.trim().length > 0;
  const discordOk = typeof u.discordUsername === 'string' && u.discordUsername.trim().length > 0;
  const specializationOk = typeof u.specialization === 'string' && u.specialization.trim().length > 0;
  const yearOk = typeof u.yearJoined === 'number' && Number.isFinite(u.yearJoined);
  return fullNameOk && discordOk && specializationOk && yearOk;
};

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { currentUser, authInitialized } = useStore();
  const { sessionUserId } = useStore();

  if (!authInitialized) return <LoadingOverlay />;
  if (!sessionUserId) return <Navigate to="/login" replace />;
  if (!currentUser) return <LoadingOverlay />;
  if (adminOnly && !currentUser?.isAdmin) return <Navigate to="/dashboard" replace />;
  if (!adminOnly && !currentUser?.isAdmin && !isProfileComplete(currentUser)) return <Navigate to="/register" replace />;

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, authInitialized } = useStore();
  const { sessionUserId } = useStore();
  const location = useLocation();

  if (!authInitialized) return <LoadingOverlay />;
  if (sessionUserId) {
    if (!currentUser) {
      if (location.pathname === "/login") return <Navigate to="/register" replace />;
      return <LoadingOverlay />;
    }
    if (currentUser?.isAdmin) return <Navigate to="/admin" replace />;
    return <Navigate to={isProfileComplete(currentUser) ? "/dashboard" : "/register"} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { setCurrentUser, setAuthInitialized } = useStore();
  const setSessionUserId = useStore((s: any) => s.setSessionUserId);
  const sessionUserId = useStore((s) => s.sessionUserId);
  const authInitialized = useStore((s) => s.authInitialized);
  const [_bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    const STORAGE_VERSION = '1.0';
    const currentVersion = localStorage.getItem('app-version');
    if (currentVersion !== STORAGE_VERSION) {
      localStorage.clear();
      localStorage.setItem('app-version', STORAGE_VERSION);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBootstrapping(true);
    setAuthInitialized(true);
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id ?? null;
        if (cancelled) return;
        setSessionUserId(uid);
        setBootstrapping(false);

        if (!uid) {
          setCurrentUser(null);
          return;
        }

        (async () => {
          let profile = await getUserData(uid).catch(() => null);
          for (let i = 0; i < 10 && !cancelled && !profile; i++) {
            await new Promise((r) => setTimeout(r, 250));
            profile = await getUserData(uid).catch(() => null);
          }
          if (cancelled) return;
          setCurrentUser(profile);
        })();
      } catch {
        if (!cancelled) {
          setSessionUserId(null);
          setCurrentUser(null);
          setBootstrapping(false);
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const uid = session?.user?.id ?? null;
      setSessionUserId(uid);
      if (!uid) {
        setCurrentUser(null);
      } else {
        const profile = await getUserData(uid).catch(() => null);
        setCurrentUser(profile);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [setCurrentUser, setAuthInitialized, setSessionUserId]);

  useEffect(() => {
    if (!sessionUserId) return;

    const channel = supabase
      .channel('user-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `uid=eq.${sessionUserId}`,
        },
        async (payload) => {
          const profile = await getUserData(sessionUserId).catch(() => null);
          if (profile) {
            setCurrentUser(profile);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [sessionUserId, setCurrentUser]);

  useEffect(() => {
    if (!sessionUserId) return;
    let cancelled = false;
    const refresh = async () => {
      const profile = await getUserData(sessionUserId).catch(() => null);
      if (cancelled) return;
      if (profile) setCurrentUser(profile);
    };
    refresh();
    const intervalMs = 10000;
    const t = setInterval(refresh, intervalMs);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [sessionUserId, setCurrentUser]);

  const isEmbed = window.location.pathname.includes('/verify') && window.location.search.includes('embed=true');

  return (
    <>
      {!authInitialized && !isEmbed && <LoadingOverlay />}
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login/*" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register/*" element={<Register />} />
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
