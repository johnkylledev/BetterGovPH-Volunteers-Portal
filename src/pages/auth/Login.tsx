import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useStore } from '../../store/useStore';
import { getSignInProviders, signInWithGithub, signInWithGoogle } from '../../services/supabase';
import { DISCORD_INVITE } from '../../components/site/links';

/** True once Supabase reports the GitHub provider as enabled. */
const useGithubSignIn = () => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    getSignInProviders().then((p) => { if (live) setEnabled(p.github === true); });
    return () => { live = false; };
  }, []);
  return enabled;
};

export default function Login() {
  const { authInitialized, sessionUserId } = useStore();
  const [loading, setLoading] = useState<'' | 'google' | 'github'>('');
  const [error, setError] = useState('');
  const githubEnabled = useGithubSignIn();

  if (!authInitialized) return <LoadingOverlay />;

  const signIn = async (provider: 'google' | 'github') => {
    setError('');
    setLoading(provider);
    try {
      const redirectTo = `${window.location.origin}/register`;
      if (provider === 'github') await signInWithGithub(redirectTo);
      else await signInWithGoogle(redirectTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in didn’t go through. Try again.');
      setLoading('');
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
            Use the Google or GitHub account you applied with to reach your member dashboard and Volunteer Card.
          </p>

          {error && (
            <p role="alert" className="mt-6 rounded-[10px] bg-red-50 px-3.5 py-3 text-[14px] text-red-800 shadow-[inset_0_0_0_1px_rgb(254_202_202)]">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={!!loading || !!sessionUserId}
            onClick={() => signIn('google')}
            className="s-btn s-btn-plain mt-8 h-11 w-full"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {loading === 'google' ? 'Redirecting to Google…' : 'Continue with Google'}
          </button>

          {githubEnabled && (
          <button
            type="button"
            disabled={!!loading || !!sessionUserId}
            onClick={() => signIn('github')}
            className="s-btn s-btn-plain mt-3 h-11 w-full"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 2.87-.39c.97 0 1.95.13 2.87.39 2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.8 1.18 1.83 1.18 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
            </svg>
            {loading === 'github' ? 'Redirecting to GitHub…' : 'Continue with GitHub'}
          </button>
          )}

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
