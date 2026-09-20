import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  ArrowRight,
  Search,
  FolderKanban,
  Heart,
  ShieldCheck,
  ArrowLeft,
  MessageSquare,
  Globe,
  Compass
} from 'lucide-react';
import { Navbar } from '../../components/Navbar';

const EASE = [0.23, 1, 0.32, 1] as const;

const DISCORD_INVITE = 'https://discord.com/invite/mHtThpN8bT';

const shortcuts = [
  { to: '/', label: 'Home', sub: 'Landing', icon: Home, accent: 'blue' },
  { to: '/projects', label: 'Projects', sub: 'Browse demos', icon: FolderKanban, accent: 'emerald' },
  { to: '/contribute', label: 'Contribute', sub: 'Join us', icon: Heart, accent: 'rose' },
  { to: '/verify', label: 'Verify', sub: 'Check a card', icon: ShieldCheck, accent: 'amber' },
];

const accentMap: Record<string, { chip: string; ring: string; chipText: string; hoverShadow: string; hoverBorder: string }> = {
  blue: {
    chip: 'bg-blue-50 border-blue-100 text-blue-900',
    ring: 'focus-visible:ring-4 focus-visible:ring-blue-900/12 focus-visible:border-blue-900/30',
    chipText: 'text-blue-800',
    hoverShadow: 'hover:shadow-[0_0_0_1px_rgba(30,58,138,0.05),0_14px_32px_-12px_rgba(30,58,138,0.18),0_2px_4px_-2px_rgba(30,58,138,0.06)]',
    hoverBorder: 'hover:border-blue-900/25',
  },
  emerald: {
    chip: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    ring: 'focus-visible:ring-4 focus-visible:ring-emerald-900/12 focus-visible:border-emerald-900/30',
    chipText: 'text-emerald-800',
    hoverShadow: 'hover:shadow-[0_0_0_1px_rgba(6,78,59,0.05),0_14px_32px_-12px_rgba(6,95,70,0.16),0_2px_4px_-2px_rgba(6,95,70,0.06)]',
    hoverBorder: 'hover:border-emerald-800/20',
  },
  rose: {
    chip: 'bg-rose-50 border-rose-100 text-rose-800',
    ring: 'focus-visible:ring-4 focus-visible:ring-rose-900/12 focus-visible:border-rose-900/30',
    chipText: 'text-rose-800',
    hoverShadow: 'hover:shadow-[0_0_0_1px_rgba(159,18,57,0.05),0_14px_32px_-12px_rgba(159,18,57,0.16),0_2px_4px_-2px_rgba(159,18,57,0.06)]',
    hoverBorder: 'hover:border-rose-800/20',
  },
  amber: {
    chip: 'bg-amber-50 border-amber-100 text-amber-900',
    ring: 'focus-visible:ring-4 focus-visible:ring-amber-900/12 focus-visible:border-amber-900/30',
    chipText: 'text-amber-900',
    hoverShadow: 'hover:shadow-[0_0_0_1px_rgba(120,53,15,0.05),0_14px_32px_-12px_rgba(146,64,14,0.16),0_2px_4px_-2px_rgba(146,64,14,0.06)]',
    hoverBorder: 'hover:border-amber-800/20',
  },
};

