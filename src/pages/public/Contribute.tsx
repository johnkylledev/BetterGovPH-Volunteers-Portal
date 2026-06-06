import React, { useState, useEffect } from 'react';
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
  ExternalLink
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
      number: "01",
      title: "Frontend Developers",
      description: "Build fast, accessible, beautiful interfaces. React, TypeScript, Tailwind. Modern stack, meaningful work.",
      skills: ["React", "TypeScript", "Tailwind CSS", "Accessibility"],
      time: "5-10 hours/week",
      icon: <Code2 size={28} />
    },
    {
      number: "02",
      title: "Backend Developers",
      description: "Design APIs, wrangle data, build infrastructure. Node.js, Python, PostgreSQL. Scale matters here.",
      skills: ["Node.js or Python", "PostgreSQL", "API Design", "Data Processing"],
      time: "5-10 hours/week",
      icon: <Database size={28} />
    },
    {
      number: "03",
      title: "Data Engineers",
      description: "Extract, transform, load government data. Build pipelines. Make sense of PDFs and spreadsheets.",
      skills: ["Python", "Data Pipelines", "Web Scraping", "SQL"],
      time: "5-10 hours/week",
      icon: <Database size={28} />
    },
    {
      number: "04",
      title: "Researchers",
      description: "Analyze budgets, track procurement, verify data accuracy. Find the stories in the numbers.",
      skills: ["Budget Analysis", "Research", "Data Verification", "Writing"],
      time: "3-5 hours/week",
      icon: <Search size={28} />
    },
    {
      number: "05",
      title: "Designers",
      description: "Make government data beautiful and usable. Information design, UI/UX, accessibility.",
      skills: ["UI/UX Design", "Information Design", "Figma", "Accessibility"],
      time: "3-5 hours/week",
      icon: <Palette size={28} />
    },
    {
      number: "06",
      title: "Amplifiers",
      description: "Share our work. Write about it. Talk about it. Transparency only works if people see it.",
      skills: ["Social Media", "Writing", "Community Building"],
      time: "2-3 hours/week",
      icon: <Megaphone size={28} />
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

  const promises = [
    {
      number: "1",
      text: "Your time will create lasting change"
    },
    {
      number: "2",
      text: "Your skills will serve your kababayans"
    },
    {
      number: "3",
      text: "Your passion will find purpose"
    },
    {
      number: "4",
      text: "Your involvement will write history"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      <Navbar />

      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-900 text-sm font-bold mb-6">
              <Heart size={16} className="fill-blue-900" />
              Our Call to Action
            </div>
            <h1 className="text-4xl lg:text-6xl font-display font-extrabold text-slate-900 leading-[1.1] mb-6">
              We Are Volunteer Warriors for Democracy
            </h1>
            <p className="text-lg lg:text-xl text-slate-600 mb-4 leading-relaxed">
              BetterGov.ph is not an organization—it's an <span className="font-bold text-slate-900">uprising of conscience.</span>
            </p>
            <p className="text-base lg:text-lg text-slate-600 mb-8 leading-relaxed">
              We are developers who code for country, not just career. Researchers who dig for truth, not profit. Organizers who build bridges between citizens and government.
            </p>
            <div className="flex flex-col items-center gap-4 mb-8">
              <h2 className="text-2xl lg:text-3xl font-bold text-blue-900">Kaya natin 'to.</h2>
              <p className="text-lg text-slate-700">We can build the democracy we deserve.</p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-4">
              Every Filipino Has a Role
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">
              Your skills matter. Your passion matters. Whether you code, research, organize, or simply care—this movement needs you.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {roles.map((role, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -8 }}
                className="bg-white p-8 rounded-2xl border-2 border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 group"
              >
                <div className="flex items-start justify-between mb-6">
                  <span className="text-5xl font-display font-bold text-slate-200 group-hover:text-blue-100 transition-colors">
                    {role.number}
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-900 group-hover:bg-blue-900 group-hover:text-white transition-colors">
                    {role.icon}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{role.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">{role.description}</p>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {role.skills.map((skill, i) => (
                        <span key={i} className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Time</p>
                    <p className="text-sm font-semibold text-slate-900">{role.time}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-bold mb-6">
                <Github size={16} />
                Open Source
              </div>
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-slate-900 mb-6">
                Contribute Code
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-6">
                All our code is open source. Fork it, improve it, submit a PR. We review fast and merge faster.
              </p>
              <a
                href={GITHUB_ORG}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-900 font-bold hover:gap-3 transition-all group"
              >
                <Github size={20} />
                github.com/bettergovph
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <p className="text-slate-500 text-sm mt-8 italic">
                All contributions are welcome.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6">Code Standards</h3>
              <div className="space-y-3">
                {codeStandards.map((standard, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 size={14} className="text-green-600" />
                    </div>
                    <p className="text-slate-700 text-sm">{standard}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-900 text-sm font-bold mb-6">
              <Heart size={16} className="fill-blue-900" />
              Our Promise
            </div>
            <h2 className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-4">
              To Every Filipino Who Joins This Movement
            </h2>
          </motion.div>

          <div className="max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">We Promise</h3>
            <div className="grid gap-6">
              {promises.map((promise, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-6 p-6 rounded-2xl bg-blue-50 border border-blue-100"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-xl shrink-0">
                    {promise.number}
                  </div>
                  <p className="text-slate-900 text-lg font-medium pt-2">{promise.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24 bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-bold mb-8">
              <Zap size={16} className="fill-white" />
              Our Battle Cry
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold mb-4">Hindi Tayo Tumitingin.</h2>
            <h1 className="text-5xl lg:text-7xl font-display font-extrabold mb-8">Tayo Ang Gumagawa.</h1>
            <p className="text-xl lg:text-2xl text-blue-100 mb-12">We don't just watch. We build.</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-blue-900 font-bold text-base hover:bg-blue-50 transition-all shadow-xl active:scale-95 group"
              >
                <MessageSquare size={20} />
                Join Discord
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href={GITHUB_ORG}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl border-2 border-white text-white font-bold text-base hover:bg-white hover:text-blue-900 transition-all active:scale-95 group"
              >
                <Github size={20} />
                View GitHub
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl border-2 border-white text-white font-bold text-base hover:bg-white hover:text-blue-900 transition-all active:scale-95 group"
              >
                <Users size={20} />
                Apply for Card
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="bg-slate-50/80 py-20 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <img src="/logo.svg" alt="BetterGovPH Logo" className="h-8 w-auto" />
                <div className="flex flex-col leading-none">
                  <span className="font-display font-bold text-xl tracking-tight text-blue-900">BetterGovPH</span>
                  <span className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-blue-600/70">Developer Community</span>
                </div>
              </div>
              <p className="text-slate-500 max-w-sm mb-6">
                Building the future of digital governance in the Philippines through open source, collaboration, and community-driven tech.
              </p>
              <div className="flex gap-4">
                <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-900 hover:text-white hover:border-blue-900 transition-all shadow-sm">
                  <MessageSquare size={18} />
                </a>
                <a href={MAIN_WEBSITE} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-900 hover:text-white hover:border-blue-900 transition-all shadow-sm">
                  <Globe size={18} />
                </a>
                <a href={GITHUB_ORG} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-900 hover:text-white hover:border-blue-900 transition-all shadow-sm">
                  <Github size={18} />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase text-xs tracking-widest">Community</h4>
              <ul className="space-y-4">
                <li><a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-900 text-sm transition-colors">Join Discord</a></li>
                <li><a href={GITHUB_ORG} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-900 text-sm transition-colors">Open Source Repos</a></li>
                <li><Link to="/contribute" className="text-slate-500 hover:text-blue-900 text-sm transition-colors">How to Contribute</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase text-xs tracking-widest">Developer Portal</h4>
              <ul className="space-y-4">
                <li><button onClick={() => navigate('/login')} className="text-slate-500 hover:text-blue-900 text-sm transition-colors">Login</button></li>
                <li><button onClick={() => navigate('/register')} className="text-slate-500 hover:text-blue-900 text-sm transition-colors">Apply for Card</button></li>
                <li><Link to="/projects" className="text-slate-500 hover:text-blue-900 text-sm transition-colors">Projects</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">© 2025 BetterGovPH. Built with ❤️ for the Filipino people.</p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-slate-400 hover:text-blue-900 text-sm transition-colors">Privacy</Link>
              <Link to="/terms" className="text-slate-400 hover:text-blue-900 text-sm transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Contribute;
