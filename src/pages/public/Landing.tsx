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
  Palette,
  Megaphone,
  Database,
  Search,
  Github,
  BarChart3,
  Building2,
  ShieldCheck,
  Scale,
  Lightbulb,
  Lock,
  Sun,
  Target,
  Flag,
  ExternalLink,
  CheckCircle2,
  GraduationCap
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { AccessCard } from '../../components/AccessCard';
import { User } from '../../types';
import { motion, useScroll } from 'framer-motion';
import { Navbar } from '../../components/Navbar';

const DISCORD_INVITE = "https://discord.com/invite/mHtThpN8bT";
const MAIN_WEBSITE = "https://bettergov.ph/";
const GITHUB_ORG = "https://github.com/BetterGovPH";

const Landing: React.FC = () => {
  const navigate = useNavigate();

  const { scrollYProgress } = useScroll();

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (window.location.hash === '#open-roles') {
      const timer = setTimeout(() => {
        scrollToSection('open-roles');
      }, 300);
      return () => clearTimeout(timer);
    }
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

      <Navbar />

      <section className="relative min-h-screen flex items-center bg-white overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_40%,transparent_100%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 relative pt-28 pb-20 sm:pt-32 sm:pb-28">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold text-slate-900 leading-[1.05] tracking-tight"
              >
                Build civic tech
                <span className="block text-blue-900">for the Philippines.</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-4 sm:mt-5 text-sm sm:text-lg text-slate-600 leading-relaxed max-w-lg"
              >
                Join a community of developers, designers, researchers, and advocates building open-source tools for government transparency and accountability.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mt-6 sm:mt-8 flex flex-col gap-2.5"
              >
                <button
                  onClick={handleApplyClick}
                  className="group inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-[6px] bg-blue-900 text-white font-bold text-sm hover:bg-blue-800 transition-all active:scale-[0.96] w-full sm:w-auto"
                >
                  <IdCard size={18} />
                  Apply Now
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
                <a
                  href={DISCORD_INVITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-[6px] border border-slate-300 bg-white text-slate-800 font-bold text-sm hover:border-slate-400 hover:bg-slate-50 transition-all active:scale-[0.96] w-full sm:w-auto"
                >
                  <MessageSquare size={18} />
                  Join Discord
                </a>
              </motion.div>
            </motion.div>
            <div className="flex justify-center lg:justify-end mt-4 sm:mt-0 relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.18, ease: "easeOut" }}
                className="relative"
              >
                <div className="absolute -inset-6 bg-gradient-to-br from-blue-900/10 to-slate-900/5 rounded-[16px] blur-2xl" />
                <div className="relative w-full max-w-[360px] sm:max-w-none">
                  <AccessCard user={mockUser} isDemo />
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.75 }}
                  className="absolute -top-2.5 left-2 sm:-top-3 sm:-left-2 lg:-left-4 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-[6px] flex items-center gap-1.5 sm:gap-2 shadow-md border border-slate-200"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-700 whitespace-nowrap">Verified</span>
                </motion.div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="absolute -bottom-2.5 right-2 sm:-bottom-3 sm:-right-2 lg:-right-4 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-[6px] flex items-center gap-1.5 sm:gap-2 shadow-md border border-slate-200"
              >
                <Users size={12} className="text-blue-900 flex-shrink-0 sm:hidden" />
                <Users size={14} className="text-blue-900 flex-shrink-0 hidden sm:inline-flex" />
                <span className="text-[11px] sm:text-xs font-semibold text-slate-700 whitespace-nowrap">4,600+ Members</span>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-18 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mb-8 sm:mb-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-blue-50 text-blue-900 text-xs font-semibold mb-4">
              <Target size={14} />
              Why We Exist
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 leading-tight tracking-tight">
              The system doesn't fix itself.
              <span className="block text-blue-900">We do.</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4 sm:gap-5 items-stretch">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-[6px] border border-slate-200 p-5 sm:p-7 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-4 sm:mb-5">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-[6px] bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500">
                  <Lock size={15} />
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-[0.15em]">Where We Are</p>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">Current State</h3>
                </div>
              </div>
              <ul className="space-y-2 sm:space-y-2.5 flex-grow">
                {[
                  "Citizens are spectators to governance",
                  "Transparency is a promise, not a practice",
                  "Public data trapped in broken systems",
                  "Bureaucracy moves slower than technology"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 sm:gap-2.5 text-slate-600 text-xs sm:text-sm">
                    <span className="w-3 h-px sm:w-3.5 bg-slate-300 mt-2 sm:mt-2.5 flex-shrink-0 rounded-full" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              className="bg-white rounded-[6px] border border-blue-200 p-5 sm:p-7 flex flex-col shadow-[0_0_0_1px_rgba(30,58,138,0.04),0_2px_10px_-4px_rgba(30,58,138,0.08)]"
            >
              <div className="flex items-center gap-3 mb-4 sm:mb-5">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-[6px] bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900">
                  <Sun size={15} />
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-blue-900 uppercase tracking-[0.15em]">Where We're Going</p>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">BetterGov Approach</h3>
                </div>
              </div>
              <ul className="space-y-2 sm:space-y-2.5 flex-grow">
                {[
                  "Every Filipino is an agent of change",
                  "Government works with us, not above us",
                  "Open data, open code, open by default",
                  "Technology serves bayanihan, not bureaucracy"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 sm:gap-2.5 text-slate-700 text-xs sm:text-sm">
                    <CheckCircle2 size={13} className="text-blue-700 mt-0.5 flex-shrink-0 sm:hidden" />
                    <CheckCircle2 size={14} className="text-blue-700 mt-0.5 flex-shrink-0 hidden sm:inline-flex" />
                    <span className="leading-relaxed font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-18 lg:py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mb-8 sm:mb-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-white border border-slate-200 text-slate-700 text-xs font-semibold mb-4">
              <Flag size={14} />
              Principles
            </div>
            <h2 className="text-2xl sm:text-4xl font-display font-bold text-slate-900 leading-tight tracking-tight">
              What we stand for.
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: <Flag size={18} />, title: "Filipino-First", desc: "Built by Filipinos, for Filipinos" },
              { icon: <Lightbulb size={18} />, title: "Open by Default", desc: "Code, data, and process are public" },
              { icon: <Users size={18} />, title: "Collaboration", desc: "Build together, ship together" },
              { icon: <Zap size={18} />, title: "Urgency", desc: "Ship fast, iterate faster" },
              { icon: <ShieldCheck size={18} />, title: "Rigor", desc: "Verify sources, get it right" },
              { icon: <Heart size={18} />, title: "Accessibility", desc: "Every Filipino can participate" }
            ].map((value, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-[6px] border border-slate-200 p-4 sm:p-5"
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-[6px] bg-blue-50 flex items-center justify-center text-blue-900 mb-2.5 sm:mb-3">
                  {value.icon}
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-1 leading-snug">{value.title}</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">{value.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="open-roles" className="py-12 sm:py-18 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-8 sm:mb-10"
          >
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-blue-50 text-blue-900 text-xs font-semibold mb-4">
                <Users size={14} />
                Open Roles
              </div>
              <h2 className="text-2xl sm:text-4xl font-display font-bold text-slate-900 leading-tight tracking-tight">
                Find how you can contribute.
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              Whether you code, design, research, or organize — there's a place for you here.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role, index) => (
              <motion.a
                key={index}
                href={role.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="bg-white rounded-[6px] border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 group p-5 flex flex-col cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[6px] bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-blue-900 group-hover:border-blue-900 group-hover:text-white transition-all">
                    {role.icon}
                  </div>
                  <span className="text-xs font-bold text-slate-300 group-hover:text-blue-200 transition-colors">
                    {role.number}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center justify-between">
                  {role.title}
                  <ExternalLink size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100" />
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4 flex-grow">{role.description}</p>
                <div className="space-y-2.5 sm:space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 sm:mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.skills.map((skill, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-[4px] bg-slate-50 border border-slate-200 text-slate-600 font-semibold">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <Zap size={12} />
                    <span>{role.commitment}</span>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-8 sm:mt-10 p-4 sm:p-5 rounded-[6px] bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <p className="text-xs sm:text-sm text-slate-600">
              <span className="font-bold text-slate-900">Don't see your role?</span> Join Discord and introduce yourself.
            </p>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-[6px] bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all active:scale-[0.96] w-full sm:w-auto"
            >
              <MessageSquare size={16} />
              Join Discord
            </a>
          </motion.div>
        </div>
      </section>

      <section className="py-10 sm:py-14 bg-slate-50 border-y border-slate-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-6 sm:mb-8"
          >
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
              Built with institutions that trust us
            </p>
          </motion.div>
        </div>
        <div className="relative overflow-hidden w-full">
          <motion.div
            className="flex flex-nowrap shrink-0 gap-8 sm:gap-14 md:gap-18 items-center"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 70, repeat: Infinity, ease: "linear" }}
          >
            {[...Array(4)].flatMap((_, rep) => [
              { name: "BetterGovPH", logo: "https://assets.bettergov.ph/logos/webp/icon-primary.webp" },
              { name: "DICT", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Department_of_Information_and_Communications_Technology_%28DICT%29.svg/960px-Department_of_Information_and_Communications_Technology_%28DICT%29.svg.png" },
              { name: "DBM", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Department_of_Budget_and_Management_%28DBM%29.svg/250px-Department_of_Budget_and_Management_%28DBM%29.svg.png" },
              { name: "PCIJ", logo: "https://i0.wp.com/pcij.org/wp-content/uploads/2024/04/logo-pcij-web.png?w=619&quality=80&ssl=1" },
              { name: "People's Budget Coalition", icon: <Scale size={18} /> },
              { name: "LGUs", icon: <Building2 size={18} /> },
            ]).map((partner, i) => (
              <div
                key={i}
                className="shrink-0 flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-3.5 whitespace-nowrap opacity-80 hover:opacity-100 transition-opacity"
              >
                {'logo' in partner ? (
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="h-8 sm:h-10 md:h-11 w-auto object-contain grayscale hover:grayscale-0 transition-all shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[6px] bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    {partner.icon}
                  </div>
                )}
                <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-slate-600">{partner.name}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="py-12 sm:py-18 lg:py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mb-8 sm:mb-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-white border border-slate-200 text-slate-700 text-xs font-semibold mb-4">
              <Zap size={14} />
              Getting Started
            </div>
            <h2 className="text-2xl sm:text-4xl font-display font-bold text-slate-900 leading-tight tracking-tight">
              Three steps to join.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-4 items-stretch">
            {[
              {
                title: "Join Discord",
                desc: "Meet the community. Say hello, see what's being built.",
                action: "Open Discord",
                href: DISCORD_INVITE
              },
              {
                title: "Fill Out Form",
                desc: "Share your skills and interests. Takes 5 minutes.",
                action: "Apply Now",
                href: "/register"
              },
              {
                title: "Start Building",
                desc: "Pick a project, collaborate, ship impact.",
                action: "Browse Roles",
                href: "#open-roles"
              }
            ].map((item, i) => {
              const LinkComponent = item.href.startsWith('http') ? 'a' : item.href.startsWith('#') ? 'button' : 'button';
              const linkProps = item.href.startsWith('http')
                ? { href: item.href, target: "_blank", rel: "noopener noreferrer" }
                : item.href.startsWith('#')
                  ? { onClick: () => scrollToSection(item.href.replace('#', '')) }
                  : { onClick: () => navigate(item.href) };

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-white rounded-[6px] border border-slate-200 p-5 sm:p-6 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-4 sm:mb-5">
                    <div className="w-8 h-8 rounded-[6px] bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase tracking-widest">Step {i + 1}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4 sm:mb-5 flex-grow">{item.desc}</p>
                  <LinkComponent
                    {...linkProps as any}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-900 hover:gap-2 transition-all w-fit group"
                  >
                    {item.action}
                    <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </LinkComponent>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>



      <section className="relative py-16 sm:py-20 lg:py-24 bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_50%,#000_40%,transparent_100%)]" />
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl"
          >
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-4 sm:mb-5">Join us</p>
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold leading-[1.05] tracking-tight mb-3 sm:mb-4">
              Hindi tayo tumitingin.
              <span className="block text-blue-400 mt-1.5 sm:mt-2">Tayo ang gumagawa.</span>
            </h2>
            <p className="text-sm sm:text-lg text-slate-300 mb-6 sm:mb-8 max-w-xl">
              We don't just watch. Every contributor brings us closer to the government we deserve.
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
              <button
                onClick={handleApplyClick}
                className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-[6px] bg-white text-slate-900 font-bold text-sm hover:bg-blue-50 transition-all active:scale-[0.96] group w-full sm:w-auto"
              >
                <Users size={16} className="sm:hidden" />
                <Users size={18} className="hidden sm:inline-block" />
                Apply Now
                <ArrowRight size={14} className="sm:hidden group-hover:translate-x-0.5 transition-transform" />
                <ArrowRight size={16} className="hidden sm:inline-block group-hover:translate-x-0.5 transition-transform" />
              </button>
              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-[6px] border border-white/20 text-white font-bold text-sm hover:bg-white/5 hover:border-white/35 transition-all active:scale-[0.96] w-full sm:w-auto"
              >
                <MessageSquare size={16} className="sm:hidden" />
                <MessageSquare size={18} className="hidden sm:inline-block" />
                Join Discord
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-300 py-10 sm:py-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
          <div className="grid md:grid-cols-3 gap-8 sm:gap-10 mb-8 sm:mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <img src="https://assets.bettergov.ph/logos/webp/icon-white.webp" alt="BetterGovPH" className="h-8 sm:h-9 w-auto" />
              </div>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-5 max-w-xs">
                Open source civic tech for Philippine transparency and accountability.
              </p>
              <div className="flex gap-2">
                {[
                  { href: DISCORD_INVITE, iconS: <MessageSquare size={14} className="sm:hidden" />, iconL: <MessageSquare size={15} className="hidden sm:inline-block" />, label: "Discord" },
                  { href: GITHUB_ORG, iconS: <Github size={14} className="sm:hidden" />, iconL: <Github size={15} className="hidden sm:inline-block" />, label: "GitHub" },
                  { href: MAIN_WEBSITE, iconS: <Globe size={14} className="sm:hidden" />, iconL: <Globe size={15} className="hidden sm:inline-block" />, label: "Website" }
                ].map((s, i) => (
                  <a
                    key={i}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="w-8 h-8 rounded-[6px] bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-900 hover:text-white transition-colors"
                  >
                    {s.iconS}
                    {s.iconL}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3 sm:mb-4 text-[10px] sm:text-xs uppercase tracking-wider">Join</h4>
              <ul className="space-y-2 sm:space-y-2.5">
                <li><a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">Discord Server</a></li>
                <li><button onClick={() => navigate('/register')} className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">Apply Now</button></li>
                <li><a href={GITHUB_ORG} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">GitHub Organization</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3 sm:mb-4 text-[10px] sm:text-xs uppercase tracking-wider">Portal</h4>
              <ul className="space-y-2 sm:space-y-2.5">
                <li><button onClick={() => navigate('/login')} className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">Sign In</button></li>
                <li><Link to="/projects" className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">Projects</Link></li>
                <li><Link to="/verify" className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">Verify a Card</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 sm:pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
            <p className="text-slate-500 text-[11px] sm:text-xs text-center sm:text-left">
              &copy; {new Date().getFullYear()} BetterGovPH. Built for Filipinos.
            </p>
            <div className="flex gap-4 sm:gap-5">
              <Link to="/privacy" className="text-slate-500 hover:text-white text-[11px] sm:text-xs transition-colors">Privacy</Link>
              <Link to="/terms" className="text-slate-500 hover:text-white text-[11px] sm:text-xs transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;