import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowRight, Shield, Users, Code } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-blue-900/20 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" style={{ backgroundSize: '30px 30px', backgroundImage: 'linear-gradient(to right, rgb(226 232 240 / 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgb(226 232 240 / 0.3) 1px, transparent 1px)' }}></div>
      
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-600 hover:text-blue-900 transition-colors text-sm font-semibold group"
      >
        <Home className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span>Home</span>
      </Link>

      <div className="sm:mx-auto sm:w-full sm:max-w-5xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:flex flex-col gap-8"
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-900 text-xs font-semibold mb-6">
                <Shield className="w-3.5 h-3.5" />
                Secure Portal Access
              </div>
              <h1 className="text-4xl xl:text-5xl font-bold text-slate-900 leading-tight mb-4">
                Welcome to<br />
                <span className="text-blue-900">BetterGovPH</span>
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed">
                Join our community of developers building better government services for the Philippines.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-white/60 backdrop-blur border border-slate-200/60">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-blue-900" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Collaborate</h3>
                  <p className="text-sm text-slate-600">Work with talented developers on impactful projects</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-white/60 backdrop-blur border border-slate-200/60">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Code className="w-5 h-5 text-blue-900" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Build & Learn</h3>
                  <p className="text-sm text-slate-600">Contribute to open-source civic tech initiatives</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full"
          >
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-8 sm:p-10">
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 flex items-center justify-center mb-4 rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 shadow-lg shadow-blue-900/20">
                  <img src="/logo.svg" alt="BetterGovPH Logo" className="w-10 h-10 object-contain brightness-0 invert" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">
                  Sign In
                </h2>
                <p className="mt-2 text-center text-sm text-slate-500">
                  Access your developer portal
                </p>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-700 flex items-start gap-3"
                >
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </motion.div>
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
                className="group relative flex w-full items-center justify-center gap-3 rounded-xl bg-blue-900 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-900/25 hover:bg-blue-800 hover:shadow-xl hover:shadow-blue-900/30 focus:outline-none focus:ring-4 focus:ring-blue-900/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-800/0 via-blue-700/50 to-blue-800/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="relative z-10">{loading ? 'Connecting...' : 'Continue with Google'}</span>
                {!loading && <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />}
              </button>

              <div className="mt-6 text-center">
                <p className="text-xs text-slate-500">
                  By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </div>

            <div className="mt-6 text-center lg:hidden">
              <p className="text-sm text-slate-600">
                New to BetterGovPH?{' '}
                <Link to="/register" className="font-semibold text-blue-900 hover:text-blue-800 transition-colors">
                  Create an account
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
