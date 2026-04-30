import React, { useState, useEffect } from 'react';
import {
  Target,
  Server,
  Heart,
  Star,
  Building2,
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
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { motion } from 'framer-motion';

gsap.registerPlugin(ScrollTrigger);

const DISCORD_INVITE = "https://discord.com/invite/mHtThpN8bT";
const MAIN_WEBSITE = "https://bettergov.ph/";
const JOIN_US = "https://bettergov.ph/join-us";

const Landing: React.FC = () => {
  const navigate = useNavigate();


  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Add click handlers for navigation links
  const handleExternalLink = (url: string) => {
    if (url.startsWith('http')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      scrollToSection(url.replace('#', ''));
    }
  };

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

  const containerRef = React.useRef<HTMLDivElement>(null);
  const heroRef = React.useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Hero Entrance - High Precision Reveal
    const tl = gsap.timeline();

    tl.from('.hero-badge', {
      y: -30,
      opacity: 0,
      duration: 0.8,
      ease: 'back.out(1.7)'
    }).from('.hero-title-word', {
      y: 40,
      opacity: 0,
      rotateX: -45,
      duration: 1,
      stagger: 0.1,
      ease: 'power4.out'
    }, '-=0.4').from('.hero-desc', {
      y: 20,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.6').from('.hero-btns > *', {
      x: -30,
      opacity: 0,
      duration: 0.6,
      stagger: 0.2,
      ease: 'power2.out'
    }, '-=0.4').from('.hero-card', {
      x: 100,
      opacity: 0,
      scale: 0.8,
      duration: 1.5,
      ease: 'elastic.out(1, 0.5)'
    }, '-=1.2');

    // Reveal Sections with Staggered Children
    gsap.utils.toArray<HTMLElement>('.reveal-section').forEach((section) => {
      const items = section.querySelectorAll('.reveal-item');
      if (items.length > 0) {
        gsap.from(items, {
          scrollTrigger: {
            trigger: section,
            start: 'top 85%',
            toggleActions: 'play none none reverse'
          },
          y: 30,
          opacity: 0,
          scale: 0.98,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power2.out'
        });
      }
    });

    // Parallax & Interactive Tilt
    gsap.to('.hero-card', {
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: 1
      },
      y: 80,
      rotation: 5,
      ease: 'none'
    });

    const heroCard = document.querySelector('.hero-card');
    if (heroCard) {
      window.addEventListener('mousemove', (e) => {
        const { clientX, clientY } = e;
        const x = (clientX - window.innerWidth / 2) / 60;
        const y = (clientY - window.innerHeight / 2) / 60;
        gsap.to(heroCard, {
          rotationY: x,
          rotationX: -y,
          duration: 1.2,
          ease: 'power2.out'
        });
      });
    }

    // Stats Counter Animation
    gsap.utils.toArray<HTMLElement>('.stat-value').forEach((stat) => {
      const target = parseInt(stat.getAttribute('data-value') || '0');
      gsap.from(stat, {
        scrollTrigger: {
          trigger: stat,
          start: 'top 90%'
        },
        innerHTML: 0,
        duration: 2,
        snap: { innerHTML: 1 },
        ease: 'power1.out'
      });
    });
  }, { scope: containerRef });

  const handleApplyClick = () => {
    navigate('/register');
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 relative">




      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-md shadow-sm py-2' : 'bg-transparent py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="BetterGovPH Logo" className="h-8 w-auto" />
              <div className="flex flex-col leading-none">
                <span className="font-display font-bold text-lg tracking-tight text-blue-900">BetterGovPH</span>
                <span className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-blue-600/70">Developer Community</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link
                to="/projects"
                className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-all hover:scale-105 active:scale-95 relative group"
              >
                Projects
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full" />
              </Link>
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
      <section className="hero-section relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">


        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="hero-content">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold tracking-wider uppercase mb-6">
                <Zap size={14} className="fill-blue-600" />
                Empowering Public Tech Builders
              </div>
              <h1 className="text-5xl lg:text-7xl font-display font-extrabold text-slate-900 leading-[1.1] mb-6">
                Join the <span className="text-blue-600">BetterGovPH</span> Developer Community
              </h1>
              <p className="text-xl text-slate-600 mb-8 max-w-lg leading-relaxed">
                Connect with developers, contributors, innovators, and public tech builders shaping BetterGovPH. Get your official Developer Community Access Card today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="btn-primary group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 active:scale-[0.98]">
                  <MessageSquare size={20} />
                  Join Discord Server
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </a>
                <button onClick={handleApplyClick} className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border-2 border-slate-300 bg-white text-slate-900 font-bold text-sm hover:border-blue-600 hover:text-blue-600 transition-all shadow-sm active:scale-[0.98]">
                  <IdCard size={20} />
                  Apply for Developer Card
                </button>
              </div>
            </div>

            <div className="hero-card flex justify-center items-center">
              <div className="relative">
                {/* Decorative element around the card */}
                <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-2xl opacity-10 blur-2xl -z-10 animate-pulse" />
                <div className="rotate-3 hover:rotate-0 transition-transform duration-500">
                  <AccessCard user={mockUser} isDemo />
                </div>
                <div className="absolute -top-6 -right-6 glass-card p-3 rounded-xl flex items-center gap-2 shadow-2xl border-white">
                  <div className="bg-green-500 w-2 h-2 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-slate-700">Official Access</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Mission Section */}
      <section id="mission" className="reveal-section py-24 lg:py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-6 shadow-inner"
          >
            <Target size={24} />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-4"
          >
            Our Mission
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 max-w-2xl mx-auto mb-12 text-lg leading-relaxed"
          >
            We're not just building websites -- we're building the future of governance in the Philippines.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-blue-50/50 backdrop-blur-sm border border-blue-100/50 rounded-2xl p-8 md:p-12 max-w-4xl w-full text-left shadow-xl shadow-blue-900/5"
          >
            <p className="text-slate-700 text-lg md:text-xl leading-relaxed mb-8">
              BetterGov is a <span className="font-bold text-slate-900">volunteer-led tech initiative</span> committed to creating
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-bold mx-2 shadow-lg shadow-blue-600/20">
                <Zap size={14} className="fill-white" />
                #civictech
              </span>
              projects aimed at making government more transparent, efficient, and accessible to citizens.
            </p>
            <p className="text-slate-700 text-lg md:text-xl leading-relaxed">
              We've seen a surge of wonderful and impressive tech ideas being launched recently. Our goal is to
              <span className="font-bold text-slate-900"> support, promote, consolidate, and empower</span> these builders!
            </p>
          </motion.div>
        </div>
      </section>

      {/* What We Provide Section */}
      <section id="what-we-provide" className="reveal-section py-24 lg:py-32 bg-slate-50/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-4"
            >
              What We Provide
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed"
            >
              Everything you need to build impactful civic tech projects
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: <Server size={20} />,
                title: "Infrastructure & Tools",
                desc: "Servers, AI credits, development tools, and more!"
              },
              {
                icon: <Users size={20} />,
                title: "Tech Hackathons",
                desc: "Regular events to collaborate and build together"
              },
              {
                icon: <Globe size={20} />,
                title: "Data & APIs",
                desc: "Access to government data and API endpoints"
              },
              {
                icon: <Heart size={20} />,
                title: "Find Your Team",
                desc: "Connect with the right people and resource persons"
              },
              {
                icon: <Star size={20} />,
                title: "Industry Mentorship",
                desc: "Guidance from seasoned tech and startup veterans"
              },
              {
                icon: <Building2 size={20} />,
                title: "Office Space",
                desc: "Physical workspace for collaboration and meetings"
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -8 }}
                className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:shadow-blue-900/10 transition-all duration-300 group h-full flex flex-col"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 flex-shrink-0">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug">{item.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed flex-grow">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Join Section */}
      <section id="why-join" className="reveal-section py-24 lg:py-32 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-4">Why Join Our Community?</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">Be part of the digital transformation of government services and build tools that matter.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              show: { transition: { staggerChildren: 0.1 } }
            }}
            className="grid md:grid-cols-2 lg:grid-cols-2 gap-6 sm:gap-8"
          >
            {[
              { icon: <ShieldCheck size={32} className="text-blue-600" />, title: "Verified Membership", desc: "Get officially recognized as a contributor to the BetterGovPH ecosystem." },
              { icon: <IdCard size={32} className="text-blue-600" />, title: "Official Digital Card", desc: "A sleek, professional digital ID with unique QR verification and member ID." },
              { icon: <Code2 size={32} className="text-blue-600" />, title: "Dev Collaboration", desc: "Work alongside talented engineers and designers on public tech projects." },
              { icon: <Network size={32} className="text-blue-600" />, title: "Community Recognition", desc: "Build your reputation and showcase your contributions to the public tech space." },
            ].map((feature, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 }
                }}
                whileHover={{ y: -8 }}
                className="p-8 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-900/5 transition-all duration-300 h-full flex flex-col"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 shrink-0">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3 leading-snug">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm flex-grow">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="reveal-section py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl lg:text-5xl font-display font-bold text-slate-900 mb-6"
            >
              How to Get Started
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-slate-600 text-lg leading-relaxed"
            >
              Become a pioneer in the civic tech movement.
            </motion.p>
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
                className="relative flex flex-col items-center text-center p-6 bg-white z-10 rounded-2xl border border-slate-100"
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
                <h3 className="font-bold text-slate-900 mb-2 text-base">{item.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-16 p-8 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center justify-center shrink-0">
              <ShieldCheck size={28} className="text-amber-600" />
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

      {/* FAQ Section */}
      <section id="faq" className="py-24 lg:py-32 bg-white">
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
                <li><a href="https://github.com/BetterGovPH\" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Open Source Repos</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase text-xs tracking-widest">Developer Portal</h4>
              <ul className="space-y-4">
                <li><button onClick={() => navigate('/login')} className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Login</button></li>
                <li><button onClick={() => navigate('/register')} className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Apply for Card</button></li>
                <li><Link to="/verify" className="text-slate-500 hover:text-blue-600 text-sm transition-colors">Verify a Card</Link></li>
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
