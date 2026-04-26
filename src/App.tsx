import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import UserDashboard from "./pages/dashboard/UserDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Verify from "./pages/public/Verify";
import { useStore } from "./store/useStore";
import { onAuthStateChange } from "./services/supabase";
import { LoadingOverlay } from "./components/LoadingOverlay";

export default function App() {
  const { updateCurrentUserFromSupabase } = useStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        await updateCurrentUserFromSupabase(user.uid || user.id);
      }
      useStore.getState().setAuthInitialized(true);
    });

    return () => unsubscribe();
  }, [updateCurrentUserFromSupabase]);

  const { authInitialized } = useStore();

  return (
    <>
      {!authInitialized && <LoadingOverlay />}
      <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/verify/:id" element={<Verify />} />
      </Routes>
    </Router>
    </>
  );
}
