import React from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

/**
 * Two lists live under /projects: what members shipped, and the LGU portals the wider community
 * maintains. They are separate pages with their own URLs — a refresh or a shared link lands where
 * you were — and this switch is how you cross between them.
 */
const TABS = [
  { to: '/projects', label: 'Community projects' },
  { to: '/projects/lgus', label: 'LGU portals' },
] as const;

export const DirectoryTabs: React.FC<{ active: '/projects' | '/projects/lgus' }> = ({ active }) => (
  <nav aria-label="Directory" className="mt-8 inline-flex rounded-full bg-[var(--muted)] p-1">
    {TABS.map((t) => {
      const on = t.to === active;
      return (
        <Link
          key={t.to}
          to={t.to}
          aria-current={on ? 'page' : undefined}
          className={clsx(
            'inline-flex h-9 items-center rounded-full px-4 text-[13.5px] transition-[background-color,color,box-shadow] duration-150',
            on
              ? 'bg-[var(--card)] font-medium text-[var(--fg)] shadow-[0_1px_2px_rgb(15_23_42/0.08)]'
              : 'text-[var(--fg-3)] hover:text-[var(--fg)]',
          )}
        >
          {t.label}
        </Link>
      );
    })}
  </nav>
);
