import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { ABOUT_WEBSITE } from './site/links';

const isProfileComplete = (u: any) => {
  if (!u) return false;
  const fullNameOk = typeof u.fullName === 'string' && u.fullName.trim().length > 0;
  const specializationOk = typeof u.specialization === 'string' && u.specialization.trim().length > 0;
  const yearOk = typeof u.yearJoined === 'number' && Number.isFinite(u.yearJoined);
  const discordOk = u.discordConnected === true;
  return fullNameOk && specializationOk && yearOk && discordOk;
};

const menuItem = {
  open: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] as const } },
  closed: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

export const Navbar: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, sessionUserId } = useStore();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleOpenRolesClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault();
      document.getElementById('open-roles')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCtaClick = () => {
    if (sessionUserId) {
      if (currentUser?.isAdmin) {
        navigate('/admin');
      } else {
        navigate(isProfileComplete(currentUser) ? '/dashboard' : '/register');
      }
    } else {
      navigate('/login');
    }
  };

  const ctaLabel = sessionUserId ? 'Dashboard' : 'Sign in';

  const navLinks = [
    { label: 'Open roles', path: '/#open-roles', onClick: handleOpenRolesClick },
    { label: 'Projects', path: '/projects' },
    { label: 'Contribute', path: '/contribute' },
    { label: 'Verify', path: '/verify' },
  ];

  const isActive = (path: string) => path !== '/#open-roles' && location.pathname.startsWith(path);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-[box-shadow,background-color] duration-200 ${
        isScrolled || isMobileMenuOpen
          ? 'bg-white/80 backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_0_rgb(15_23_42/0.08)]'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <img
            src="/logo.svg"
            onError={(e) => { const t = e.currentTarget; t.onerror = null; t.src = 'https://assets.bettergov.ph/logos/webp/icon-primary.webp'; }}
            alt=""
            className="h-6 w-6 shrink-0 object-contain"
          />
          <span className="truncate text-[15px] font-semibold tracking-[-0.015em] text-slate-900">
            BetterGovPH <span className="font-normal text-slate-500">Volunteers</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.path}
              onClick={link.onClick}
              className={`rounded-lg px-3 py-1.5 text-[14px] transition-colors duration-150 ${
                isActive(link.path) ? 'font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href={ABOUT_WEBSITE}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-0.5 rounded-lg px-3 py-1.5 text-[14px] text-slate-500 transition-colors duration-150 hover:text-slate-900"
          >
            About
            <ArrowUpRight size={13} strokeWidth={1.75} className="transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px" />
          </a>
          <button onClick={handleCtaClick} className="s-btn s-btn-plain ml-3 h-9 px-3.5">
            {ctaLabel}
          </button>
        </div>

        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-900 active:scale-[0.94] md:hidden"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-menu"
        >
          {/* Three lines that fold into an X: top and bottom rotate in, the middle fades out */}
          <span className="relative block h-[14px] w-[18px]" aria-hidden>
            <span
              className="absolute left-0 top-0 h-[1.75px] w-full rounded-full bg-current transition-transform duration-300 ease-[cubic-bezier(.23,1,.32,1)]"
              style={{ transform: isMobileMenuOpen ? 'translateY(6.125px) rotate(45deg)' : 'none' }}
            />
            <span
              className="absolute left-0 top-[6.125px] h-[1.75px] w-full rounded-full bg-current transition-[opacity,transform] duration-200 ease-[cubic-bezier(.23,1,.32,1)]"
              style={{ opacity: isMobileMenuOpen ? 0 : 1, transform: isMobileMenuOpen ? 'scaleX(0.4)' : 'none' }}
            />
            <span
              className="absolute bottom-0 left-0 h-[1.75px] w-full rounded-full bg-current transition-transform duration-300 ease-[cubic-bezier(.23,1,.32,1)]"
              style={{ transform: isMobileMenuOpen ? 'translateY(-6.125px) rotate(-45deg)' : 'none' }}
            />
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-menu"
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.15 : 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden border-t border-slate-200/70 md:hidden"
          >
            <motion.div
              className="px-4 pb-4 pt-2"
              initial="closed"
              animate="open"
              exit="closed"
              variants={{
                open: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
                closed: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
              }}
            >
              {navLinks.map((link) => (
                <motion.div key={link.label} variants={menuItem}>
                  <Link
                    to={link.path}
                    onClick={(e) => {
                      setMobileMenuOpen(false);
                      link.onClick?.(e);
                    }}
                    className="block rounded-lg px-2 py-3 text-[15px] text-slate-700 hover:bg-slate-100"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div variants={menuItem}>
                <a
                  href={ABOUT_WEBSITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg px-2 py-3 text-[15px] text-slate-700 hover:bg-slate-100"
                >
                  About <ArrowUpRight size={14} strokeWidth={1.75} className="text-slate-400" />
                </a>
              </motion.div>
              <motion.div variants={menuItem} className="mt-3 grid gap-2">
                <button onClick={handleCtaClick} className="s-btn s-btn-plain w-full">
                  {ctaLabel}
                </button>
                {!sessionUserId && (
                  <Link to="/register" className="s-btn s-btn-accent w-full">
                    Apply for membership
                  </Link>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
