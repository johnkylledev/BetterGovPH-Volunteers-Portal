import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, Clock, Hammer, Heart, LockOpen, Rocket, SearchCheck, Smartphone, Users } from 'lucide-react';
import { VerifiedIcon } from '../../components/icons';
import { motion, useReducedMotion } from 'framer-motion';
import { AccessCard } from '../../components/AccessCard';
import { CardCover } from '../../components/CardCover';
import { CARDS_ENABLED } from '../../constants/features';
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

// `span` lays the six out as a 4·2 / 2·4 / 3·3 bento on large screens.
const PRINCIPLES = [
  { title: 'Filipino-first', desc: 'Built by Filipinos, for the people who actually use public services.', icon: Heart, span: 'lg:col-span-4', featured: true },
  { title: 'Open by default', desc: 'Code, data, and decisions happen in public where anyone can check them.', icon: LockOpen, span: 'lg:col-span-2' },
  { title: 'Build together', desc: 'Small teams, shared ownership, credit where it’s due.', icon: Users, span: 'lg:col-span-2' },
  { title: 'Ship it', desc: 'A working tool today beats a perfect plan next year.', icon: Rocket, span: 'lg:col-span-4' },
  { title: 'Get it right', desc: 'Cite sources and verify numbers before anything goes out.', icon: SearchCheck, span: 'lg:col-span-3' },
  { title: 'For everyone', desc: 'Accessible on any phone, any connection, in plain language.', icon: Smartphone, span: 'lg:col-span-3' },
];

const DiscordMark = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const STEPS = [
  {
    title: 'Say hello on Discord',
    desc: 'Meet the community, introduce yourself and see what’s being built right now.',
    time: '1 min',
    icon: <DiscordMark />,
    action: 'Open Discord',
    href: DISCORD_INVITE,
  },
  {
    title: 'Apply for membership',
    desc: 'Tell us your skills and the role you want. An admin reviews every application.',
    time: '5 min',
    icon: <ClipboardList size={18} strokeWidth={1.75} />,
    action: 'Start application',
    href: '/register',
  },
  {
    title: 'Pick something to build',
    desc: 'Choose an open issue or join a project team, then ship with people who care.',
    time: 'Your pace',
    icon: <Hammer size={18} strokeWidth={1.75} />,
    action: 'See open roles',
    href: '#open-roles',
  },
];

