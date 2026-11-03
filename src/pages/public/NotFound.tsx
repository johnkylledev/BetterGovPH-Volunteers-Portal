import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SiteLayout } from '../../components/site/SiteLayout';
import { DISCORD_INVITE } from '../../components/site/links';

const shortcuts = [
  { to: '/', label: 'Home', sub: 'What BetterGovPH Volunteers is about' },
  { to: '/projects', label: 'Projects', sub: 'Tools the community has shipped' },
  { to: '/contribute', label: 'Contribute', sub: 'Open roles and how we work' },
  { to: '/verify', label: 'Verify a card', sub: 'Look up a Member ID' },
];

export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <SiteLayout>
      <div className="mx-auto max-w-xl px-4 sm:px-6 pt-14 pb-20 sm:pt-24">
        <p className="num text-[13px] text-[var(--fg-3)]">Error 404</p>
        <h1 className="mt-3 text-[32px] sm:text-[40px]">This page doesn’t exist.</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--fg-2)]">
          {pathname !== '/' && (
            <>
              Nothing lives at <span className="break-all font-mono text-[14px] text-[var(--fg)]">{pathname}</span>.{' '}
            </>
          )}
          The link may be old or mistyped. One of these is probably what you were after.
        </p>

        <ul className="mt-10 border-t border-[var(--line)]">
          {shortcuts.map((s) => (
            <li key={s.to} className="border-b border-[var(--line)]">
              <Link to={s.to} className="group -mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-4 transition-colors hover:bg-white">
                <span>
                  <span className="block text-[15px] font-medium">{s.label}</span>
                  <span className="block text-[14px] text-[var(--fg-3)]">{s.sub}</span>
                </span>
                <ArrowRight
                  size={16}
                  strokeWidth={1.75}
                  className="shrink-0 text-slate-300 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-slate-700"
                />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-[14px] text-[var(--fg-3)]">
          Think something’s broken?{' '}
          <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="s-link">
            Tell us on Discord
          </a>
          .
        </p>
      </div>
    </SiteLayout>
  );
}
