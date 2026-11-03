import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Copy, Code, Check, Search, Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getUserByMemberIdOrId } from '../../services/supabase';
import { AccessCard } from '../../components/AccessCard';
import { SiteLayout } from '../../components/site/SiteLayout';
import { DISCORD_INVITE } from '../../components/site/links';

export default function Verify() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const users = useStore((state) => state.users);
  const [userData, setUserData] = useState<any | null>(() => {
    if (!id) return null;
    const upperId = id.toUpperCase();
    return users.find((u) => u.memberId?.toUpperCase() === upperId || u.id === id) || null;
  });
  const [loading, setLoading] = useState(!userData && !!id);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'embed-copied'>('idle');
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const isEmbed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';
  const cardRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Each time a record arrives, show a short registry check before the verdict.
  useEffect(() => {
    if (loading || !userData) return;
    setCheckedAt(Date.now());
    if (reduceMotion) return;
    setChecking(true);
    const t = setTimeout(() => setChecking(false), 750);
    return () => clearTimeout(t);
  }, [loading, userData, reduceMotion]);

  // Keeps the "checked … ago" label honest while the page stays open.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const checkedAgo = (() => {
    if (checkedAt == null) return '';
    const sec = Math.max(0, Math.round((now - checkedAt) / 1000));
    if (sec < 10) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    return `${Math.floor(sec / 60)} min ago`;
  })();

  const recheck = async () => {
    if (!id || rechecking) return;
    setRechecking(true);
    try {
      const fresh = await getUserByMemberIdOrId(id);
      if (fresh) setUserData(fresh);
      setCheckedAt(Date.now());
      setNow(Date.now());
    } catch {
      setCheckedAt(Date.now());
    } finally {
      setRechecking(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      if (!id) {
        setUserData(null);
        setLoading(false);
        return;
      }
      const upperId = id.toUpperCase();
      const localUser = users.find((u) => u.memberId?.toUpperCase() === upperId || u.id === id);
      if (localUser) {
        setUserData(localUser);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const remoteUser = await getUserByMemberIdOrId(id);
        setUserData(remoteUser);
      } catch {
        setUserData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id, users]);

  const performSearchNow = async (term = searchId) => {
    const cleanTerm = term.trim();
    if (!cleanTerm || cleanTerm.length < 3) {
      setSearchResult(null);
      return;
    }
    setIsSearching(true);
    try {
      const result = await getUserByMemberIdOrId(cleanTerm);
      setSearchResult(result);
    } catch {
      setSearchResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      performSearchNow(searchId);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchId]);

  const publicUrl = typeof window !== 'undefined' && userData?.memberId
    ? `${window.location.origin}/verify/${userData.memberId}`
    : '';

  const statusLower = (userData?.status || '').toLowerCase();
  const isValid = userData && (statusLower === 'approved' || userData.isAdmin);
  const isPending = userData && statusLower === 'pending' && !userData.isAdmin;
  const isDeclined = userData && statusLower === 'declined' && !userData.isAdmin;

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {}
  };

  const handleCopyEmbed = async () => {
    if (!publicUrl) return;
    try {
      const embedCode = `<iframe src="${publicUrl}?embed=true" width="320" height="480" frameborder="0"></iframe>`;
      await navigator.clipboard.writeText(embedCode);
      setCopyStatus('embed-copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {}
  };

  if (isEmbed) {
    return (
      <div className={clsx(
        "h-screen w-full overflow-hidden bg-transparent flex items-center justify-center font-sans p-2 sm:p-4",
      )}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className={clsx(
            "w-full flex flex-col items-center justify-center",
            !isValid && "opacity-50 grayscale blur-[1px] pointer-events-none"
          )}
        >
          <div ref={cardRef}>
            <AccessCard user={userData} />
          </div>
        </motion.div>
      </div>
    );
  }

  const status = isValid
    ? { dot: 'bg-emerald-500', word: 'Verified member', title: userData?.fullName || 'Verified member', copy: 'This card is active and matches a record in the BetterGovPH membership registry.' }
    : isPending
      ? { dot: 'bg-amber-500', word: 'Under review', title: 'Not active yet', copy: 'This application is still being reviewed. It isn’t a valid membership until it’s approved.' }
      : { dot: 'bg-red-500', word: 'Not valid', title: 'This card isn’t valid', copy: 'This card has been declined or revoked. If you think that’s a mistake, ask the team on Discord.' };

  const showRecord = !!id && (isValid || isPending || isDeclined);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-14 pb-20 sm:pt-20">
        {loading ? (
          <div className="grid items-center gap-12 md:grid-cols-[1fr_auto]" aria-busy="true">
            <div>
              <div className="h-3 w-28 rounded bg-slate-200/70" />
              <div className="mt-5 h-9 w-64 rounded bg-slate-200/70" />
              <div className="mt-4 h-3 w-80 max-w-full rounded bg-slate-200/70" />
            </div>
            <div className="mx-auto aspect-[1/1.5] w-[300px] rounded-[14px] bg-slate-200/70" />
            <p className="sr-only">Checking the registry…</p>
          </div>
        ) : showRecord ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="grid items-center gap-12 md:grid-cols-[1fr_auto] md:gap-16"
          >
            <div className="order-2 md:order-1">
              <div className="h-5" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  {checking ? (
                    <motion.p
                      key="checking"
                      initial={{ opacity: 0, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, filter: 'blur(4px)' }}
                      transition={{ duration: 0.18 }}
                      className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--fg-3)]"
                    >
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      Checking the registry…
                    </motion.p>
                  ) : (
                    <motion.p
                      key="verdict"
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, filter: 'blur(0px)' }}
                      transition={{ duration: 0.22 }}
                      className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--fg-2)]"
                    >
                      {isValid ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-emerald-600">
                          <motion.circle
                            cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"
                            initial={{ pathLength: reduceMotion ? 1 : 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                          />
                          <motion.path
                            d="M5 8.2 7.1 10.3 11 6"
                            fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                            initial={{ pathLength: reduceMotion ? 1 : 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.3, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
                          />
                        </svg>
                      ) : (
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
                      )}
                      {status.word}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <motion.h1
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={checking ? { opacity: 0.25, y: 0 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="mt-3 text-[32px] sm:text-[40px]"
              >
                {status.title}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: checking ? 0.25 : 1 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="mt-3 max-w-md text-[16px] leading-relaxed text-[var(--fg-2)]"
              >
                {status.copy}
              </motion.p>

              {userData?.memberId && (
                <dl className="mt-8 max-w-md border-t border-[var(--line)] text-[14px]">
                  {[
                    { label: 'Member ID', value: <span className="num font-mono text-[13px]">{userData.memberId}</span> },
                    ...(userData.specialization ? [{ label: 'Role', value: userData.specialization }] : []),
                    ...(userData.yearJoined ? [{ label: 'Member since', value: <span className="num">{userData.yearJoined}</span> }] : []),
                  ].map((row, i) => (
                    <motion.div
                      key={row.label}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
                      animate={checking ? { opacity: 0 } : { opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, delay: checking ? 0 : 0.1 + i * 0.06, ease: [0.23, 1, 0.32, 1] }}
                      className="flex items-baseline justify-between gap-6 border-b border-[var(--line)] py-3"
                    >
                      <dt className="text-[var(--fg-3)]">{row.label}</dt>
                      <dd className="text-right">{row.value}</dd>
                    </motion.div>
                  ))}
                </dl>
              )}

              <p className="mt-4 flex items-center gap-2 text-[13px] text-[var(--fg-3)]">
                <span>
                  Checked against the registry <span className="num">{checking ? 'now' : checkedAgo}</span>
                </span>
                <span className="text-slate-300" aria-hidden>·</span>
                <button
                  type="button"
                  onClick={recheck}
                  disabled={rechecking || checking}
                  className="s-link disabled:opacity-50"
                >
                  {rechecking ? 'Checking…' : 'Check again'}
                </button>
              </p>

              <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
                {isValid ? (
                  <>
                    <button onClick={handleCopyLink} className="s-btn s-btn-plain min-w-[150px]">
                      {copyStatus === 'copied' ? <Check size={16} strokeWidth={1.75} /> : <Copy size={16} strokeWidth={1.75} />}
                      {copyStatus === 'copied' ? 'Link copied' : 'Copy link'}
                    </button>
                    <button onClick={handleCopyEmbed} className="s-btn s-btn-plain min-w-[170px]">
                      {copyStatus === 'embed-copied' ? <Check size={16} strokeWidth={1.75} /> : <Code size={16} strokeWidth={1.75} />}
                      {copyStatus === 'embed-copied' ? 'Embed copied' : 'Copy embed code'}
                    </button>
                  </>
                ) : (
                  <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="s-btn s-btn-plain">
                    Ask on Discord
                  </a>
                )}
                <button
                  onClick={() => {
                    setUserData(null);
                    navigate('/verify');
                  }}
                  className="s-btn text-[var(--fg-2)] hover:text-[var(--fg)]"
                >
                  <Search size={16} strokeWidth={1.75} />
                  Check another ID
                </button>
              </div>
            </div>

            <div className="order-1 mx-auto md:order-2" style={{ perspective: '1200px' }}>
              <motion.div
                ref={cardRef}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: -18, y: 16 }}
                animate={{ opacity: 1, rotateY: 0, y: 0 }}
                transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                className={clsx(!isValid && 'opacity-50 grayscale pointer-events-none')}
              >
                <AccessCard user={userData} />
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <div className="mx-auto max-w-xl">
            <h1 className="text-[32px] sm:text-[40px]">{id ? 'No record for this card' : 'Check a member card'}</h1>
            <p className="mt-3 text-[16px] leading-relaxed text-[var(--fg-2)]">
              {id ? (
                <>
                  We couldn’t find <span className="font-mono text-[14px] text-[var(--fg)]">{id}</span> in the membership registry. It may be mistyped, pending, or not a real card.
                </>
              ) : (
                'Enter the Member ID printed on the card. We’ll look it up in the official registry.'
              )}
            </p>

            <form onSubmit={(e) => { e.preventDefault(); performSearchNow(); }} className="mt-8">
              <label htmlFor="member-id" className="text-[13px] font-medium">Member ID</label>
              <div className="relative mt-2">
                <input
                  id="member-id"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="BGPH-2026-001"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value.toUpperCase())}
                  className="s-field h-11 pr-10 font-mono text-[14px] tracking-wide"
                />
                {isSearching && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" aria-label="Searching" />
                )}
              </div>

              <div className="mt-4 min-h-[76px]" aria-live="polite">
                {searchResult ? (
                  <div className="s-card flex items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="inline-flex items-center gap-2 text-[12px] font-medium text-[var(--fg-3)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                        Record found
                      </p>
                      <p className="mt-0.5 truncate text-[15px] font-semibold">{searchResult.fullName}</p>
                      <p className="truncate font-mono text-[12px] text-[var(--fg-3)]">{searchResult.memberId}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/verify/${searchResult.memberId}`)}
                      className="s-btn s-btn-accent h-9 shrink-0 px-3.5"
                    >
                      View card
                      <ArrowRight size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                ) : searchId.trim().length >= 3 && !isSearching ? (
                  <p className="text-[14px] text-[var(--fg-2)]">
                    <span className="font-medium text-[var(--fg)]">No member with that ID.</span> Check the format — it looks like BGPH-2026-001.
                  </p>
                ) : null}
              </div>
            </form>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
