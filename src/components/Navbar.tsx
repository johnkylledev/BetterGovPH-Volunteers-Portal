import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ArrowUpRight } from 'lucide-react';
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

export const Navbar: React.FC = () => {
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
          className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 md:hidden"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t border-slate-200/70 px-4 pb-4 pt-2 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.path}
              onClick={(e) => {
                setMobileMenuOpen(false);
                link.onClick?.(e);
              }}
              className="block rounded-lg px-2 py-3 text-[15px] text-slate-700 hover:bg-slate-100"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={ABOUT_WEBSITE}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-lg px-2 py-3 text-[15px] text-slate-700 hover:bg-slate-100"
          >
            About <ArrowUpRight size={14} strokeWidth={1.75} className="text-slate-400" />
          </a>
          <div className="mt-3 grid gap-2">
            <button onClick={handleCtaClick} className="s-btn s-btn-plain w-full">
              {ctaLabel}
            </button>
            {!sessionUserId && (
              <Link to="/register" className="s-btn s-btn-accent w-full">
                Apply for membership
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
