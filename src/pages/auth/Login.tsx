import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useStore } from '../../store/useStore';
import { signInWithGoogle } from '../../services/supabase';
import { DISCORD_INVITE } from '../../components/site/links';

export default function Login() {
  const { authInitialized, sessionUserId } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!authInitialized) return <LoadingOverlay />;

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle(`${window.location.origin}/register`);
    } catch (e: any) {
      setError(e?.message || 'Google sign-in didn’t go through. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="site flex min-h-screen flex-col">
      <header className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="group inline-flex items-center gap-1.5 text-[14px] text-[var(--fg-3)] hover:text-[var(--fg)]">
          <ArrowLeft size={16} strokeWidth={1.75} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
          Home
        </Link>
        <Link to="/register" className="text-[14px] text-[var(--fg-3)] hover:text-[var(--fg)]">
          New here? <span className="font-medium text-[var(--fg)]">Apply</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-[380px]"
        >
          <img
            src="/logo.svg"
            onError={(e) => { const t = e.currentTarget; t.onerror = null; t.src = 'https://assets.bettergov.ph/logos/webp/icon-primary.webp'; }}
            alt="BetterGovPH"
            className="h-10 w-10 object-contain"
          />
          <h1 className="mt-6 text-[28px]">Sign in</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--fg-2)]">
            Use the Google account you applied with to reach your member dashboard and Volunteer Card.
          </p>

          {error && (
            <p role="alert" className="mt-6 rounded-[10px] bg-red-50 px-3.5 py-3 text-[14px] text-red-800 shadow-[inset_0_0_0_1px_rgb(254_202_202)]">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={loading || !!sessionUserId}
            onClick={handleGoogle}
            className="s-btn s-btn-plain mt-8 h-11 w-full"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {loading ? 'Redirecting to Google…' : 'Continue with Google'}
          </button>

          <p className="mt-4 text-[13px] leading-relaxed text-[var(--fg-3)]">
            By continuing you agree to the <Link to="/terms" className="s-link">Terms</Link> and{' '}
            <Link to="/privacy" className="s-link">Privacy policy</Link>.
          </p>

          <div className="mt-10 border-t border-[var(--line)] pt-6 text-[14px] leading-relaxed text-[var(--fg-2)]">
            Not a member yet? <Link to="/register" className="s-link">Apply for membership</Link>, or{' '}
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="s-link">
              say hello on Discord
            </a>{' '}
            first.
          </div>
        </motion.div>
      </main>
    </div>
  );
}