export default function NotFound() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [path, setPath] = useState('');

  useEffect(() => {
    setPath(window.location.pathname);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/projects`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col">
      <Navbar />

      <main className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[18%] right-[6%] w-[360px] h-[360px] rounded-[6px] bg-blue-900/[0.03] rotate-6" />
          <div className="absolute bottom-[12%] left-[5%] w-[280px] h-[280px] rounded-[6px] bg-blue-900/[0.035] -rotate-3" />
        </div>

        <div className="relative max-w-6xl mx-auto px-3 sm:px-6 pt-16 sm:pt-24 pb-14 sm:pb-20">
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="flex flex-col items-center text-center mb-10 sm:mb-14"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-white border border-slate-200 mb-5 sm:mb-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <Compass size={13} className="text-blue-900" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-[0.16em]">404 · Off the map</span>
            </div>

            <div className="relative mb-4 sm:mb-6">
              <motion.h1
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.05, duration: 0.6, ease: EASE }}
                className="font-display font-black leading-[0.9] tracking-[-0.04em] text-[112px] sm:text-[168px] lg:text-[200px] text-slate-900"
                aria-label="404"
              >
                4
                <span className="relative inline-block mx-[-0.02em]">
                  <span className="absolute inset-0 bg-gradient-to-b from-blue-900 via-blue-800 to-blue-950 bg-clip-text text-transparent opacity-100" aria-hidden="true">
                    0
                  </span>
                  <span className="relative bg-gradient-to-b from-blue-900 via-blue-800 to-blue-950 bg-clip-text text-transparent">0</span>
                </span>
                4
              </motion.h1>
              <motion.div
                initial={{ opacity: 0, scaleX: 0.8 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: 0.22, duration: 0.5, ease: EASE }}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-[2px] w-[60%] rounded-full bg-gradient-to-r from-transparent via-blue-900/30 to-transparent"
              />
            </div>

            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.5, ease: EASE }}
              className="text-xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight leading-[1.1] max-w-2xl mb-3 sm:mb-4"
            >
              This page doesn&rsquo;t exist.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.5, ease: EASE }}
              className="text-[12.5px] sm:text-[14px] text-slate-600 leading-relaxed max-w-xl"
            >
              The link may be broken, or the page may have moved. Try the search below or jump straight to a known section.
            </motion.p>

            {path && path !== '/' && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4, ease: EASE }}
                className="mt-5 sm:mt-6 inline-flex items-center gap-2 px-3 py-2 rounded-[6px] bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Requested</span>
                <code className="font-mono text-[11px] sm:text-[12px] text-slate-700 bg-slate-50 px-2 py-[3px] rounded-[4px] border border-slate-200/80">
                  {path}
                </code>
              </motion.div>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.5, ease: EASE }}
            className="max-w-2xl mx-auto mb-10 sm:mb-14"
          >
            <form
              onSubmit={handleSearch}
              className="group relative block"
            >
              <span className="sr-only">Search projects</span>
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 inline-flex items-center text-slate-400 group-focus-within:text-blue-800 transition-colors duration-200">
                <Search size={15} />
              </span>
              <input
                type="search"
                inputMode="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, tags, or try /projects…"
                aria-label="Search BetterGovPH"
                className="w-full h-[44px] pl-11 pr-[140px] rounded-[6px] border border-slate-200 bg-white text-[13px] sm:text-[14px] text-slate-800 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus:outline-none focus:border-blue-900/30 focus:bg-white focus:shadow-[0_0_0_3px_rgba(30,58,138,0.08),0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-14px_rgba(30,58,138,0.15)] active:scale-[0.999]"
              />
              <button
                type="submit"
                className="absolute right-[5px] top-1/2 -translate-y-1/2 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[5px] bg-slate-900 text-white text-[11.5px] font-bold shadow-[0_1px_2px_rgba(15,23,42,0.1),0_8px_20px_-8px_rgba(15,23,42,0.35)] hover:bg-slate-800 active:scale-[0.98] transition-[transform,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
              >
                <span className="hidden sm:inline">Search</span>
                <ArrowRight size={12} />
              </button>
            </form>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.5, ease: EASE }}
            className="mb-10 sm:mb-14"
          >
            <div className="flex items-center gap-2 mb-4 sm:mb-5 max-w-5xl mx-auto">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Quick links</span>
              <div className="flex-1 h-px bg-slate-200/80" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto">
              {shortcuts.map((s, i) => {
                const a = accentMap[s.accent];
                const Ico = s.icon;
                return (
                  <motion.div
                    key={s.to}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.38 + i * 0.04, duration: 0.45, ease: EASE }}
                  >
                    <Link
                      to={s.to}
                      className={`group relative block rounded-[6px] border bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-6px_rgba(15,23,42,0.06)] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99] active:translate-y-0 hover:-translate-y-[1px] border-slate-200/80 ${a.hoverShadow} ${a.hoverBorder} ${a.ring}`}
                    >
                      <div className="flex items-start justify-between mb-3.5">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-[6px] border flex items-center justify-center shrink-0 ${a.chip}`}>
                          <Ico size={16} className="sm:hidden" />
                          <Ico size={17} className="hidden sm:inline-flex" />
                        </div>
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-[6px] bg-slate-50 border border-slate-100 text-slate-300 group-hover:text-blue-800 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors duration-200 shrink-0">
                          <ArrowRight size={12} />
                        </span>
                      </div>
                      <p className="text-[13.5px] sm:text-[14.5px] font-bold text-slate-900 tracking-tight leading-tight mb-0.5">
                        {s.label}
                      </p>
                      <p className="text-[11px] sm:text-[12px] text-slate-500 leading-snug">
                        {s.sub}
                      </p>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.54, duration: 0.5, ease: EASE }}
            className="max-w-3xl mx-auto"
          >
            <div className="rounded-[6px] border border-slate-200/80 bg-white p-5 sm:p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-14px_rgba(15,23,42,0.1)]">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-[6px] bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900">
                  <ArrowLeft size={18} className="sm:hidden" />
                  <ArrowLeft size={19} className="hidden sm:inline-flex" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] sm:text-[11.5px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                    Lost? Start here
                  </p>
                  <p className="text-sm sm:text-[15px] font-bold text-slate-900 leading-tight mb-1">
                    Head back to the homepage, or talk to the team on Discord.
                  </p>
                  <p className="text-[12px] sm:text-[13px] text-slate-500 leading-relaxed">
                    BetterGovPH is volunteer-run — if you hit a dead end, let us know and we&rsquo;ll fix it.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 shrink-0 w-full sm:w-auto">
                  <Link
                    to="/"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-[7px] rounded-[6px] bg-slate-900 text-white text-[11.5px] font-bold shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_20px_-8px_rgba(15,23,42,0.3)] hover:bg-slate-800 active:scale-[0.98] transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] w-full sm:w-auto"
                  >
                    <Home size={12.5} />
                    Go Home
                  </Link>
                  <a
                    href={DISCORD_INVITE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-[7px] rounded-[6px] border border-slate-200 bg-white text-slate-700 text-[11.5px] font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50 active:scale-[0.98] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] w-full sm:w-auto"
                  >
                    <MessageSquare size={12.5} />
                    <Globe size={10} className="sm:hidden" />
                    <span className="hidden sm:inline">Open Discord</span>
                    <span className="sm:hidden">Discord</span>
                  </a>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 shrink-0">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] sm:text-xs font-semibold text-slate-400">
          <span>© {new Date().getFullYear()} BetterGovPH. Civic-first, open source.</span>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
