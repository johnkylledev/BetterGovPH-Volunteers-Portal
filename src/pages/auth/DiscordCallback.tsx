import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ExternalLink, Link2 } from 'lucide-react';
import { syncDiscord } from '../../services/supabase';

const CANONICAL = 'https://volunteers.bettergov.ph/discord-callback';
const KNOWN_STALE = /(^|\.)better-gov-ph-access-card-development\.vercel\.app$/i;

// Pages that start a Discord connect can ask to be returned to (allowlist only).
const RETURN_TO_ALLOWED = new Set(['/profile']);
const peekReturnTo = (): string => {
  try {
    const v = sessionStorage.getItem('discord_return_to');
    return v && RETURN_TO_ALLOWED.has(v) ? v : '/register';
  } catch { return '/register'; }
};
const takeReturnTo = (): string => {
  const v = peekReturnTo();
  try { sessionStorage.removeItem('discord_return_to'); } catch { /* noop */ }
  return v;
};

export default function DiscordCallback() {
  const navigate = useNavigate();
  const [returnPath] = useState(peekReturnTo);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bouncing, setBouncing] = useState<null | string>(null);

  useEffect(() => {
    const envTarget = String(import.meta.env.VITE_DISCORD_CALLBACK_URL || '').trim();
    const target = envTarget || CANONICAL;
    if (!target || typeof window === 'undefined') return;
    try {
      const want = new URL(target);
      const sameOrigin = !!want.origin && want.origin === window.location.origin;
      const staleHost = KNOWN_STALE.test(window.location.hostname);
      if (sameOrigin && !staleHost) return;
      const here = new URL(window.location.href);
      const next = new URL(want.origin + want.pathname);
      Array.from(here.searchParams.entries()).forEach(([k, v]) => next.searchParams.append(k, v));
      next.hash = here.hash;
      const showTimer = window.setTimeout(() => setBouncing(next.toString()), 200);
      const navTimer = window.setTimeout(() => window.location.replace(next.toString()), 280);
      return () => { window.clearTimeout(showTimer); window.clearTimeout(navTimer); };
    } catch { return; }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (error) {
      const messages: Record<string, string> = {
        oauth_denied: 'You cancelled the Discord authorization.',
        missing_params: 'Invalid callback URL.',
        invalid_state: 'Authorization expired. Please try again.',
        token_exchange_failed: 'Discord rejected the authorization.',
        user_fetch_failed: 'Could not fetch your Discord profile.',
        guild_check_failed: 'Could not verify guild membership.',
      };
      const msg = messages[error] ?? 'Discord connection failed.';
      try { sessionStorage.setItem('discord_connect_error', msg); } catch { /* noop */ }
      setErrorMsg(msg);
      return;
    }

    const discordId = params.get('discord_id') ?? undefined;
    const discordUsername = params.get('discord_username') ?? undefined;
    const discordDisplayName = params.get('discord_display_name') ?? undefined;
    const discordAvatar = params.get('discord_avatar') ?? undefined;
    const proof = { ts: params.get('ts') ?? undefined, sig: params.get('sig') ?? undefined };

    let cancelled = false;
    (async () => {
      try {
        await syncDiscord(discordId, discordUsername, discordDisplayName, discordAvatar, proof);
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : typeof e?.message === 'string' ? e.message : 'Discord sync failed. Please try again.';
        if (!cancelled) {
          try { sessionStorage.setItem('discord_connect_error', msg); } catch { /* noop */ }
          setErrorMsg(msg);
        }
        return;
      }
      if (!cancelled) {
        try { sessionStorage.removeItem('discord_connect_error'); } catch { /* noop */ }
        navigate(takeReturnTo());
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md w-full">
        {errorMsg ? (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 text-red-500 mb-2">
              <AlertCircle size={28} />
            </div>
            <p className="text-sm font-bold text-slate-800">Discord connection failed</p>
            <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-100 rounded-[6px] px-4 py-3 leading-relaxed">
              {errorMsg}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate(takeReturnTo())}
                className="inline-flex items-center gap-2 rounded-[6px] bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_-14px_rgba(15,23,42,0.5)] hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/12 transition-colors active:scale-[0.98]"
              >
                <ArrowLeft size={15} />
                {returnPath === '/profile' ? 'Back to profile' : 'Back to registration'}
              </button>
            </div>
          </>
        ) : bouncing ? (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 text-blue-900 mb-2">
              <ExternalLink size={24} strokeWidth={1.75} />
            </div>
            <p className="text-sm font-bold text-slate-800">Redirecting…</p>
            <p className="text-xs text-slate-500">
              Finishing Discord connection on <span className="inline-flex items-center gap-1 font-semibold text-slate-700">{new URL(bouncing).hostname}<ExternalLink size={11} /></span>
            </p>
          </>
        ) : (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#5865F2]/10 text-[#5865F2]"><Link2 size={24} strokeWidth={1.75} /></span>
            <p className="text-sm font-semibold text-slate-700">Connecting your Discord…</p>
          </>
        )}
      </div>
    </div>
  );
}
