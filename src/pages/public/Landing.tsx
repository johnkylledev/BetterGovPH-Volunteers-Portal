import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { AccessCard } from '../../components/AccessCard';
import { User } from '../../types';
import { SiteLayout } from '../../components/site/SiteLayout';
import { Reveal } from '../../components/site/Reveal';
import { RoleList, JoinBand } from '../../components/site/Sections';
import { Contributors } from '../../components/site/Contributors';
import { DISCORD_INVITE } from '../../components/site/links';

const EASE = [0.23, 1, 0.32, 1] as const;

const CURRENT_STATE = [
  'Citizens are spectators to governance',
  'Transparency is a promise, not a practice',
  'Public data is trapped in broken systems',
  'Bureaucracy moves slower than technology',
];

const BETTERGOV_APPROACH = [
  'Every Filipino can be an agent of change',
  'Government works with us, not above us',
  'Open data, open code, open by default',
  'Technology serves bayanihan, not bureaucracy',
];

const PRINCIPLES = [
  { title: 'Filipino-first', desc: 'Built by Filipinos, for the people who actually use public services.' },
  { title: 'Open by default', desc: 'Code, data, and decisions happen in public where anyone can check them.' },
  { title: 'Build together', desc: 'Small teams, shared ownership, credit where it’s due.' },
  { title: 'Ship it', desc: 'A working tool today beats a perfect plan next year.' },
  { title: 'Get it right', desc: 'Cite sources and verify numbers before anything goes out.' },
  { title: 'For everyone', desc: 'Accessible on any phone, any connection, in plain language.' },
];

const STEPS = [
  { title: 'Say hello on Discord', desc: 'Meet the community and see what’s being built right now.', action: 'Open Discord', href: DISCORD_INVITE },
  { title: 'Apply for membership', desc: 'Tell us your skills and interests. It takes about five minutes.', action: 'Start application', href: '/register' },
  { title: 'Pick something to build', desc: 'Choose an open issue, join a project team, and ship.', action: 'See open roles', href: '#open-roles' },
];

