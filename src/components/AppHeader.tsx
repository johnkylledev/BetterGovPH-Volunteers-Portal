import React from 'react';
import clsx from 'clsx';

export interface AppNavItem {
  id: string;
  label: string;
  soon?: boolean;
}

interface AppHeaderProps {
  items: AppNavItem[];
  /** The highlighted item, or null when the page isn't one of the nav sections (e.g. Profile). */
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Right side of the bar, normally the UserChip. */
  account: React.ReactNode;
  /** Phones get a second scrolling row of nav items; pages with their own tab row can turn it off. */
  mobileNav?: boolean;
}

const SoonPill = () => (
  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-px text-[10.5px] font-medium text-amber-800">Soon</span>
);

/** The signed-in app bar shared by the dashboard and profile, so moving between them doesn't shift anything. */
export const AppHeader: React.FC<AppHeaderProps> = ({ items, activeId, onSelect, account, mobileNav = true }) => (
  <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_0_rgb(15_23_42/0.08)]">
    <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
      <a href="/" className="flex min-w-0 items-center gap-2.5">
        <img
          src="/logo.svg"
          onError={(e) => {
            const t = e.currentTarget;
            t.onerror = null;
            t.src = 'https://assets.bettergov.ph/logos/webp/icon-primary.webp';
          }}
          alt=""
          className="h-6 w-6 shrink-0 object-contain"
        />
        <span className="truncate text-[15px] font-semibold tracking-[-0.015em] text-slate-900">
          BetterGovPH <span className="hidden font-normal text-slate-500 sm:inline">Volunteers</span>
        </span>
      </a>

      {items.length > 0 && (
        <nav aria-label="App sections" className="hidden items-center gap-1 md:flex">
          {items.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-current={activeId === t.id ? 'page' : undefined}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-[14px] transition-colors duration-150 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgb(30_58_138/0.3)]',
                activeId === t.id ? 'bg-slate-900/[0.05] font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              {t.label}
              {t.soon && <SoonPill />}
            </button>
          ))}
        </nav>
      )}

      {account}
    </div>

    {mobileNav && items.length > 0 && (
      <nav aria-label="App sections" className="no-scrollbar flex gap-1 overflow-x-auto border-t border-slate-200/70 px-3 py-1.5 md:hidden">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-current={activeId === t.id ? 'page' : undefined}
            className={clsx(
              'shrink-0 rounded-lg px-3 py-1.5 text-[14px] transition-colors duration-150',
              activeId === t.id ? 'bg-slate-900/[0.06] font-medium text-slate-900' : 'text-slate-500'
            )}
          >
            {t.label}
            {t.soon && <SoonPill />}
          </button>
        ))}
      </nav>
    )}
  </header>
);

/** The member nav, shared so Profile can link straight to a dashboard section. */
export const MEMBER_NAV: AppNavItem[] = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'submit-project', label: 'Projects' },
  { id: 'volunteer', label: 'Volunteer calls' },
  { id: 'merch', label: 'Merch', soon: true },
];
