import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, Clock, Hammer } from 'lucide-react';
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

// Paired, not two lists read side by side: the whole point of each line is the one across from it,
// and parallel arrays matched up by index quietly mismatch the moment someone reorders one of them.
const SHIFTS = [
  { from: 'Citizens are spectators to governance', to: 'Every Filipino can be an agent of change' },
  { from: 'Transparency is a promise, not a practice', to: 'Government works with us, not above us' },
  { from: 'Public data is trapped in broken systems', to: 'Open data, open code, open by default' },
  { from: 'Bureaucracy moves slower than technology', to: 'Technology serves bayanihan, not bureaucracy' },
];

/*
 * Numbered, the way a public body publishes a set of principles — GOV.UK has had eleven of these
 * since 2012 and they are set as plain numbered headings, no tiles, no icons, because a principle
 * you can cite by number is worth more than one in a box. The number belongs in the title; in the
 * corner of a card it is just an ornament.
 */
const PRINCIPLES = [
  { title: 'Filipino-first', desc: 'Built by Filipinos, for the people who actually use public services.' },
  { title: 'Open by default', desc: 'Code, data, and decisions happen in public where anyone can check them.' },
  { title: 'Build together', desc: 'Small teams, shared ownership, credit where it’s due.' },
  { title: 'Ship it', desc: 'A working tool today beats a perfect plan next year.' },
  { title: 'Get it right', desc: 'Cite sources and verify numbers before anything goes out.' },
  { title: 'For everyone', desc: 'Accessible on any phone, any connection, in plain language.' },
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
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
          <Reveal className="max-w-2xl">
            <h2 className="text-[30px] sm:text-[40px]">The system doesn’t fix itself. We do.</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--fg-2)]">
              Four things we think are broken about how Filipinos experience government — and what we build instead.
            </p>
            <Link to="/projects" className="group mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--accent)]">
              See what we’ve shipped
              <ArrowRight size={14} strokeWidth={1.75} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Reveal>

          {/*
            No boxes. Four entries on a ruled page: what is on the left in a quiet voice, what we are
            building on the right at the size of a statement, sharing one set of hairlines so the eye
            runs across each pair. Boxing each one gave four identical tiles of chrome and left the
            promise — the only part worth reading twice — set at list size.
          */}
          <Reveal delay={0.06}>
            <dl className="mt-14 border-t border-[var(--line)] sm:mt-16">
              {SHIFTS.map(({ from, to }) => (
                <div
                  key={to}
                  className="grid gap-x-10 gap-y-2.5 border-b border-[var(--line)] py-7 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)] sm:items-baseline sm:py-9"
                >
                  <dt className="text-[14.5px] leading-relaxed text-[var(--fg-3)]">
                    <span className="sr-only">Today: </span>
                    {from}
                  </dt>
                  <dd className="text-[21px] font-semibold leading-[1.22] tracking-[-0.022em] text-[var(--fg)] sm:text-[25px]">
                    <span className="sr-only">What we’re building: </span>
                    {to}
                  </dd>
                </div>
              ))}
            </dl>
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
            {/*
              A numbered set, not six tiles. Each habit opens on a hairline with its number set in
              tabular figures beside the title, so the six read as one list you could cite from
              ("number four, ship it") instead of a feature grid with a glyph in a tinted square in
              every corner.
            */}
            <dl className="grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
              {PRINCIPLES.map((p, i) => (
                // The rule opens each entry, and the first row of each layout starts the page, so it
                // has none. Written per breakpoint because which row is first changes with the
                // column count.
                <div
                  key={p.title}
                  className="border-t border-[var(--line)] py-6 first:border-t-0 sm:py-7 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0"
                >
                  <dt className="flex gap-3 text-[17px] font-semibold tracking-[-0.015em] text-[var(--fg)]">
                    {/* Fixed width and tabular, so six titles start on one line rather than each one
                        shifting with the width of its digit. */}
                    <span className="num w-3 shrink-0 text-[14px] font-normal text-[var(--accent)]">{i + 1}</span>
                    <span className="min-w-0">{p.title}</span>
                  </dt>
                  <dd className="mt-2 max-w-[42ch] pl-6 text-[14.5px] leading-relaxed text-[var(--fg-2)]">{p.desc}</dd>
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
