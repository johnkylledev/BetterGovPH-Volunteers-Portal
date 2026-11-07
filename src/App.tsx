import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import { useStore } from "./store/useStore";
import { hasAdminAccess } from "./utils/adminAccess";
import { peekReturnTo, takeReturnTo } from "./utils/returnTo";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { getUserData, supabase, resetSupabaseClient } from "./services/supabase";
import Landing from "./pages/public/Landing";

// Everything except the landing page loads on demand, so first visits don't pay for the dashboards.
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const UserDashboard = lazy(() => import("./pages/dashboard/UserDashboard"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const Profile = lazy(() => import("./pages/dashboard/Profile"));
const Verify = lazy(() => import("./pages/public/Verify"));
const Privacy = lazy(() => import("./pages/public/Privacy"));
const Terms = lazy(() => import("./pages/public/Terms"));
const Projects = lazy(() => import("./pages/public/Projects"));
const Volunteers = lazy(() => import("./pages/public/Volunteers"));
const ProjectDetail = lazy(() => import("./pages/public/ProjectDetail"));
const Opportunities = lazy(() => import("./pages/public/Opportunities"));
const CodeOfConduct = lazy(() => import("./pages/public/CodeOfConduct"));
const Certificate = lazy(() => import("./pages/dashboard/Certificate"));
const Contribute = lazy(() => import("./pages/public/Contribute"));
const NotFound = lazy(() => import("./pages/public/NotFound"));
const DiscordCallback = lazy(() => import("./pages/auth/DiscordCallback"));

const isProfileComplete = (u: any) => {
  if (!u) return false;
  const fullNameOk = typeof u.fullName === 'string' && u.fullName.trim().length > 0;
  const specializationOk = typeof u.specialization === 'string' && u.specialization.trim().length > 0;
  const yearOk = typeof u.yearJoined === 'number' && Number.isFinite(u.yearJoined);
  // Registration ends at step 4 (Data Privacy Act consent). Discord is optional for now.
  const consentOk = typeof u.consentAt === 'string' && u.consentAt.length > 0;
  return fullNameOk && specializationOk && yearOk && consentOk;
};

function GatedRedirect({ to, forceReplace = false }: { to: string, forceReplace?: boolean }) {
  const location = useLocation();
  const alreadyRedirectedFromHere = (location.state as any)?.from === to;
  // Loop guard: rather than a blank page, offer a way forward.
  if (alreadyRedirectedFromHere) {
    return (
      <div className="site flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[15px] text-slate-600">Taking you to the right page…</p>
          <a href={to} className="s-btn s-btn-accent mt-4">Continue</a>
        </div>
      </div>
    );
  }
  return <Navigate to={to} state={{ from: location.pathname }} replace={forceReplace} />;
}

/** Clears the saved return path once we've arrived there (e.g. back on the call after signing in). */
function ReturnToCleaner() {
  const location = useLocation();
  useEffect(() => {
    const want = peekReturnTo();
    if (want && want === location.pathname + location.search) takeReturnTo();
  }, [location.pathname, location.search]);
  return null;
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { currentUser, authInitialized } = useStore();
  const { sessionUserId } = useStore();

  if (!authInitialized) return <LoadingOverlay />;
  if (!sessionUserId) return <GatedRedirect to="/login" forceReplace />;
  if (!currentUser) return <LoadingOverlay />;
  if (adminOnly && !hasAdminAccess(currentUser)) return <GatedRedirect to="/dashboard" />;
  if (!adminOnly && !currentUser?.isAdmin && !isProfileComplete(currentUser)) return <GatedRedirect to="/register" />;

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, authInitialized } = useStore();
  const { sessionUserId } = useStore();
  const location = useLocation();

  if (!authInitialized) return <LoadingOverlay />;
  if (sessionUserId) {
    if (!currentUser) {
      if (location.pathname === "/login") return <GatedRedirect to="/register" forceReplace />;
      return <LoadingOverlay />;
    }
    if (currentUser?.isAdmin) return <GatedRedirect to="/admin" />;
    return <GatedRedirect to={isProfileComplete(currentUser) ? peekReturnTo() || "/dashboard" : "/register"} />;
  }

  return <>{children}</>;
}

function HomeRoute({ children }: { children: React.ReactNode }) {
  const { authInitialized } = useStore();

  // The home page is public for everyone, signed in or not. Signed-in people reach their
  // dashboard (or registration) from the navbar's Dashboard button.
  if (!authInitialized) return <LoadingOverlay />;
  return <>{children}</>;
}

function RegisterRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, authInitialized } = useStore();
  const { sessionUserId } = useStore();

  if (!authInitialized) return <LoadingOverlay />;
  if (sessionUserId && !currentUser) {
    return <>{children}</>;
  }
  if (sessionUserId && currentUser) {
    if (currentUser?.isAdmin) return <GatedRedirect to="/admin" />;
    if (isProfileComplete(currentUser)) return <GatedRedirect to={peekReturnTo() || "/dashboard"} />;
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
    let cancelled = false;
    let profileLoading = false;

    const initAuth = async () => {
      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (cancelled) return;

        const uid = session?.user?.id ?? null;
        setSessionUserId(uid);

        if (!uid) {
          setCurrentUser(null);
          setAuthInitialized(true);
          profileLoading = false;
          return;
        }

        setAuthInitialized(true);

        if (profileLoading || useStore.getState().currentUser) {
          return;
        }
        profileLoading = true;

        setTimeout(async () => {
          if (cancelled) return;

          try {
            const profile = await getUserData(uid);
            if (!cancelled && profile) {
              setCurrentUser(profile);
            }
          } catch {
            // Silent fail - profile will load on next navigation
          }
          profileLoading = false;
        }, 100);
      });

      return () => {
        cancelled = true;
        sub.subscription.unsubscribe();
      };
    };

    initAuth();

  }, [setCurrentUser, setAuthInitialized, setSessionUserId]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const currentSessionUserId = useStore.getState().sessionUserId;
        const currentAuthInitialized = useStore.getState().authInitialized;

        try {
          const { data } = await supabase.auth.getSession();
          const uid = data.session?.user?.id ?? null;

          if (uid) {
            setSessionUserId(uid);
            if (!currentAuthInitialized) {
              setAuthInitialized(true);
            }
            const profile = await getUserData(uid).catch(() => null);
            if (profile) {
              setCurrentUser(profile);
            }
          } else if (currentSessionUserId) {
            setSessionUserId(null);
            setCurrentUser(null);
            if (!currentAuthInitialized) {
              setAuthInitialized(true);
            }
          }
        } catch {
          if (currentSessionUserId) {
            setSessionUserId(null);
            setCurrentUser(null);
            if (!currentAuthInitialized) {
              setAuthInitialized(true);
            }
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const handleFocus = () => {
      if (document.hasFocus() && document.visibilityState === 'visible') {
        handleVisibilityChange();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [setCurrentUser, setSessionUserId, setAuthInitialized]);

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
          console.log('Real-time: Current user profile updated');
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

  const isEmbed = window.location.pathname.includes('/verify') && window.location.search.includes('embed=true');

  return (
    <>
      {!authInitialized && !isEmbed && <LoadingOverlay />}
      <Router>
        <Suspense fallback={<LoadingOverlay />}>
        <ReturnToCleaner />
        <Routes>
          <Route path="/" element={<HomeRoute><Landing /></HomeRoute>} />
          <Route path="/login/*" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register/*" element={<RegisterRoute><Register /></RegisterRoute>} />
          <Route path="/dashboard/:section?" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
          <Route path="/admin/:section?" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/certificate" element={<ProtectedRoute><Certificate /></ProtectedRoute>} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/verify/:id" element={<Verify />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/code-of-conduct" element={<CodeOfConduct />} />
          <Route path="/volunteers" element={<Volunteers />} />
          <Route path="/contribute" element={<Contribute />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/discord-callback" element={<DiscordCallback />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </Router>
    </>
  );
}