const PARTNERS: { name: string; logo?: string }[] = [
  { name: 'DICT', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Department_of_Information_and_Communications_Technology_%28DICT%29.svg/120px-Department_of_Information_and_Communications_Technology_%28DICT%29.svg.png' },
  { name: 'DBM', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Department_of_Budget_and_Management_%28DBM%29.svg/120px-Department_of_Budget_and_Management_%28DBM%29.svg.png' },
  { name: 'LGUs', logo: 'https://1000logos.net/wp-content/uploads/2019/03/DILG-Logo.png' },
  { name: 'PCIJ', logo: 'https://i0.wp.com/pcij.org/wp-content/uploads/2024/04/logo-pcij-web.png?w=200&quality=80&ssl=1' },
  { name: 'People’s Budget Coalition', logo: '/partners/peoples-budget-coalition.png' },
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
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <motion.h1 {...enter(0.04)} className="text-[40px] sm:text-[56px] lg:text-[60px] tracking-[-0.04em] leading-[1.02]">
              Build the public tools the Philippines deserves.
            </motion.h1>
            <motion.p {...enter(0.1)} className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-[var(--fg-2)]">
              We're a volunteer community of developers, designers, writers, educators, lawyers, and advocates making government data
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
            {CARDS_ENABLED && (
              <motion.p {...enter(0.2)} className="mt-6 text-[14px] text-[var(--fg-3)]">
                Already a member? Anyone can{' '}
                <Link to="/verify" className="s-link">verify a card</Link>.
              </motion.p>
            )}
          </div>

          <motion.figure
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
            className="mx-auto w-full min-w-0 max-w-[420px] lg:mr-0"
          >
            <div className="flex justify-center rounded-[22px] bg-[#eef1f5] px-4 py-8 sm:px-6 sm:py-10 shadow-[inset_0_1px_2px_rgb(15_23_42/0.06),inset_0_0_0_1px_rgb(15_23_42/0.04)] sm:py-12">
              {/* Even the demo is held back: a picture of the card is the thing that could be
                  screenshotted and passed off as identification. */}
              {CARDS_ENABLED ? (
                <AccessCard user={demoUser} isDemo />
              ) : (
                <CardCover note="Members join the public directory in the meantime.">
                  <AccessCard user={demoUser} isDemo />
                </CardCover>
              )}
            </div>
            <figcaption className="mt-4 px-1 text-[13px] leading-relaxed text-[var(--fg-3)]">
              <span className="font-medium text-[var(--fg)]">The Volunteer Card.</span>{' '}
              {CARDS_ENABLED
                ? 'Every approved member gets one. Its QR code opens a public page anyone can check.'
                : 'Members are listed in the public directory while we finish it.'}
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
          <SectionHead title="How we work.">
            Six habits that keep a volunteer team shipping useful things, and keep the public able to trust them.
          </SectionHead>
          <Reveal>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-6">
              {PRINCIPLES.map((p, i) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.title}
                    className={`group relative flex min-h-[176px] flex-col overflow-hidden rounded-[16px] p-6 transition-[box-shadow,transform] duration-200 sm:p-7 ${p.span} ${
                      p.featured
                        ? 'bg-[linear-gradient(140deg,#1e3a8a,#1e40af_60%,#2547b8)] text-white shadow-[0_10px_30px_-12px_rgb(30_58_138/0.6),inset_0_1px_0_rgb(255_255_255/0.12)] sm:col-span-2'
                        : 'bg-[var(--card)] shadow-[var(--e2)] [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-[0_1px_2px_rgb(15_23_42/0.05),0_12px_28px_-8px_rgb(15_23_42/0.16),0_0_0_1px_rgb(15_23_42/0.08)]'
                    }`}
                  >
                    {p.featured && (
                      <Icon
                        aria-hidden
                        size={180}
                        strokeWidth={1}
                        className="pointer-events-none absolute -bottom-10 -right-6 text-white/[0.07]"
                      />
                    )}
                    <div className="flex items-center justify-between">
                      <Icon size={22} strokeWidth={1.75} className={p.featured ? 'text-white' : 'text-[var(--accent)]'} aria-hidden />
                      <span className={`num text-[13px] ${p.featured ? 'text-white/50' : 'text-[var(--fg-3)]/70'}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <dt className={`mt-auto pt-8 font-semibold tracking-[-0.015em] ${p.featured ? 'text-[24px] sm:text-[28px]' : 'text-[17px]'}`}>
                      {p.title}
                    </dt>
                    <dd className={`mt-1.5 max-w-md leading-relaxed ${p.featured ? 'text-[16px] text-white/80' : 'text-[15px] text-[var(--fg-2)]'}`}>
                      {p.desc}
                    </dd>
                  </div>
                );
              })}
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
                  <img
                    src={p.logo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    height={32}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    className="h-8 w-auto object-contain opacity-70 grayscale"
                  />
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
          <SectionHead title="Three steps to join.">
            Free and open to every Filipino who wants to help. You don’t need years of experience, just a willingness to build.
          </SectionHead>
          <Reveal>
            <ol className="relative grid gap-4 md:grid-cols-3 md:gap-6">
              {/* The path between the step numbers */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-5 top-5 hidden h-[2px] w-[calc(66.666%+16px)] -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,var(--accent),rgb(30_58_138/0.2))] md:block"
              />
              {STEPS.map((step, i) => {
                const isExternal = step.href.startsWith('http');
                const isAnchor = step.href.startsWith('#');
                const primary = i === 0;
                const linkClass = primary
                  ? 's-btn s-btn-accent mt-6 h-10 w-fit gap-1.5 px-4 text-[14px]'
                  : 'group mt-6 inline-flex w-fit items-center gap-1.5 text-[14px] font-medium text-[var(--accent)]';
                const arrow = <ArrowRight size={14} strokeWidth={1.75} className="transition-transform duration-200 group-hover:translate-x-0.5" />;
                return (
                  <li key={step.title} className="relative flex gap-4 md:flex-col md:gap-0">
                    {/* Phones: a vertical line links the numbers instead */}
                    {i < STEPS.length - 1 && (
                      <span aria-hidden className="absolute bottom-[-16px] left-5 top-10 w-px bg-[var(--line)] md:hidden" />
                    )}
                    <span className="num relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[15px] font-semibold text-white shadow-[0_0_0_5px_var(--bg),0_2px_6px_-1px_rgb(30_58_138/0.4)]">
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col rounded-[14px] bg-[var(--card)] p-5 shadow-[var(--e2)] transition-[box-shadow,transform] duration-200 sm:p-6 md:mt-5 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-[0_1px_2px_rgb(15_23_42/0.05),0_12px_28px_-8px_rgb(15_23_42/0.16),0_0_0_1px_rgb(15_23_42/0.08)]">
                      <div className="flex items-center justify-between gap-3">
                        <span className={primary ? 'text-[#5865F2]' : 'text-[var(--accent)]'}>{step.icon}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-2 py-0.5 text-[12px] text-[var(--fg-3)]">
                          <Clock size={12} strokeWidth={1.75} aria-hidden />
                          {step.time}
                        </span>
                      </div>
                      <h3 className="mt-4 text-[17px] font-semibold">{step.title}</h3>
                      <p className="mt-1.5 flex-1 text-[15px] leading-relaxed text-[var(--fg-2)]">{step.desc}</p>
                      {isExternal ? (
                        <a href={step.href} target="_blank" rel="noopener noreferrer" className={linkClass}>{step.action}{arrow}</a>
                      ) : isAnchor ? (
                        <button type="button" onClick={() => scrollToId(step.href.slice(1))} className={linkClass}>{step.action}{arrow}</button>
                      ) : (
                        <Link to={step.href} className={linkClass}>{step.action}{arrow}</Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* Where the steps lead */}
            <div className="mt-6 flex flex-col gap-3 rounded-[14px] bg-[linear-gradient(135deg,#eef3ff,#f7f9ff)] p-5 shadow-[inset_0_0_0_1px_rgb(30_58_138/0.12)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <p className="flex items-start gap-3 text-[15px] text-[var(--fg-2)]">
                <VerifiedIcon size={20} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                <span>
                  {CARDS_ENABLED ? (
                    <>
                      <span className="font-semibold text-[var(--fg)]">Once approved, you get a Volunteer Card</span>
                      {' '}with a member ID and a QR anyone can scan to verify you.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-[var(--fg)]">Once approved, you join the directory</span>
                      {' '}alongside everyone else building BetterGovPH.
                    </>
                  )}
                </span>
              </p>
              <Link
                to={CARDS_ENABLED ? '/verify' : '/volunteers'}
                className="group inline-flex shrink-0 items-center gap-1.5 text-[14px] font-medium text-[var(--accent)]"
              >
                {CARDS_ENABLED ? 'See how verification works' : 'See the volunteers'}
                <ArrowRight size={14} strokeWidth={1.75} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <Contributors />

      <JoinBand />
    </SiteLayout>
  );
};

export default Landing;
