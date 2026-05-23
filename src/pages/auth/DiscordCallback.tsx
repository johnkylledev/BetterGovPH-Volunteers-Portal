import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { syncDiscord } from '../../services/supabase';

export default function DiscordCallback() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      setErrorMsg(messages[error] ?? 'Discord connection failed.');
      const timer = setTimeout(() => navigate('/register'), 2500);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    (async () => {
      try {
        await syncDiscord();
      } catch {
        // ignore sync errors — still return to step 4
      }
      if (!cancelled) {
        navigate('/register');
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        {errorMsg ? (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 text-red-500 mb-2">
              <AlertCircle size={28} />
            </div>
            <p className="text-sm font-semibold text-slate-700">{errorMsg}</p>
            <p className="text-xs text-slate-400">Redirecting you back...</p>
          </>
        ) : (
          <>
            <Loader2 size={32} className="animate-spin text-blue-900 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Connecting your Discord...</p>
          </>
        )}
      </div>
    </div>
  );
}
