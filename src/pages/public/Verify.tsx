import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { ShieldCheck, XCircle, Copy, Code, Check, Search, Loader2, Home, ArrowRight, BadgeCheck, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { getUserByMemberIdOrId } from '../../services/supabase';
import { AccessCard } from '../../components/AccessCard';

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
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const isEmbed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';
  const cardRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const performSearch = async () => {
      if (!searchId || searchId.length < 5) {
        setSearchResult(null);
        return;
      }
      setIsSearching(true);
      try {
        const result = await getUserByMemberIdOrId(searchId);
        setSearchResult(result);
      } catch {
        setSearchResult(null);
      } finally {
        setIsSearching(false);
      }
    };
    const timeout = setTimeout(performSearch, 400);
    return () => clearTimeout(timeout);
  }, [searchId]);

  const publicUrl = typeof window !== 'undefined' && userData?.memberId
    ? `${window.location.origin}/verify/${userData.memberId}`
    : '';

  const isValid = userData && (userData.status === 'Approved' || userData.isAdmin);
  const isPending = userData && userData.status === 'Pending' && !userData.isAdmin;
  const isDeclined = userData && userData.status === 'Declined' && !userData.isAdmin;

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

  const downloadCard = async () => {
    if (!cardRef.current || !userData) return;
    setDownloadLoading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `BetterGovPH_Card_${userData.memberId || userData.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
    } finally {
      setDownloadLoading(false);
    }
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

  const statusMeta = (() => {
    if (isValid) return {
      tone: 'emerald',
      label: 'Verified Member',
      eyebrow: 'Issued & Active',
      icon: BadgeCheck,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      iconBg: 'bg-emerald-900/10 text-emerald-700',
      copy: 'This record exists in the official BetterGovPH membership registry.',
    };
    if (isPending) return {
      tone: 'amber',
      label: 'Under Review',
      eyebrow: 'Pending',
      icon: Clock,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      iconBg: 'bg-amber-900/10 text-amber-700',
      copy: 'This application is being reviewed and is not yet an active membership.',
    };
    return {
      tone: 'red',
      label: 'Not Valid',
      eyebrow: 'Revoked',
      icon: XCircle,
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      iconBg: 'bg-red-900/10 text-red-700',
      copy: userData ? 'This access card has been declined or revoked.' : 'No official record exists for this ID.',
    };
  })();

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-900/15">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-5 lg:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 sm:gap-3"
          >
            <img
              src="https://assets.bettergov.ph/logos/webp/icon-primary.webp"
              alt="BetterGovPH"
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-[0_6px_18px_rgba(30,58,138,0.12)]"
            />
            <div className="flex flex-col leading-none">
              <span className="text-sm sm:text-base font-display font-bold text-slate-900">BetterGovPH</span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-blue-900 font-semibold mt-0.5">Verify</span>
            </div>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-slate-500 hover:text-blue-900 transition-colors group"
          >
            <Home size={13} className="sm:hidden group-hover:-translate-x-0.5 transition-transform" />
            <Home size={14} className="hidden sm:inline-flex group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-5 lg:px-6 py-8 sm:py-10 lg:py-14 flex flex-col items-center">
        {loading ? (
          <div className="py-16 sm:py-24 flex flex-col items-center">
            <div className="w-52 h-[2px] rounded-full bg-slate-200 overflow-hidden mb-4">
              <motion.div
                className="h-full w-full bg-blue-900 rounded-full origin-left"
                initial={{ scaleX: 0.1 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 2, ease: [0.77, 0, 0.175, 1], repeat: Infinity }}
              />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-[0.18em]">
              Verifying
            </p>
          </div>
        ) : id && (isValid || isPending || isDeclined) ? (
          <div className="w-full flex flex-col items-center gap-6 sm:gap-8 lg:gap-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
              className={`w-full inline-flex items-start sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-[6px] border ${statusMeta.border} ${statusMeta.bg}`}
            >
              <div className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-[6px] flex items-center justify-center ${statusMeta.iconBg}`}>
                {(() => {
                  const Ico = statusMeta.icon;
                  return <><Ico size={18} className="sm:hidden" /><Ico size={20} className="hidden sm:inline-flex" /></>;
                })()}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] ${statusMeta.text} mb-1`}>
                  {statusMeta.eyebrow}
                </p>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-slate-900 leading-[1.05] tracking-tight mb-1.5">
                  {statusMeta.label}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {statusMeta.copy}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-md mx-auto flex flex-col gap-6"
            >
              <div className="w-full flex justify-center px-2 sm:px-4">
                <div ref={cardRef} className={clsx(
                  "transition-all duration-500",
                  !isValid && "opacity-50 grayscale blur-[1px] pointer-events-none"
                )}>
                  <AccessCard user={userData} />
                </div>
              </div>

              {isValid && (
                <div className="w-full flex flex-col gap-2.5 sm:gap-3 px-2 sm:px-0">
                  <button
                    onClick={handleCopyLink}
                    className="group relative flex w-full items-center justify-center gap-2 sm:gap-2.5 rounded-[6px] bg-blue-900 px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-white shadow-[0_10px_24px_-14px_rgba(30,58,138,0.5)] [@media(hover:hover){&:hover}]:bg-blue-800 [@media(hover:hover){&:hover}]:shadow-[0_14px_30px_-14px_rgba(30,58,138,0.55)] focus:outline-none focus:ring-4 focus:ring-blue-900/15 transition-[transform,box-shadow,background-color] duration-200 ease-out active:scale-[0.98]"
                  >
                    {copyStatus === 'copied' ? (
                      <><Check size={15} className="sm:hidden" /><Check size={16} className="hidden sm:inline-flex" /><span>Link Copied</span></>
                    ) : (
                      <><Copy size={15} className="sm:hidden" /><Copy size={16} className="hidden sm:inline-flex group-hover:scale-110 transition-transform" /><span>Copy Public Link</span></>
                    )}
                  </button>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    <button
                      onClick={handleCopyEmbed}
                      className="inline-flex items-center justify-center gap-2 w-full rounded-[6px] border border-slate-200 bg-white px-4 py-3 sm:py-3 text-xs sm:text-sm font-bold text-slate-700 [@media(hover:hover){&:hover}]:border-slate-300 [@media(hover:hover){&:hover}]:bg-slate-50 transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out active:scale-[0.98]"
                    >
                      {copyStatus === 'embed-copied' ? (
                        <><Check size={14} /><span>Embed Copied</span></>
                      ) : (
                        <><Code size={14} /><span>Embed Code</span></>
                      )}
                    </button>
                    <button
                      onClick={downloadCard}
                      disabled={downloadLoading}
                      className="inline-flex items-center justify-center gap-2 w-full rounded-[6px] border border-slate-200 bg-white px-4 py-3 sm:py-3 text-xs sm:text-sm font-bold text-slate-700 [@media(hover:hover){&:hover}]:border-slate-300 [@media(hover:hover){&:hover}]:bg-slate-50 transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {downloadLoading ? (
                        <><Loader2 size={14} className="animate-spin" /><span>Exporting...</span></>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          <span>Download PNG</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {!isValid && (
                <div className="w-full flex flex-col gap-3 px-2 sm:px-0">
                  <div className={`rounded-[6px] border p-4 sm:p-5 ${statusMeta.border} ${statusMeta.bg}`}>
                    <p className="text-sm sm:text-[15px] font-bold text-slate-900 mb-1.5 leading-tight">
                      {isPending ? 'Application is being reviewed' : 'Card not active'}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {isPending
                        ? 'We review applications on a rolling basis. The applicant will be notified by email once a decision is made.'
                        : 'If you believe this is in error, reach out to our team on Discord.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setUserData(null);
                      navigate('/verify');
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-[6px] border border-slate-200 bg-white px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-slate-700 [@media(hover:hover){&:hover}]:border-slate-300 [@media(hover:hover){&:hover}]:bg-slate-50 transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out active:scale-[0.98]"
                  >
                    <Search size={14} />
                    <span>Verify Another ID</span>
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-xl flex flex-col items-center gap-5 sm:gap-7"
          >
            <div className="text-center">
              <div className="inline-flex w-11 h-11 sm:w-12 sm:h-12 mb-4 rounded-[6px] bg-blue-50 border border-blue-100 items-center justify-center text-blue-900">
                <ShieldCheck size={20} className="sm:hidden" />
                <ShieldCheck size={22} className="hidden sm:inline-flex" />
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-slate-900 leading-[1.05] tracking-tight mb-2.5">
                {id ? 'Invalid card' : 'Verify credentials'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
                {id
                  ? 'This digital access card could not be verified. It may be pending, revoked, or fake.'
                  : 'Enter a Member ID below to verify its authenticity against our official membership registry.'}
              </p>
            </div>

            <div className="w-full space-y-3 sm:space-y-4">
              <div className="relative">
                <Search size={14} className="sm:hidden text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Search size={15} className="hidden sm:inline-flex text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter Member ID (e.g. BGPH-2026-001)"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value.toUpperCase())}
                  className="w-full pl-9 sm:pl-11 pr-10 sm:pr-11 py-3 sm:py-3.5 bg-white border border-slate-200 rounded-[6px] text-xs sm:text-sm focus:outline-none focus:ring-4 focus:ring-blue-900/12 focus:border-blue-900/30 transition-all uppercase placeholder:normal-case font-semibold shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)]"
                />
                <div className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2">
                  {isSearching && <Loader2 size={14} className="text-blue-900 animate-spin" />}
                </div>
              </div>

              <AnimatePresence mode="wait">
                {searchResult ? (
                  <motion.div
                    key="found"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    className="rounded-[6px] border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5 flex items-center gap-3 sm:gap-4 group"
                  >
                    <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-[6px] bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                      <BadgeCheck size={18} className="sm:hidden" />
                      <BadgeCheck size={20} className="hidden sm:inline-flex" />
                    </div>
                    <div className="text-left overflow-hidden flex-1 min-w-0 pt-0.5">
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 mb-1">Official record found</p>
                      <p className="text-sm sm:text-[15px] font-bold text-slate-900 leading-tight truncate">{searchResult.fullName}</p>
                      <p className="text-[11px] sm:text-xs text-slate-600 font-mono truncate">{searchResult.memberId}</p>
                    </div>
                    <button
                      onClick={() => navigate(`/verify/${searchResult.memberId}`)}
                      className="inline-flex items-center gap-1.5 rounded-[6px] bg-slate-900 px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(15,23,42,0.5)] [@media(hover:hover){&:hover}]:bg-slate-800 transition-colors active:scale-[0.98] ml-2 shrink-0"
                    >
                      <span className="hidden sm:inline">View card</span>
                      <span className="sm:hidden">View</span>
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </motion.div>
                ) : searchId.length >= 5 && !isSearching ? (
                  <motion.div
                    key="missing"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    className="rounded-[6px] border border-red-200 bg-red-50/60 p-4 flex items-start gap-3"
                  >
                    <div className="w-9 h-9 shrink-0 rounded-[6px] bg-red-100/60 border border-red-200 flex items-center justify-center text-red-700">
                      <XCircle size={16} />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-xs font-bold text-red-800 mb-1 leading-tight">No official record</p>
                      <p className="text-[11px] sm:text-xs text-red-700/80 leading-relaxed">
                        No verified BetterGovPH member exists for this ID. Double-check the formatting.
                      </p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="w-full pt-4 sm:pt-6 mt-1 sm:mt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-slate-500 hover:text-blue-900 transition-colors group"
              >
                <Home size={13} className="sm:hidden group-hover:-translate-x-0.5 transition-transform" />
                <Home size={14} className="hidden sm:inline-flex group-hover:-translate-x-0.5 transition-transform" />
                <span>Return to home</span>
              </Link>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
