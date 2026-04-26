import React, { useState, useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import {
  Users,
  ShieldCheck,
  IdCard,
  Globe,
  Zap,
  MessageSquare,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Code2,
  Network
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { AccessCard } from '../../components/AccessCard';
import { User } from '../../types';

const DISCORD_INVITE = "https://discord.com/invite/mHtThpN8bT";
const MAIN_WEBSITE = "https://bettergov.ph/";
const JOIN_US = "https://bettergov.ph/join-us";

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 relative">
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-blue-600 z-[60] origin-left"
        style={{ scaleX }}
      />

      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] bg-blue-100/50 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{
            x: [0, -80, 0],
            y: [0, 100, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[20%] -left-[10%] w-[40%] h-[40%] bg-indigo-100/40 blur-[100px] rounded-full"
        />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-md shadow-sm border-b border-blue-100 py-2' : 'bg-transparent py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="BetterGovPH Logo" className="h-8 w-auto" />
              <span className="font-display font-bold text-xl tracking-tight text-blue-900">BetterGovPH Developer Community</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              {[
                { name: 'Main Website', href: MAIN_WEBSITE, isExternal: true },
                { name: 'Why Join', href: '#why-join' },
                { name: 'How it Works', href: '#how-it-works' },
                { name: 'FAQ', href: '#faq' }
              ].map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  target={link.isExternal ? "_blank" : undefined}
                  rel={link.isExternal ? "noopener noreferrer" : undefined}
                  className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-all hover:scale-105 active:scale-95 relative group"
                >
                  {link.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full" />
                </a>
              ))}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="text-sm font-bold px-5 py-2 rounded-xl border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
              >
                Sign In
              </motion.button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[120px]" />
          <div className="absolute bottom-[10%] right-[-10%] w-[30%] h-[30%] bg-indigo-100/50 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold tracking-wider uppercase mb-6">
                <Zap size={14} className="fill-blue-600" />
                Empowering Public Tech Builders
              </div>
              <h1 className="text-5xl lg:text-7xl font-display font-extrabold text-slate-900 leading-[1.1] mb-6">
                Join the <span className="text-blue-600 relative">BetterGovPH<svg className="absolute -bottom-2 left-0 w-full h-3 text-blue-200 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 25 0 50 5 T 100 5" fill="none" stroke="currentColor" strokeWidth="8" /></svg></span> Developer Community
              </h1>
              <p className="text-xl text-slate-600 mb-8 max-w-lg leading-relaxed">
                Connect with developers, contributors, innovators, and public tech builders shaping BetterGovPH. Get your official Developer Community Access Card today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="btn-primary group">
                  <MessageSquare size={20} />
                  Join Discord Server
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </a>
                <button onClick={handleApplyClick} className="btn-secondary">
                  <IdCard size={20} />
                  Apply for Developer Card
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
              className="flex justify-center items-center"
            >
              <div className="relative">
                {/* Decorative element around the card */}
                <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-2xl opacity-10 blur-2xl -z-10 animate-pulse" />
                <div className="rotate-3 hover:rotate-0 transition-transform duration-500">
                  <AccessCard user={mockUser} isDemo />
                </div>
                {/* Floating tags */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-6 -right-6 glass-card p-3 rounded-xl flex items-center gap-2 shadow-2xl border-white"
                >
                  <div className="bg-green-500 w-2 h-2 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-slate-700">Official Access</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why Join Section */}
      <section id="why-join" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-4">Why Join Our Community?</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Be part of the digital transformation of government services and build tools that matter.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              show: { transition: { staggerChildren: 0.1 } }
            }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {[
              { icon: <ShieldCheck className="text-blue-600" />, title: "Verified Membership", desc: "Get officially recognized as a contributor to the BetterGovPH ecosystem." },
              { icon: <IdCard className="text-blue-600" />, title: "Official Digital Card", title_sub: "Digital Access Card", desc: "A sleek, professional digital ID with unique QR verification and member ID." },
              { icon: <Code2 className="text-blue-600" />, title: "Dev Collaboration", desc: "Work alongside talented engineers and designers on public tech projects." },
              { icon: <Network className="text-blue-600" />, title: "Community Recognition", desc: "Build your reputation and showcase your contributions to the public tech space." },
            ].map((feature, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 }
                }}
                whileHover={{ y: -5 }}
                className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-4">How to Get Started</h2>
            <p className="text-slate-600">Follow these simple steps to join our elite developer network.</p>
          </div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.25
                }
              }
            }}
            className="grid md:grid-cols-5 gap-4 relative"
          >
            {/* Animated Connection Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-10 right-10 h-[2px] bg-slate-100 -z-0 overflow-hidden">
              <motion.div
                variants={{
                  hidden: { width: "0%" },
                  show: { width: "100%", transition: { duration: 2, ease: "easeInOut", delay: 0.5 } }
                }}
                className="h-full bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400"
              />
            </div>

            {[
              { step: "1", title: "Join Discord", desc: "Jump into our community server first." },
              { step: "2", title: "Registration", desc: "Complete the official application form." },
              { step: "3", title: "Verification", desc: "Admin review for community alignment." },
              { step: "4", title: "Approval", desc: "Unique Member ID generation." },
              { step: "5", title: "Receive Card", desc: "Get your official digital access card." }
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, scale: 0.8 },
                  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "backOut" } }
                }}
                className="relative flex flex-col items-center text-center p-6 bg-white z-10"
              >
                {/* Arrow indicator for next step (Desktop) */}
                {i < 4 && (
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      show: { opacity: 1, x: 0, transition: { delay: 1 + i * 0.25 } }
                    }}
                    className="hidden lg:block absolute top-12 -right-4 translate-x-1/2 z-20"
                  >
                    <ChevronRight size={20} className="text-blue-400 animate-pulse" />
                  </motion.div>
                )}

                <motion.div
                  className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mb-6 shadow-lg shadow-blue-500/30 relative"
                >
                  <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20" />
                  <span className="relative z-10">{item.step}</span>
                </motion.div>
                <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-16 p-8 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col md:flex-row items-center gap-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="text-amber-600" />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 mb-1 text-lg">Important Requirement</h4>
              <p className="text-amber-800 text-sm">Users <span className="font-bold uppercase tracking-tight">must</span> be inside the Discord server before they can apply for the card. Applications without a verified Discord presence will be automatically declined.</p>
            </div>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="md:ml-auto btn-primary bg-amber-600 hover:bg-amber-700 shadow-amber-500/20">
              Join Discord Now
            </a>
          </div>
        </div>
      </section>

      {/* Community Benefits Section */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-blue-600 rounded-2xl p-12 lg:p-20 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/20 rounded-full blur-[100px]" />
            <div className="relative z-10">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl lg:text-5xl font-display font-bold mb-8">Community Benefits & Perks</h2>
                  <div className="space-y-6">
                    {[
                      { icon: <Users size={20} />, title: "Developer Collaboration", desc: "Pair up with experts on meaningful public interest projects." },
                      { icon: <Globe size={20} />, title: "Networking Opportunities", desc: "Connect with stakeholders from both government and tech sectors." },
                      { icon: <Zap size={20} />, title: "Gov-Tech Innovation", desc: "Be at the forefront of digital transformation projects." },
                      { icon: <CheckCircle2 size={20} />, title: "Contributor Recognition", desc: "Get credited for your work in official repositories and projects." },
                    ].map((benefit, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                          {benefit.icon}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{benefit.title}</h4>
                          <p className="text-blue-100 text-sm">{benefit.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-center gap-4 h-[400px] overflow-hidden relative">
                  {/* Column 1 */}
                  <motion.div
                    animate={{ y: [0, -400] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="flex flex-col gap-4"
                  >
                    {[...Array(2)].map((_, idx) => (
                      <React.Fragment key={idx}>
                        <div className="h-40 w-40 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 flex items-center justify-center p-6 text-center shrink-0">
                          <span className="text-xs font-bold uppercase tracking-wider">Open Source Contribution</span>
                        </div>
                        <div className="h-48 w-40 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 flex items-center justify-center p-6 text-center shrink-0">
                          <span className="text-xs font-bold text-blue-50 uppercase tracking-wider">Impactful Projects</span>
                        </div>
                      </React.Fragment>
                    ))}
                  </motion.div>

                  {/* Column 2 */}
                  <motion.div
                    animate={{ y: [-400, 0] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="flex flex-col gap-4"
                  >
                    {[...Array(2)].map((_, idx) => (
                      <React.Fragment key={idx}>
                        <div className="h-48 w-40 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 flex items-center justify-center p-6 text-center shrink-0">
                          <span className="text-xs font-bold text-blue-50 uppercase tracking-wider">Career Growth</span>
                        </div>
                        <div className="h-40 w-40 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 flex items-center justify-center p-6 text-center shrink-0">
                          <span className="text-xs font-bold uppercase tracking-wider">Civic Tech Network</span>
                        </div>
                      </React.Fragment>
                    ))}
                  </motion.div>

                  {/* Fade Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-600 via-transparent to-blue-600 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-slate-600">Everything you need to know about the access card program.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.1, delayChildren: 0.2 }
              }
            }}
            className="grid gap-4"
          >
            {[
              { q: "Is Discord membership required?", a: "Yes, it is a mandatory prerequisite. We verify your Discord presence before approving any access card applications to ensure you are part of our active community." },
              { q: "Is the card free?", a: "Absolutely. The BetterGovPH Developer Community Access Card is completely free for all verified community members and contributors." },
              { q: "Who can apply?", a: "We welcome developers, UI/UX designers, data scientists, tech volunteers, and anyone passionate about building better technology for the government." },
              { q: "How long does approval take?", a: "The process typically takes 1-3 business days, depending on admin verification and community activity levels." },
              { q: "Can I use this as an official ID?", a: "This is a digital community access card designed for identification within the BetterGovPH developer network. While it represents verified community status, it is not a government-issued primary ID (like a Passport or UMID)." }
            ].map((faq, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 }
                }}
              >
                <details className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 transition-all shadow-sm cursor-pointer select-none">
                  <summary className="list-none flex justify-between items-center font-bold text-slate-900">
                    <span className="pr-8">{faq.q}</span>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                      <ChevronRight size={18} className="group-open:rotate-90 transition-transform text-slate-400 group-hover:text-blue-600" />
                    </div>
                  </summary>
                  <div className="mt-4 text-slate-600 text-sm leading-relaxed border-t border-slate-50 pt-4 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    {faq.a}
                  </div>
                </details>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 py-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <img src="/logo.svg" alt="BetterGovPH Logo" className="h-8 w-auto" />
                <span className="font-display font-bold text-2xl tracking-tight text-blue-900">BetterGovPH Developer Community
                </span>
              </div>
              <p className="text-slate-500 max-w-sm mb-6">
                Building the future of digital governance in the Philippines through open source, collaboration, and community-driven tech.
              </p>
              <div className="flex gap-4">
                <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">
                  <MessageSquare size={18} />
                </a>
                <a href={MAIN_WEBSITE} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">
                  <Globe size={18} />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase text-xs tracking-widest">Community</h4>
              <ul className="space-y-4">
                <li><a href={DISCORD_INVITE} className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Join Discord</a></li>
                <li><a href={JOIN_US} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Join the Mission</a></li>
                <li><a href="https://github.com/BetterGovPH" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Open Source Repos</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase text-xs tracking-widest">Developer Portal</h4>
              <ul className="space-y-4">
                <li><button onClick={() => navigate('/login')} className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Login</button></li>
                <li><button onClick={() => navigate('/register')} className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Apply for Card</button></li>
                <li><a href="/verify" className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Verify a Card</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-xs tracking-tight">
              &copy; {new Date().getFullYear()} BetterGovPH. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-slate-400 hover:text-blue-600 text-xs transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="text-slate-400 hover:text-blue-600 text-xs transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
