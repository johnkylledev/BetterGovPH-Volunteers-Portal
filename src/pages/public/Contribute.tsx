import React from 'react';
import {
  Code2,
  Palette,
  Database,
  Search,
  Megaphone,
  Github,
  CheckCircle2,
  ArrowRight,
  Heart,
  Zap,
  Users,
  MessageSquare,
  Globe,
  BarChart3
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Navbar } from '../../components/Navbar';

const DISCORD_INVITE = "https://discord.com/invite/mHtThpN8bT";
const MAIN_WEBSITE = "https://bettergov.ph/";
const GITHUB_ORG = "https://github.com/BetterGovPH";

const Contribute: React.FC = () => {
  const navigate = useNavigate();

  const roles = [
    {
      title: "Frontend Developer",
      description: "React, TypeScript, Tailwind. Build accessible interfaces that bring government data to people.",
      skills: ["React", "TypeScript", "Tailwind", "A11y"],
      time: "5-10 hrs/week",
      icon: <Code2 size={20} />,
      href: GITHUB_ORG + "/issues?q=label%3Afrontend"
    },
    {
      title: "Backend Developer",
      description: "Node.js, Python, PostgreSQL. Design APIs and infrastructure that scale with the movement.",
      skills: ["Node.js or Python", "PostgreSQL", "API Design", "ETL"],
      time: "5-10 hrs/week",
      icon: <Database size={20} />,
      href: GITHUB_ORG + "/issues?q=label%3Abackend"
    },
    {
      title: "Data Engineer",
      description: "Extract, clean, and load public data. Turn PDFs and spreadsheets into usable datasets.",
      skills: ["Python", "Pipelines", "Scraping", "SQL"],
      time: "5-10 hrs/week",
      icon: <BarChart3 size={20} />,
      href: GITHUB_ORG + "/issues?q=label%3Adata"
    },
    {
      title: "Researcher",
      description: "Analyze budgets, track procurement, verify sources. Find the stories in the numbers.",
      skills: ["Budget Analysis", "Research", "Verification", "Writing"],
      time: "3-5 hrs/week",
      icon: <Search size={20} />,
      href: GITHUB_ORG + "/issues?q=label%3Aresearch"
    },
    {
      title: "Designer",
      description: "Make complex data usable. Information design, UI/UX, accessibility for every Filipino.",
      skills: ["UI/UX", "Info Design", "Figma", "A11y"],
      time: "3-5 hrs/week",
      icon: <Palette size={20} />,
      href: GITHUB_ORG + "/issues?q=label%3Adesign"
    },
    {
      title: "Community Advocate",
      description: "Share the work. Write, post, organize. Transparency only works when people see it.",
      skills: ["Social Media", "Writing", "Community"],
      time: "2-3 hrs/week",
      icon: <Megaphone size={20} />,
      href: DISCORD_INVITE
    }
  ];

  const codeStandards = [
    "Clean, readable code",
    "Follow existing patterns",
    "Accessibility first",
    "Mobile responsive",
    "TypeScript for type safety",
    "No dependencies without discussion"
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">

      <Navbar />

      <section className="relative bg-white overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_40%,transparent_100%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative pt-28 pb-16 sm:pt-32 sm:pb-22">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-slate-50 border border-slate-200 mb-5 sm:mb-6"
            >
              <Heart size={14} className="text-blue-900" />
              <span className="text-[11px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider">Contribute</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold leading-[1.05] tracking-tight"
            >
              Contribute your skills.
              <span className="block text-blue-900 mt-1.5">Move the country forward.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-4 sm:mt-5 text-sm sm:text-lg text-slate-600 leading-relaxed max-w-2xl"
            >
              Join a community of volunteers, designers, researchers, and advocates building open-source tools for Philippine transparency and accountability.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-6 sm:mt-8 flex flex-col gap-2.5 sm:flex-row sm:gap-3"
            >
              <button
                onClick={() => navigate('/register')}
                className="group inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-[6px] bg-blue-900 text-white font-bold text-sm hover:bg-blue-800 transition-all active:scale-[0.96] w-full sm:w-auto"
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
                className="group inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-[6px] border border-slate-300 bg-white text-slate-800 font-bold text-sm hover:border-slate-400 hover:bg-slate-50 transition-all active:scale-[0.96] w-full sm:w-auto"
              >
                <MessageSquare size={16} className="sm:hidden" />
                <MessageSquare size={18} className="hidden sm:inline-block" />
                Join Discord
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mb-8 sm:mb-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-white border border-slate-200 text-slate-700 text-xs font-semibold mb-4">
              <Users size={14} />
              Open Roles
            </div>
            <h2 className="text-2xl sm:text-4xl font-display font-bold leading-tight tracking-tight">
              Find how you can contribute.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role, i) => (
              <motion.a
                key={i}
                href={role.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="bg-white rounded-[6px] border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 group p-5 flex flex-col cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[6px] bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-blue-900 group-hover:border-blue-900 group-hover:text-white transition-all">
                    {role.icon}
                  </div>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">0{i + 1}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center justify-between">
                  {role.title}
                  <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100" />
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4 flex-grow">{role.description}</p>
                <div className="space-y-2.5 sm:space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.skills.map((skill, j) => (
                        <span key={j} className="text-[11px] px-2 py-0.5 rounded-[4px] bg-slate-50 border border-slate-200 text-slate-600 font-semibold">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <Zap size={12} />
                    <span>{role.time}</span>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-18 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-10 items-start">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="max-w-lg"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold mb-5">
                <Github size={14} />
                Open Source
              </div>
              <h2 className="text-2xl sm:text-4xl font-display font-bold leading-tight tracking-tight mb-4 sm:mb-5">
                Code public, work public.
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-5 sm:mb-6">
                Everything is open source. Fork it, improve it, submit a PR. We review fast and merge faster.
              </p>
              <a
                href={GITHUB_ORG}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[6px] bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all active:scale-[0.96] group w-full sm:w-auto"
              >
                <Github size={16} />
                github.com/BetterGovPH
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              className="bg-white rounded-[6px] border border-slate-200 p-5 sm:p-7"
            >
              <h3 className="text-sm font-bold text-slate-900 mb-4 sm:mb-5 flex items-center gap-2">
                <CheckCircle2 size={15} className="text-blue-900 sm:hidden" />
                <CheckCircle2 size={16} className="text-blue-900 hidden sm:inline-block" />
                Code Standards
              </h3>
              <div className="grid sm:grid-cols-2 gap-2 sm:gap-2.5">
                {codeStandards.map((standard, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm">
                    <CheckCircle2 size={13} className="text-blue-700 flex-shrink-0 mt-0.5 sm:hidden" />
                    <CheckCircle2 size={14} className="text-blue-700 flex-shrink-0 mt-0.5 hidden sm:inline-flex" />
                    <span className="text-slate-700">{standard}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-20 lg:py-24 bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_50%,#000_40%,transparent_100%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
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
                onClick={() => navigate('/register')}
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
              <a
                href={GITHUB_ORG}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-[6px] border border-white/20 text-white font-bold text-sm hover:bg-white/5 hover:border-white/35 transition-all active:scale-[0.96] w-full sm:w-auto"
              >
                <Github size={16} className="sm:hidden" />
                <Github size={18} className="hidden sm:inline-block" />
                View GitHub
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-300 py-10 sm:py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                  { href: MAIN_WEBSITE, iconS: <Globe size={14} className="sm:hidden" />, iconL: <Globe size={15} className="hidden sm:inline-block" />, label: "Website" },
                  { href: GITHUB_ORG, iconS: <Github size={14} className="sm:hidden" />, iconL: <Github size={15} className="hidden sm:inline-block" />, label: "GitHub" }
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
              <h4 className="font-bold text-white mb-3 sm:mb-4 text-[10px] sm:text-xs uppercase tracking-wider">Community</h4>
              <ul className="space-y-2 sm:space-y-2.5">
                <li><a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">Discord Server</a></li>
                <li><a href={GITHUB_ORG} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">GitHub Organization</a></li>
                <li><Link to="/projects" className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">Community Projects</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3 sm:mb-4 text-[10px] sm:text-xs uppercase tracking-wider">Portal</h4>
              <ul className="space-y-2 sm:space-y-2.5">
                <li><button onClick={() => navigate('/login')} className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">Sign In</button></li>
                <li><button onClick={() => navigate('/register')} className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">Apply Now</button></li>
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

export default Contribute;
