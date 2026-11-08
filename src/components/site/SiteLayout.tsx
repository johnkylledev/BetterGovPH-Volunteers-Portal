import { CARDS_ENABLED } from '../../constants/features';
import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { DISCORD_INVITE, GITHUB_ORG, MAIN_WEBSITE } from './links';

const footerColumns: { heading: string; links: { label: string; to: string; external?: boolean }[] }[] = [
  {
    heading: 'Get involved',
    links: [
      { label: 'Apply for membership', to: '/register' },
      { label: 'Open roles', to: '/#open-roles' },
      { label: 'Contributing guide', to: '/contribute' },
      { label: 'Code of conduct', to: '/code-of-conduct' },
      { label: 'Discord', to: DISCORD_INVITE, external: true },
    ],
  },
  {
    heading: 'Portal',
    links: [
      { label: 'Sign in', to: '/login' },
      { label: 'Opportunities', to: '/opportunities' },
      { label: 'Volunteers', to: '/volunteers' },
      { label: 'Projects', to: '/projects' },
      // Card verification is switched off; linking to it would only promise something we hide.
      ...(CARDS_ENABLED ? [{ label: 'Verify a card', to: '/verify' }] : []),
    ],
  },
  {
    heading: 'BetterGovPH',
    links: [
      { label: 'bettergov.ph', to: MAIN_WEBSITE, external: true },
      { label: 'GitHub', to: GITHUB_ORG, external: true },
    ],
  },
];

export const SiteFooter: React.FC = () => (
  <footer className="border-t border-[var(--line)] bg-[var(--card)]">
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-14">
      <div className="grid gap-10 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="h-7 w-7 object-contain" />
            <span className="text-[15px] font-semibold tracking-tight">BetterGovPH Volunteers</span>
          </Link>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--fg-3)]">
            Open-source civic tech, built by Filipino volunteers in their spare time.
          </p>
        </div>
        {footerColumns.map((col) => (
          <div key={col.heading}>
            <h2 className="text-[13px] font-semibold text-[var(--fg)]">{col.heading}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a href={l.to} target="_blank" rel="noopener noreferrer" className="text-[14px] text-[var(--fg-3)] hover:text-[var(--fg)] transition-colors">
                      {l.label}
                    </a>
                  ) : (
                    <Link to={l.to} className="text-[14px] text-[var(--fg-3)] hover:text-[var(--fg)] transition-colors">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-12 flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-6 text-[13px] text-[var(--fg-3)] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} BetterGovPH. Built for Filipinos.</p>
        <div className="flex gap-5">
          <Link to="/privacy" className="hover:text-[var(--fg)] transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-[var(--fg)] transition-colors">Terms</Link>
        </div>
      </div>
    </div>
  </footer>
);

/** Shell for every public page: nav, content, footer. */
export const SiteLayout: React.FC<{ children: React.ReactNode; footer?: boolean }> = ({ children, footer = true }) => (
  <div className="site min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-1 pt-14">{children}</main>
    {footer && <SiteFooter />}
  </div>
);

/** Title block used at the top of inner pages. */
export const PageIntro: React.FC<{ title: string; lede?: React.ReactNode; actions?: React.ReactNode }> = ({
  title,
  lede,
  actions,
}) => (
  <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-2xl">
      <h1 className="text-[32px] sm:text-[40px]">{title}</h1>
      {lede && <p className="mt-3 text-[16px] leading-relaxed text-[var(--fg-2)]">{lede}</p>}
    </div>
    {actions && <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">{actions}</div>}
  </div>
);
