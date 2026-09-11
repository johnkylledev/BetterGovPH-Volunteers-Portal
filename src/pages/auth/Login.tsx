import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowRight, Shield, Users, Code, AlertCircle, Zap } from 'lucide-react';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useStore } from '../../store/useStore';
import { signInWithGoogle } from '../../services/supabase';

const DISCORD_INVITE = "https://discord.com/invite/mHtThpN8bT";

export default function Login() {
  const { authInitialized, sessionUserId } = useStore();
  const setSessionUserId = useStore((s: any) => s.setSessionUserId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  if (!authInitialized) return <LoadingOverlay />;
  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-blue-900/15 relative">
      <div className="hidden lg:block absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-slate-50 border-l border-slate-100" />
        <div className="absolute top-[32%] right-[8%] w-[380px] h-[380px] rounded-[6px] bg-blue-900/[0.03] -rotate-6" />
        <div className="absolute bottom-[12%] right-[16%] w-[280px] h-[280px] rounded-[6px] bg-blue-900/[0.04] rotate-3" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        <div className="w-full flex items-center justify-between px-4 sm:px-5 lg:px-6 py-4 sm:py-5 max-w-7xl mx-auto">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-500 hover:text-blue-900 transition-colors text-xs sm:text-sm font-semibold group"
          >
            <Home size={13} className="sm:hidden" />
            <Home size={14} className="hidden sm:inline-flex group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to home</span>
          </Link>
        </div>

        <div className="flex-1 flex items-center w-full px-4 sm:px-5 lg:px-6 py-8 sm:py-10 max-w-7xl mx-auto">
          <div className="w-full grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="hidden lg:flex flex-col gap-8 sm:gap-10"
            >
              <div className="flex items-center gap-3">
                <img
                  src="https://assets.bettergov.ph/logos/webp/icon-primary.webp"
                  alt="BetterGovPH"
                  className="w-11 h-11 object-contain drop-shadow-[0_6px_18px_rgba(30,58,138,0.12)]"
                />
                <div className="flex flex-col leading-none">
                  <span className="text-base font-bold text-slate-900 font-display">BetterGovPH</span>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-blue-900 font-semibold mt-1">Volunteers</span>
                </div>
              </div>

              <div>
                <h1 className="text-4xl xl:text-5xl font-display font-bold text-slate-900 leading-[1.05] tracking-tight mb-5">
                  Build civic tech
                  <span className="block text-blue-900 mt-1.5">for the Philippines.</span>
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                  Sign in to join our community of volunteers, designers, and civic builders building better government services — together.
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4 max-w-lg">
                <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-[6px] bg-white border border-slate-200 transition-[transform,box-shadow,border-color] duration-300 ease-out [@media(hover:hover){&:hover}]:border-blue-200 [@media(hover:hover){&:hover}]:shadow-[0_10px_28px_-16px_rgba(30,58,138,0.25)] [@media(hover:hover){&:hover}]:-translate-y-0.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[6px] bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-900">
                    <Users size={16} className="sm:hidden" />
                    <Users size={18} className="hidden sm:inline-flex" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 mb-1 leading-tight">Community-first</h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">Collaborate with talented Filipino volunteers on open-source civic projects.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-[6px] bg-white border border-slate-200 transition-[transform,box-shadow,border-color] duration-300 ease-out [@media(hover:hover){&:hover}]:border-blue-200 [@media(hover:hover){&:hover}]:shadow-[0_10px_28px_-16px_rgba(30,58,138,0.25)] [@media(hover:hover){&:hover}]:-translate-y-0.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[6px] bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-900">
                    <Code size={16} className="sm:hidden" />
                    <Code size={18} className="hidden sm:inline-flex" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 mb-1 leading-tight">Real impact</h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">Contribute code that ships to real Filipinos — budgets, transparency, services.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-[6px] bg-white border border-slate-200 transition-[transform,box-shadow,border-color] duration-300 ease-out [@media(hover:hover){&:hover}]:border-blue-200 [@media(hover:hover){&:hover}]:shadow-[0_10px_28px_-16px_rgba(30,58,138,0.25)] [@media(hover:hover){&:hover}]:-translate-y-0.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[6px] bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-900">
                    <Shield size={16} className="sm:hidden" />
                    <Shield size={18} className="hidden sm:inline-flex" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 mb-1 leading-tight">Verified access</h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">Build a verified profile. Unlock roles, resources, and community perks.</p>
                  </div>
                </div>
              </div>

            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="w-full"
            >
              <div className="lg:hidden flex flex-col items-center gap-4 mb-6 sm:mb-8">
                <img
                  src="https://assets.bettergov.ph/logos/webp/icon-primary.webp"
                  alt="BetterGovPH"
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-[0_6px_18px_rgba(30,58,138,0.12)]"
                />
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 leading-[1.1] tracking-tight">
                    Welcome back.
                  </h1>
                  <p className="mt-2 text-xs sm:text-sm text-slate-500">Sign in to your volunteer portal</p>
                </div>
              </div>

              <div className="bg-white rounded-[6px] border border-slate-200 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.12)] p-5 sm:p-7 lg:p-8">
                <div className="hidden lg:flex flex flex-col items-center mb-7 sm:mb-8">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 mb-5 sm:mb-6">
                    <img
                      src="https://assets.bettergov.ph/logos/webp/icon-primary.webp"
                      alt="BetterGovPH Logo"
                      className="w-full h-full object-contain drop-shadow-[0_6px_18px_rgba(30,58,138,0.12)]"
                    />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 text-center leading-[1.1] tracking-tight">
                    Sign in
                  </h2>
                  <p className="mt-2 text-center text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Access your verified volunteer account
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    className="mb-5 sm:mb-6 rounded-[6px] border border-red-100 bg-red-50 px-3.5 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-medium text-red-700 flex items-start gap-2.5 sm:gap-3"
                  >
                    <AlertCircle size={15} className="sm:hidden shrink-0 mt-0.5" />
                    <AlertCircle size={16} className="hidden sm:inline-flex shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{error}</span>
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
                  className="group relative flex w-full items-center justify-center gap-2.5 sm:gap-3 rounded-[6px] bg-slate-900 px-4 sm:px-6 py-3 sm:py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_-14px_rgba(15,23,42,0.5)] [@media(hover:hover){&:hover}]:bg-slate-800 [@media(hover:hover){&:hover}]:shadow-[0_14px_30px_-14px_rgba(15,23,42,0.55)] focus:outline-none focus:ring-4 focus:ring-slate-900/15 transition-[transform,box-shadow,background-color] duration-200 ease-out active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg className="w-4.5 h-4.5 sm:w-5 sm:h-5 relative z-10 shrink-0" viewBox="0 0 24 24" width="20" height="20">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="whitespace-nowrap">{loading ? 'Connecting...' : 'Continue with Google'}</span>
                  {!loading && (
                    <ArrowRight size={14} className="sm:hidden group-hover:translate-x-0.5 transition-transform" />
                  )}
                  {!loading && (
                    <ArrowRight size={15} className="hidden sm:inline-flex group-hover:translate-x-0.5 transition-transform" />
                  )}
                </button>

                <div className="mt-5 sm:mt-6 flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 shrink-0">Or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <a
                  href={DISCORD_INVITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 sm:mt-6 group relative flex w-full items-center justify-center gap-2.5 sm:gap-3 rounded-[6px] border border-slate-200 bg-white px-4 sm:px-6 py-3 sm:py-3.5 text-sm font-bold text-slate-700 [@media(hover:hover){&:hover}]:border-slate-300 [@media(hover:hover){&:hover}]:bg-slate-50 transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out active:scale-[0.98]"
                >
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] sm:w-5 sm:h-5 shrink-0 text-[#5865F2]" fill="currentColor" aria-hidden="true">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  <span className="whitespace-nowrap">Join our Discord</span>
                </a>

                <div className="mt-6 sm:mt-7 text-center">
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                    By signing in, you agree to our{' '}
                    <Link to="/terms" className="font-semibold text-slate-700 hover:text-blue-900 transition-colors underline underline-offset-2 decoration-slate-300 hover:decoration-blue-900/50">
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="font-semibold text-slate-700 hover:text-blue-900 transition-colors underline underline-offset-2 decoration-slate-300 hover:decoration-blue-900/50">
                      Privacy Policy
                    </Link>.
                  </p>
                </div>
              </div>

              <div className="mt-5 sm:mt-6 text-center lg:hidden">
                <p className="text-xs sm:text-sm text-slate-600">
                  New to BetterGovPH?{' '}
                  <Link to="/register" className="font-bold text-blue-900 hover:text-blue-800 transition-colors inline-flex items-center gap-0.5 group">
                    Create an account
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="w-full px-4 sm:px-5 lg:px-6 py-4 sm:py-5 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] sm:text-xs text-slate-400 font-semibold">
          <span>© {new Date().getFullYear()} BetterGovPH. Open source, civic-first.</span>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">Discord</a>
          </div>
        </div>
      </div>
    </div>
  );
}
