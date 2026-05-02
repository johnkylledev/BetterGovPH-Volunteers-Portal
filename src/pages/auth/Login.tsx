import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { Show, SignIn, SignUp, UserButton } from '@clerk/react';

export default function Login() {
  const [tab, setTab] = React.useState<'sign-in' | 'sign-up'>(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    return hash.toLowerCase().includes('sign-up') ? 'sign-up' : 'sign-in';
  });

  React.useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash;
      setTab(hash.toLowerCase().includes('sign-up') ? 'sign-up' : 'sign-in');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-blue-900/20 relative">
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
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-lg sm:px-10 border sm:border-slate-100">
          <Show when="signed-out">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = 'sign-in';
                    setTab('sign-in');
                  }}
                  className={
                    tab === 'sign-in'
                      ? 'rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm'
                      : 'rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900'
                  }
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = 'sign-up';
                    setTab('sign-up');
                  }}
                  className={
                    tab === 'sign-up'
                      ? 'rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm'
                      : 'rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900'
                  }
                >
                  Create account
                </button>
              </div>

              <div className="flex justify-center">
                {tab === 'sign-in' ? (
                  <SignIn
                    routing="hash"
                    fallbackRedirectUrl="/dashboard"
                    signUpUrl="/login#sign-up"
                    signUpFallbackRedirectUrl="/register"
                  />
                ) : (
                  <SignUp
                    routing="hash"
                    fallbackRedirectUrl="/register"
                    signInUrl="/login#sign-in"
                    signInFallbackRedirectUrl="/dashboard"
                  />
                )}
              </div>
            </div>
          </Show>

          <Show when="signed-in">
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <UserButton />
              </div>
              <Link
                to="/dashboard"
                className="flex w-full justify-center rounded-lg bg-blue-900 px-4 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-900/20 transition-all active:scale-[0.98]"
              >
                Continue
              </Link>
            </div>
          </Show>
        </div>
      </motion.div>
    </div>

  );
}
