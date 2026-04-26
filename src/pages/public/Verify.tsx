import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { ShieldCheck, XCircle, ExternalLink, Copy, Download, Code, Check, Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { getUserByMemberIdOrId } from '../../services/supabase';
import { AccessCard } from '../../components/AccessCard';

export default function Verify() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const users = useStore((state) => state.users);
  const [userData, setUserData] = useState<any | null>(() => {
    if (!id) return null;
    return users.find((u) => u.memberId === id || u.id === id) || null;
  });
  const [loading, setLoading] = useState(!userData && !!id);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'embed-copied'>('idle');
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const isEmbed = new URLSearchParams(window.location.search).get('embed') === 'true';
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!id) {
        setUserData(null);
        setLoading(false);
        return;
      }

      // If we already have the data (from initial state), don't set loading again
      const localUser = users.find((u) => u.memberId === id || u.id === id);
      if (localUser) {
        setUserData(localUser);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const remoteUser = await getUserByMemberIdOrId(id);
        setUserData(remoteUser);
      } catch (error) {
        console.error('Error loading verify user:', error);
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
      } catch (err) {
        setSearchResult(null);
      } finally {
        setIsSearching(false);
      }
    };

    const timeout = setTimeout(performSearch, 500);
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
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleCopyEmbed = async () => {
    if (!publicUrl) return;
    try {
      const embedCode = `<iframe src="${publicUrl}" width="300" height="450" frameborder="0"></iframe>`;
      await navigator.clipboard.writeText(embedCode);
      setCopyStatus('embed-copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  return (
    <div className={clsx(
      "flex flex-col items-center justify-center font-sans selection:bg-blue-900/20 no-scrollbar",
      isEmbed ? "h-screen w-full overflow-hidden bg-transparent" : "min-h-screen bg-white sm:bg-slate-50"
    )}>
      <motion.div
        initial={isEmbed ? { opacity: 0 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={clsx(
          "w-full flex flex-col items-center text-center relative no-scrollbar",
          isEmbed ? "p-0 h-full bg-transparent overflow-hidden" : "max-w-3xl bg-white sm:rounded-[2.5rem] sm:my-10 px-0 sm:px-12 py-10 sm:py-20 sm:shadow-2xl sm:shadow-slate-200/50 sm:border border-slate-100 min-h-screen sm:min-h-0 overflow-hidden"
        )}
      >
        {!isEmbed && <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-900" />}

        {loading ? (
          !isEmbed ? (
            <div className="py-16">
              <Loader2 className="w-8 h-8 text-blue-900 animate-spin mx-auto mb-4" />
              <p className="text-sm text-slate-500">Verifying access credentials...</p>
            </div>
          ) : null
        ) : id && (isValid || isPending || isDeclined) ? (
          <>
            {!isEmbed && (
              <>
                <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-3 tracking-tight px-4">
                  Official Verification
                </h1>
                <p className="text-slate-600 text-lg sm:text-xl font-medium mb-10 sm:mb-12 px-6 sm:px-6 leading-relaxed max-w-2xl">
                  {isValid
                    ? (
                      <span>
                        <span className="text-blue-900 font-mono font-bold px-2 py-0.5 bg-blue-50 rounded-lg break-words">{userData.fullName}</span> is a verified member of BetterGovPH.
                      </span>
                    )
                    : isPending
                      ? 'This card is currently undergoing official review and is not yet active.'
                      : 'This digital access card has been revoked or declined and is no longer valid.'}
                </p>
              </>
            )}

            <div className={clsx(
              "transition-all duration-700 w-full flex justify-center px-2",
              !isValid && "opacity-50 grayscale blur-[1px] pointer-events-none"
            )}>
              <AccessCard user={userData} />
            </div>

            {isValid && (
              <div className="w-full max-w-md mt-12 space-y-4">
              </div>
            )}

            {!isValid && (
              <div className="mt-8 w-full px-4">
                <button
                  onClick={() => {
                    setUserData(null);
                    navigate('/verify');
                  }}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-[0.98]"
                >
                  Verify Another ID
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
              <Search className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500" />
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 mb-2">
              {id ? 'Invalid Card' : 'Verify Credentials'}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mb-8 px-6">
              {id
                ? 'This digital access card could not be verified. It may be pending, revoked, or fake.'
                : 'Enter a Member ID below to verify its status in our official database.'}
            </p>

            <div className="w-full space-y-4 px-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter Member ID (e.g. BGPH-2026-001)"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 sm:py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base sm:text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all uppercase placeholder:normal-case"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {isSearching && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                </div>
              </div>

              {searchResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 sm:p-5 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between group"
                >
                  <div className="text-left overflow-hidden">
                    <p className="text-[9px] sm:text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1 truncate">Official Member Found</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{searchResult.fullName}</p>
                    <p className="text-xs text-slate-500 truncate">{searchResult.memberId}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/verify/${searchResult.memberId}`)}
                    className="p-2 sm:p-3 bg-blue-900 text-white rounded-xl shadow-sm border border-blue-200 group-hover:bg-blue-800 transition-all ml-4"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {searchId.length >= 5 && !isSearching && !searchResult && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-medium">
                  No official record found for this Member ID.
                </div>
              )}
            </div>
          </>
        )}

        {!isEmbed && (
          <div className="mt-12 pt-8 border-t border-slate-100 w-full px-4 sm:px-12">
            <Link to="/" className="inline-flex items-center justify-center space-x-2 text-sm font-bold text-blue-900 hover:text-blue-700 transition-colors w-full group">
              <span>Return to BetterGovPH Portal</span>
              <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