const PARTNERS: { name: string; logo?: string }[] = [
  { name: 'DICT', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Department_of_Information_and_Communications_Technology_%28DICT%29.svg/120px-Department_of_Information_and_Communications_Technology_%28DICT%29.svg.png' },
  { name: 'DBM', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Department_of_Budget_and_Management_%28DBM%29.svg/120px-Department_of_Budget_and_Management_%28DBM%29.svg.png' },
  { name: 'LGUs', logo: 'https://1000logos.net/wp-content/uploads/2019/03/DILG-Logo.png' },
  { name: 'PCIJ', logo: 'https://i0.wp.com/pcij.org/wp-content/uploads/2024/04/logo-pcij-web.png?w=200&quality=80&ssl=1' },
  { name: 'People’s Budget Coalition' },
];

const demoUser: User = {
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

const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

const SectionHead: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <Reveal className="mb-10 max-w-2xl">
    <h2 className="text-[28px] sm:text-[36px]">{title}</h2>
    {children && <p className="mt-3 text-[16px] leading-relaxed text-[var(--fg-2)]">{children}</p>}
  </Reveal>
);

const Landing: React.FC = () => {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (window.location.hash === '#open-roles') {
      const timer = setTimeout(() => scrollToId('open-roles'), 200);
      return () => clearTimeout(timer);
    }
  }, []);

  const enter = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease: EASE, delay },
  });

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-20 sm:pt-20 sm:pb-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <motion.h1 {...enter(0.04)} className="text-[40px] sm:text-[56px] lg:text-[60px] tracking-[-0.04em] leading-[1.02]">
              Build the public tools the Philippines deserves.
            </motion.h1>
            <motion.p {...enter(0.1)} className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-[var(--fg-2)]">
              We're a volunteer community of developers, designers, researchers, and advocates making government data
              open, readable, and accountable. Everything we ship is open source.
            </motion.p>
            <motion.div {...enter(0.16)} className="mt-9 flex flex-col gap-2.5 sm:flex-row">
              <Link to="/register" className="s-btn s-btn-accent h-11 px-5">
                Apply for membership
                <ArrowRight size={16} strokeWidth={1.75} />
              </Link>
              <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="s-btn s-btn-plain h-11 px-5">
                Join the Discord
              </a>
            </motion.div>
            <motion.p {...enter(0.2)} className="mt-6 text-[14px] text-[var(--fg-3)]">
              Already a member? Anyone can{' '}
              <Link to="/verify" className="s-link">verify a card</Link>.
            </motion.p>
          </div>

          <motion.figure
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
            className="mx-auto w-full max-w-[420px] lg:mr-0"
          >
            <div className="flex justify-center rounded-[22px] bg-[#eef1f5] px-6 py-10 shadow-[inset_0_1px_2px_rgb(15_23_42/0.06),inset_0_0_0_1px_rgb(15_23_42/0.04)] sm:py-12">
              <AccessCard user={demoUser} isDemo />
            </div>
            <figcaption className="mt-4 px-1 text-[13px] leading-relaxed text-[var(--fg-3)]">
              <span className="font-medium text-[var(--fg)]">The access card.</span>{' '}
              Every approved member gets one. Its QR code opens a public page anyone can check.
            </figcaption>
          </motion.figure>
        </div>
      </section>

      {/* Why */}
      <section className="border-t border-[var(--line)] bg-[var(--card)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 py-20 sm:py-28 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)] lg:gap-20">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-[30px] sm:text-[40px]">The system doesn’t fix itself. We do.</h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[var(--fg-2)]">
              Four things we think are broken about how Filipinos experience government — and what we build instead.
            </p>
            <Link to="/projects" className="group mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--accent)]">
              See what we’ve shipped
              <ArrowRight size={14} strokeWidth={1.75} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="overflow-hidden rounded-[18px] bg-[var(--bg)] shadow-[inset_0_0_0_1px_var(--line)]">
              <div className="hidden grid-cols-[2.5rem_1fr_1fr] gap-6 border-b border-[var(--line)] px-6 py-3 text-[12px] font-medium sm:grid">
                <span />
                <span className="text-[var(--fg-3)]">Today</span>
                <span className="text-[var(--accent)]">What we’re building</span>
              </div>
              <ol className="divide-y divide-[var(--line)]">
                {CURRENT_STATE.map((problem, i) => (
                  <li key={problem} className="grid grid-cols-[2.5rem_1fr] gap-x-6 gap-y-2 px-6 py-6 sm:grid-cols-[2.5rem_1fr_1fr] sm:items-baseline">
                    <span className="num row-span-2 text-[13px] text-[var(--fg-3)] sm:row-span-1">0{i + 1}</span>
                    <p className="text-[15px] leading-snug text-[var(--fg-3)] line-through decoration-slate-300 decoration-1">
                      {problem}
                    </p>
                    <p className="text-[17px] font-medium leading-snug tracking-[-0.012em] text-[var(--fg)]">
                      {BETTERGOV_APPROACH[i]}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Principles */}
      <section className="border-t border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
          <SectionHead title="How we work." />
          <Reveal>
            <dl className="grid gap-x-12 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="border-t border-[var(--line)] pt-5">
                  <dt className="text-[16px] font-semibold tracking-[-0.012em]">{p.title}</dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--fg-2)]">{p.desc}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* Open roles */}
      <section id="open-roles" className="scroll-mt-14 border-t border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
          <SectionHead title="Find where you fit.">
            Each role links to open issues on GitHub. Pick one that looks interesting and say so in the thread.
          </SectionHead>
          <RoleList />
        </div>
      </section>

      {/* Partners */}
      <section className="border-t border-[var(--line)] bg-[var(--card)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
          <p className="text-center text-[13px] text-[var(--fg-3)]">Built alongside</p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {PARTNERS.map((p) => (
              <li key={p.name} className="flex items-center gap-2.5 text-[14px] font-medium text-[var(--fg-3)]">
                {p.logo && (
                  <img src={p.logo} alt="" loading="lazy" decoding="async" height={32} className="h-8 w-auto object-contain opacity-70 grayscale" />
                )}
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How to join */}
      <section className="border-t border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
          <SectionHead title="Three steps to join." />
          <Reveal>
            <ol className="grid gap-px overflow-hidden rounded-[14px] bg-[var(--line)] shadow-[0_0_0_1px_var(--line)] md:grid-cols-3">
              {STEPS.map((step, i) => {
                const isExternal = step.href.startsWith('http');
                const isAnchor = step.href.startsWith('#');
                const linkClass = 'group mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--accent)]';
                const arrow = <ArrowRight size={14} strokeWidth={1.75} className="transition-transform duration-200 group-hover:translate-x-0.5" />;
                return (
                  <li key={step.title} className="flex flex-col bg-[var(--card)] p-6 sm:p-7">
                    <span className="num text-[13px] text-[var(--fg-3)]">Step {i + 1}</span>
                    <h3 className="mt-3 text-[17px] font-semibold">{step.title}</h3>
                    <p className="mt-1.5 flex-1 text-[15px] leading-relaxed text-[var(--fg-2)]">{step.desc}</p>
                    {isExternal ? (
                      <a href={step.href} target="_blank" rel="noopener noreferrer" className={linkClass}>{step.action}{arrow}</a>
                    ) : isAnchor ? (
                      <button type="button" onClick={() => scrollToId(step.href.slice(1))} className={`${linkClass} w-fit`}>{step.action}{arrow}</button>
                    ) : (
                      <Link to={step.href} className={linkClass}>{step.action}{arrow}</Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </Reveal>
        </div>
      </section>

      <Contributors />

      <JoinBand />
    </SiteLayout>
  );
};

export default Landing;
