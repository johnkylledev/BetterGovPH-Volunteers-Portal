import React, { useState, useEffect } from 'react';
import {
  Heart,
  Users,
  IdCard,
  Globe,
  Zap,
  MessageSquare,
  ArrowRight,
  Code2,
  Menu,
  X,
  Palette,
  Megaphone,
  Database,
  Search,
  Github,
  BarChart3,
  Building2,
  ShieldCheck,
  Lightbulb,
  Lock,
  Sun,
  Target,
  Flag
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { AccessCard } from '../../components/AccessCard';
import { User } from '../../types';
import { motion, useScroll, useTransform } from 'framer-motion';

const DISCORD_INVITE = "https://discord.com/invite/mHtThpN8bT";
const MAIN_WEBSITE = "https://bettergov.ph/";
const GITHUB_ORG = "https://github.com/BetterGovPH";

const Landing: React.FC = () => {
  const navigate = useNavigate();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { scrollYProgress } = useScroll();
  const heroBgY = useTransform(scrollYProgress, [0, 0.2], [0, -80]);
  const battleCryBgY = useTransform(scrollYProgress, [0.85, 0.95], [0, -120]);
  const statsY = useTransform(scrollYProgress, [0.03, 0.1], [40, 0]);
  const rolesY = useTransform(scrollYProgress, [0.25, 0.38], [60, -20]);
  const valuesY = useTransform(scrollYProgress, [0.16, 0.26], [40, -20]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const mockUser: User = {
    id: 'preview-id',
    fullName: 'Juan Dela Cruz',
    email: 'juan@example.com',
    role: 'Member',
    specialization: 'Developer',
    memberId: 'BGPH-2025-XXX',
    status: 'Approved',
    isAdmin: false,
    yearJoined: 2025,
    createdAt: new Date().toISOString(),
  };

  const handleApplyClick = () => {
    navigate('/register');
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const roles = [
    {
      number: "01",
      title: "Frontend Developer",
      description: "Build fast, accessible interfaces that bring government data to life. React, TypeScript, Tailwind — modern stack for meaningful work.",
      skills: ["React", "TypeScript", "Tailwind CSS", "Accessibility"],
      commitment: "5-10 hrs/week",
      icon: <Code2 size={24} />,
      href: GITHUB_ORG + "/issues?q=label%3Afrontend"
    },
    {
      number: "02",
      title: "Backend Developer",
      description: "Design APIs, wrangle data, build infrastructure that scales. Node.js, Python, PostgreSQL — power the civic tech ecosystem.",
      skills: ["Node.js or Python", "PostgreSQL", "API Design", "Data Processing"],
      commitment: "5-10 hrs/week",
      icon: <Database size={24} />,
      href: GITHUB_ORG + "/issues?q=label%3Abackend"
    },
    {
      number: "03",
      title: "Data Engineer",
      description: "Extract, transform, and load government data. Build pipelines that turn PDFs and spreadsheets into actionable insights.",
      skills: ["Python", "Data Pipelines", "Web Scraping", "SQL"],
      commitment: "5-10 hrs/week",
      icon: <BarChart3 size={24} />,
      href: GITHUB_ORG + "/issues?q=label%3Adata"
    },
    {
      number: "04",
      title: "Researcher",
      description: "Analyze budgets, track procurement, verify data accuracy. Find the stories in the numbers that citizens need to know.",
      skills: ["Budget Analysis", "Research", "Data Verification", "Writing"],
      commitment: "3-5 hrs/week",
      icon: <Search size={24} />,
      href: GITHUB_ORG + "/issues?q=label%3Aresearch"
    },
    {
      number: "05",
      title: "Designer",
      description: "Make government data beautiful and usable. Information design, UI/UX, accessibility — every pixel serves the public.",
      skills: ["UI/UX Design", "Information Design", "Figma", "Accessibility"],
      commitment: "3-5 hrs/week",
      icon: <Palette size={24} />,
      href: GITHUB_ORG + "/issues?q=label%3Adesign"
    },
    {
      number: "06",
      title: "Community Advocate",
      description: "Share our work, write about it, grow the movement. Transparency only works when people see it and understand it.",
      skills: ["Social Media", "Writing", "Community Building"],
      commitment: "2-3 hrs/week",
      icon: <Megaphone size={24} />,
      cta: "Join Advocacy",
      href: DISCORD_INVITE
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">

      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg shadow-black/5' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <img src="/logo.svg" alt="BetterGovPH" className="h-7 w-auto" />
              <div className="flex flex-col leading-none">
                <span className="font-display font-bold text-base tracking-tight text-blue-900">BetterGovPH</span>
                <span className="font-display font-bold text-[9px] uppercase tracking-[0.2em] text-blue-900/60 leading-tight">Developer Community</span>
              </div>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <button onClick={() => scrollToSection('open-roles')} className="text-sm font-semibold text-slate-600 hover:text-blue-900 transition-all relative group">
                Open Roles
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-900 transition-all group-hover:w-full" />
              </button>
              <Link to="/projects" className="text-sm font-semibold text-slate-600 hover:text-blue-900 transition-all relative group">
                Projects
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-900 transition-all group-hover:w-full" />
              </Link>
              <Link to="/contribute" className="text-sm font-semibold text-slate-600 hover:text-blue-900 transition-all relative group">
                Contribute
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-900 transition-all group-hover:w-full" />
              </Link>
              <a href={MAIN_WEBSITE} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-slate-600 hover:text-blue-900 transition-all relative group">
                About
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-900 transition-all group-hover:w-full" />
              </a>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/login')}
                className="text-sm font-bold px-5 py-2 rounded-full border-2 border-blue-900 text-blue-900 hover:bg-blue-900 hover:text-white transition-all shadow-sm"
              >
                Sign In
              </motion.button>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden flex items-center justify-center p-2 text-slate-600 hover:text-blue-900 transition-all"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md">
            <div className="px-4 py-3 space-y-1">
              <button onClick={() => { scrollToSection('open-roles'); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-semibold text-slate-600 hover:text-blue-900 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all">
                Open Roles
              </button>
              <Link to="/projects" onClick={() => setMobileMenuOpen(false)} className="block w-full text-left text-sm font-semibold text-slate-600 hover:text-blue-900 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all">
                Projects
              </Link>
              <Link to="/contribute" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-semibold text-slate-600 hover:text-blue-900 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all">
                Contribute
              </Link>
              <a href={MAIN_WEBSITE} target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-semibold text-slate-600 hover:text-blue-900 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all">
                About
              </a>
              <div className="border-t border-slate-100 my-1" />
              <button onClick={() => { setMobileMenuOpen(false); navigate('/login'); }} className="w-full text-sm font-bold px-5 py-3 rounded-full bg-blue-900 text-white hover:bg-blue-800 transition-all text-center">
                Sign In
              </button>
              <button onClick={() => { setMobileMenuOpen(false); navigate('/register'); }} className="w-full text-sm font-bold px-5 py-3 rounded-full border-2 border-blue-900 text-blue-900 hover:bg-blue-50 transition-all text-center">
                Start Contributing
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ── 1. Hero ───────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <motion.div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-white to-slate-50/80 pointer-events-none" style={{ y: heroBgY }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative pt-24 pb-16 sm:pt-32 sm:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-4xl lg:text-6xl font-display font-extrabold text-slate-900 leading-[1.1] mb-6"
              >
                Join the Philippines'
                <span className="text-blue-600 block">Civic Tech Community</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-lg text-slate-600 mb-3 leading-relaxed max-w-xl"
              >
                Connect with contributors building open-source solutions for transparency, public participation, and government accountability.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-base text-slate-500 mb-8 leading-relaxed max-w-xl"
              >
                Get your verified contributor badge, collaborate on projects, and help turn public data into public impact.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-col sm:flex-row gap-4 items-start sm:items-center"
              >
                <button
                  onClick={handleApplyClick}
                  className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-blue-900 text-white font-bold text-sm hover:bg-blue-800 transition-all shadow-xl shadow-blue-900/25 active:scale-[0.97]"
                >
                  <IdCard size={20} />
                  Start Contributing
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <a
                  href={DISCORD_INVITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl border-2 border-slate-300 bg-white text-slate-800 font-bold text-sm hover:border-blue-400 hover:text-blue-700 transition-all shadow-sm active:scale-[0.97]"
                >
                  <MessageSquare size={20} />
                  Join Discord
                </a>
              </motion.div>
            </motion.div>
            <div className="flex justify-center items-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="relative"
              >
                <div className="rotate-2 hover:rotate-0 transition-transform duration-500">
                  <AccessCard user={mockUser} isDemo />
                </div>
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1, type: "spring" }}
                  className="absolute -top-3 -right-3 bg-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg border border-slate-200"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700">Verified Contributor</span>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Impact Stats ────────────────────────────────────────── */}
      <motion.section style={{ y: statsY }} className="py-12 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "13+", label: "Major Projects", icon: <BarChart3 size={20} /> },
              { value: "4,600+", label: "Discord Members", icon: <Users size={20} /> },
              { value: "₱6.3T", label: "Budget Analyzed", icon: <Search size={20} /> },
              { value: "5+", label: "Partner Organizations", icon: <Building2 size={20} /> }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-900 mx-auto mb-3">
                  {stat.icon}
                </div>
                <div className="text-2xl lg:text-3xl font-display font-extrabold text-slate-900">{stat.value}</div>
                <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── 3. Battle Cry: The Old Way / Our Way ───────────────────── */}
      <section className="py-20 lg:py-28 bg-white overflow-hidden relative">
        <motion.div
          className="absolute top-20 right-10 w-64 h-64 rounded-full bg-blue-50/50 pointer-events-none"
          style={{ y: useTransform(scrollYProgress, [0.08, 0.2], [-30, 30]) }}
        />
        <motion.div
          className="absolute bottom-20 left-10 w-48 h-48 rounded-full bg-indigo-50/50 pointer-events-none"
          style={{ y: useTransform(scrollYProgress, [0.08, 0.2], [30, -30]) }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-4">
              We Are The Generation That Must Change The Old System
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">
              Mga kababayan, we stand at a crossroads. The path we choose today will define Philippine democracy for generations.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-red-50 rounded-3xl p-8 lg:p-10 border border-red-100"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-6">
                <Lock size={24} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">The Old Way</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-red-200 flex items-center justify-center shrink-0 mt-0.5">
                    <X size={12} className="text-red-600" />
                  </div>
                  <span className="text-sm">Citizens are spectators to their own governance</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-red-200 flex items-center justify-center shrink-0 mt-0.5">
                    <X size={12} className="text-red-600" />
                  </div>
                  <span className="text-sm">Transparency is a promise unfulfilled</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-red-200 flex items-center justify-center shrink-0 mt-0.5">
                    <X size={12} className="text-red-600" />
                  </div>
                  <span className="text-sm">The digital age passes by our democracy like a ship in the night</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-red-200 flex items-center justify-center shrink-0 mt-0.5">
                    <X size={12} className="text-red-600" />
                  </div>
                  <span className="text-sm">Data is trapped in PDFs and broken websites</span>
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="bg-green-50 rounded-3xl p-8 lg:p-10 border border-green-100"
            >
              <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center text-green-600 mb-6">
                <Sun size={24} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Our Way</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck size={12} className="text-green-600" />
                  </div>
                  <span className="text-sm">Every Filipino with a smartphone becomes an agent of change</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck size={12} className="text-green-600" />
                  </div>
                  <span className="text-sm">Government works <span className="font-bold">with</span> us, not <span className="font-bold">above</span> us</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck size={12} className="text-green-600" />
                  </div>
                  <span className="text-sm">Technology serves <span className="font-bold">bayanihan</span>, not bureaucracy</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck size={12} className="text-green-600" />
                  </div>
                  <span className="text-sm">Open data, open code, open government — accessible to every Filipino</span>
                </li>
              </ul>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center mt-12"
          >
            <p className="text-2xl lg:text-3xl font-bold text-blue-900">We choose our way.</p>
          </motion.div>
        </div>
      </section>

      {/* ── 4. Our Declaration / Values ────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-900 text-sm font-bold mb-4">
              <Target size={14} />
              Our Declaration
            </div>
            <h2 className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-4">
              What We Stand For
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">
              These principles guide every line of code, every design decision, and every project we build.
            </p>
          </motion.div>

          <motion.div style={{ y: valuesY }} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: <Flag size={28} />, title: "Filipino-First", desc: "Built by Filipinos, for Filipinos" },
              { icon: <Lightbulb size={28} />, title: "Innovation", desc: "Every line of code serves democracy" },
              { icon: <Users size={28} />, title: "Collaboration", desc: "Building bridges, not walls" },
              { icon: <Zap size={28} />, title: "Urgency", desc: "Fast feedback, real impact" },
              { icon: <Github size={28} />, title: "Open", desc: "Code, data, movement transparent" },
              { icon: <Heart size={28} />, title: "Accessible", desc: "Every Filipino participates" }
            ].map((value, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="text-center p-6"
              >
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-blue-900 mx-auto mb-4">
                  {value.icon}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">{value.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{value.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 5. Open Roles ──────────────────────────────────────────── */}
      <section id="open-roles" className="py-20 lg:py-28 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-900 text-sm font-bold mb-4">
              <Users size={14} />
              We Need Your Skills
            </div>
            <h2 className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-4">
              Find Your Role in the Movement
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">
              Every skill is a tool for change. Whether you code, design, research, or organize — there's a place for you here.
            </p>
          </motion.div>

          <motion.div style={{ y: rolesY }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="bg-white p-8 rounded-2xl border border-slate-200 hover:border-blue-200 hover:shadow-xl transition-all duration-300 group flex flex-col"
              >
                <div className="flex items-start justify-between mb-5">
                  <span className="text-4xl font-display font-bold text-slate-100 group-hover:text-blue-100 transition-colors">
                    {role.number}
                  </span>
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-900 group-hover:bg-blue-900 group-hover:text-white transition-all">
                    {role.icon}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{role.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-5 flex-grow">{role.description}</p>
                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.skills.map((skill, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Zap size={12} />
                    <span>{role.commitment}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <p className="text-slate-500 text-sm mb-4">Don't see your exact fit?</p>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-900 font-semibold text-sm hover:gap-3 transition-all group"
            >
              Join Discord and tell us how you want to contribute
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── 9. Partners ────────────────────────────────────────────── */}
      <section className="py-16 lg:py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Our Partners</h3>
            <p className="text-slate-600 text-sm mt-2 max-w-xl mx-auto">
              We don't work alone. These organizations have opened doors, shared expertise, and trusted us with real responsibility.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden"
          >
            <motion.div
              className="flex gap-10 items-center"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
            >
              {[...Array(2)].flatMap(() => [
                "People's Budget Coalition",
                "DICT",
                "Department of Budget and Management",
                "Local Government Units",
                "Philippine Center for Investigative Journalism",
                "Countless civic groups and organizations"
              ]).map((name, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-white border border-slate-200 shadow-sm whitespace-nowrap"
                >
                  <span className="text-sm font-semibold text-slate-700">{name}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── 10. How It Works ───────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-4">
              Start in 3 Simple Steps
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">
              Join fellow Filipinos building tools for transparency and accountability.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Join the Community",
                  desc: "Hop into our Discord server. Say hello, introduce yourself, and see what people are building. This is where everything happens.",
                  action: "Join Discord",
                  href: DISCORD_INVITE
                },
                {
                  step: "02",
                  title: "Share Your Skills",
                  desc: "Fill out a simple form — your name, skills, and what you want to work on. Takes 5 minutes. No bureaucracy.",
                  action: "Get Started",
                  href: "/register"
                },
                {
                  step: "03",
                  title: "Start Contributing",
                  desc: "Jump into active projects, collaborate with fellow contributors, and help turn public data into public impact.",
                  action: "See Open Roles",
                  href: "#open-roles"
                }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="relative flex flex-col items-center text-center p-8"
                >
                  {i < 2 && (
                    <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-px border-t-2 border-dashed border-blue-200" />
                  )}
                  <div className="w-14 h-14 rounded-full bg-blue-900 text-white flex items-center justify-center font-display font-bold text-xl mb-6 relative">
                    <div className="absolute inset-0 rounded-full bg-blue-800 animate-ping opacity-20" />
                    <span className="relative">{item.step}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6">{item.desc}</p>
                  {item.href.startsWith('http') ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-900 font-bold text-sm hover:gap-3 transition-all group">
                      {item.action}
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </a>
                  ) : item.href.startsWith('#') ? (
                    <button onClick={() => scrollToSection(item.href.replace('#', ''))} className="inline-flex items-center gap-2 text-blue-900 font-bold text-sm hover:gap-3 transition-all group">
                      {item.action}
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  ) : (
                    <button onClick={() => navigate(item.href)} className="inline-flex items-center gap-2 text-blue-900 font-bold text-sm hover:gap-3 transition-all group">
                      {item.action}
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* ── 12. CTA / Final Battle Cry ─────────────────────────────── */}
      <section className="relative py-24 lg:py-32 bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 text-white overflow-hidden">
        <motion.div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" style={{ y: battleCryBgY }} />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-bold mb-8">
              <Heart size={14} className="fill-white" />
              Join the Movement
            </div>
            <h2 className="text-3xl lg:text-5xl font-display font-bold mb-3">
              Hindi Tayo Tumitingin.
            </h2>
            <p className="text-5xl lg:text-7xl font-display font-extrabold mb-4">
              Tayo Ang Gumagawa.
            </p>
            <p className="text-xl text-blue-100 mb-3">We don't just watch. We build.</p>
            <p className="text-base text-blue-200/80 mb-10 max-w-lg mx-auto">
              Every developer, designer, researcher, and advocate who joins brings us closer to the government we deserve.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleApplyClick}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white text-blue-900 font-bold text-base hover:bg-blue-50 transition-all shadow-xl active:scale-[0.97] group"
              >
                <Users size={20} />
                Join the Community
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl border-2 border-white/40 text-white font-bold text-base hover:bg-white/10 hover:border-white transition-all active:scale-[0.97] group"
              >
                <MessageSquare size={20} />
                Join Discord
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 13. Footer ─────────────────────────────────────────────── */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="bg-slate-900 text-slate-300 py-16"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="col-span-2"
            >
              <div className="flex items-center gap-2 mb-5">
                <img src="https://assets.bettergov.ph/logos/webp/icon-white.webp" alt="BetterGovPH" className="h-10 w-auto" />
              </div>
              <p className="text-slate-400 max-w-sm text-sm leading-relaxed mb-6">
                Building the future of digital governance in the Philippines through open source, collaboration, and community-driven technology.
              </p>
              <div className="flex gap-3">
                <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all" aria-label="Discord">
                  <MessageSquare size={16} />
                </a>
                <a href={GITHUB_ORG} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all" aria-label="GitHub">
                  <Github size={16} />
                </a>
                <a href={MAIN_WEBSITE} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all" aria-label="Website">
                  <Globe size={16} />
                </a>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <h4 className="font-bold text-white mb-5 text-xs uppercase tracking-widest">Get Involved</h4>
              <ul className="space-y-3">
                <li><a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white text-sm transition-colors">Join Discord</a></li>
                <li><Link to="/contribute" className="text-slate-400 hover:text-white text-sm transition-colors">How to Contribute</Link></li>
                <li><a href={GITHUB_ORG} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white text-sm transition-colors">Open Source Repos</a></li>
                <li><button onClick={() => navigate('/register')} className="text-slate-400 hover:text-white text-sm transition-colors">Apply to Join</button></li>
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <h4 className="font-bold text-white mb-5 text-xs uppercase tracking-widest">Developer Portal</h4>
              <ul className="space-y-3">
                <li><button onClick={() => navigate('/login')} className="text-slate-400 hover:text-white text-sm transition-colors">Sign In</button></li>
                <li><Link to="/projects" className="text-slate-400 hover:text-white text-sm transition-colors">Projects</Link></li>
                <li><Link to="/verify" className="text-slate-400 hover:text-white text-sm transition-colors">Verify a Card</Link></li>
                <li><Link to="/privacy" className="text-slate-400 hover:text-white text-sm transition-colors">Privacy Policy</Link></li>
              </ul>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4"
          >
            <p className="text-slate-500 text-xs">
              &copy; {new Date().getFullYear()} BetterGovPH. Built with purpose for the Filipino people.
            </p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-slate-500 hover:text-white text-xs transition-colors">Privacy</Link>
              <Link to="/terms" className="text-slate-500 hover:text-white text-xs transition-colors">Terms</Link>
            </div>
          </motion.div>
        </div>
      </motion.footer>
    </div>
  );
};

export default Landing;