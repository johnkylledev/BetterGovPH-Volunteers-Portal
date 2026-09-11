import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';

const MAIN_WEBSITE = "https://bettergov.ph/";

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
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll logic
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenRolesClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault();
      scrollToSection('open-roles');
    } else {
      // Allow default link navigation to /#open-roles
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

  const getCtaLabel = () => {
    if (sessionUserId) {
      return 'Dashboard';
    }
    return 'Sign In';
  };

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Open Roles', path: '/#open-roles', onClick: handleOpenRolesClick },
    { label: 'Projects', path: '/projects' },
    { label: 'Contribute', path: '/contribute' },
    { label: 'About', path: MAIN_WEBSITE, isExternal: true },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg shadow-black/5' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/logo.svg" alt="BetterGovPH" className="h-7 w-auto" />
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold text-base tracking-tight text-blue-900">BetterGovPH</span>
              <span className="font-display font-bold text-[9px] uppercase tracking-[0.2em] text-blue-900/60 leading-tight">Volunteers Community</span>
            </div>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || (link.path === '/#open-roles' && location.pathname === '/' && location.hash === '#open-roles');
              if (link.isExternal) {
                return (
                  <a
                    key={link.label}
                    href={link.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-slate-600 hover:text-blue-900 transition-all relative group flex items-center gap-1"
                  >
                    {link.label}
                    <ExternalLink size={14} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-900 transition-all group-hover:w-full" />
                  </a>
                );
              }
              return (
                <Link
                  key={link.label}
                  to={link.path}
                  onClick={link.onClick}
                  className={`text-sm font-semibold transition-all relative group ${isActive ? 'text-blue-900' : 'text-slate-600 hover:text-blue-900'}`}
                >
                  {link.label}
                  <span className={`absolute -bottom-1 left-0 h-0.5 bg-blue-900 transition-all ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                </Link>
              );
            })}
            
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleCtaClick}
              className="text-sm font-bold px-5 py-2 rounded-full border-2 border-blue-900 text-blue-900 hover:bg-blue-900 hover:text-white transition-all shadow-sm"
            >
              {getCtaLabel()}
            </motion.button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden flex items-center justify-center p-2 text-slate-600 hover:text-blue-900 transition-all"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              if (link.isExternal) {
                return (
                  <a
                    key={link.label}
                    href={link.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between text-sm font-semibold text-slate-600 hover:text-blue-900 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all"
                  >
                    <span>{link.label}</span>
                    <ExternalLink size={14} className="opacity-60" />
                  </a>
                );
              }
              return (
                <Link
                  key={link.label}
                  to={link.path}
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    if (link.onClick) link.onClick(e);
                  }}
                  className="block text-sm font-semibold text-slate-600 hover:text-blue-900 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all"
                >
                  {link.label}
                </Link>
              );
            })}
            
            <div className="border-t border-slate-100 my-1" />
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleCtaClick();
              }}
              className="w-full text-sm font-bold px-5 py-3 rounded-full bg-blue-900 text-white hover:bg-blue-800 transition-all text-center"
            >
              {getCtaLabel()}
            </button>
            {!sessionUserId && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/register');
                }}
                className="w-full text-sm font-bold px-5 py-3 rounded-full border-2 border-blue-900 text-blue-900 hover:bg-blue-50 transition-all text-center mt-2"
              >
                Start Contributing
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
