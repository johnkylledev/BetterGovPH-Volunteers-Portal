import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useStore } from '../../store/useStore';
import { signInWithGoogle } from '../../services/supabase';

export default function Login() {
  const { authInitialized, sessionUserId } = useStore();
  const setSessionUserId = useStore((s: any) => s.setSessionUserId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  if (!authInitialized) return <LoadingOverlay />;
  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-blue-900/20 relative">
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-blue-900 transition-colors text-sm font-semibold group"
      >
        <Home className="w-4 h-4" />
        <span>Home</span>
      </Link>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center"
      >
        <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center mb-4 sm:mb-6">
          <img src="/logo.svg" alt="BetterGovPH Logo" className="w-full h-full object-contain" />
        </div>
        <h2 className="mt-2 text-center text-xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display leading-tight sm:leading-normal flex flex-col">
          <span>BetterGovPH</span>
          <span className="text-blue-900/80">Dev Community</span>
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          Sign in to access your portal
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="py-2 px-0">
          {error && (
            <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}
          <button
            type="button"
            disabled={loading || !!sessionUserId}
            onClick={async () => {
              setError('');
              setLoading(true);
              try {
                await signInWithGoogle(`${window.location.origin}/register`);
              } catch (e: any) {
                setError(e?.message || 'Failed to sign in with Google');
                setLoading(false);
              }
            }}
            className="flex w-full justify-center rounded-lg bg-blue-900 px-4 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? 'Redirecting...' : 'Continue with Google'}
          </button>
        </div>
      </motion.div>
    </div>

  );
}
