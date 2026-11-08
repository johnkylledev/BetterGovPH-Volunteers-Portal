import React, { useMemo, useState } from 'react';
import { ArrowUpRight, ExternalLink, Facebook, Github, Globe, Search as SearchIcon, X as XIcon } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { SiteMark, iconForDomain } from '../../components/site/SiteMark';
import { SiteLayout, PageIntro } from '../../components/site/SiteLayout';
import { DirectoryTabs } from '../../components/site/DirectoryTabs';
import { useCachedResource } from '../../hooks/useCachedResource';

interface Maintainer { login: string; profileUrl: string; avatarUrl: string }
interface Lgu {
  name: string; city: string; province: string;
  domain: string; url: string; repoUrl: string; socialUrl: string;
  status: 'active' | 'wip' | 'unmaintained' | 'planned';
  statusLabel: string; stale: boolean; openForAdoption: boolean;
  logoUrl: string;
  maintainers: Maintainer[];
}
interface Payload {
  lgus: Lgu[];
  counts: Record<string, number>;
  directoryUrl: string;
  contributingUrl: string;
  generatedAt: string;
}

const fetchLgus = async (): Promise<Payload> => {
  const r = await fetch('/api/v1/lgus');
  if (!r.ok) throw new Error('Couldn’t reach the LGU directory');
  return (await r.json()) as Payload;
};

const MaintainerFaces: React.FC<{ people: Maintainer[] }> = ({ people }) => {
  if (!people.length) return <span className="text-[12.5px] text-[var(--fg-3)]">No maintainer listed</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex shrink-0 -space-x-1.5">
        {people.slice(0, 3).map((m) => (
          <a
            key={m.login}
            href={m.profileUrl}
            target="_blank"
            rel="noreferrer"
            title={`@${m.login} on GitHub`}
            className="relative rounded-full ring-2 ring-[var(--card)] transition-transform duration-150 hover:z-10 hover:-translate-y-0.5"
          >
            <Avatar name={m.login} seed={m.login} photos={[m.avatarUrl]} size={22} label={`@${m.login}`} />
          </a>
        ))}
      </span>
      <span className="min-w-0 truncate text-[12.5px] text-[var(--fg-3)]">
        {people.length === 1 ? `@${people[0].login}` : `${people.length} maintainers`}
      </span>
    </span>
  );
};

const LguCard: React.FC<{ lgu: Lgu }> = ({ lgu }) => (
  <li className="s-tile group flex h-full flex-col p-5">
    <div className="flex items-start gap-3.5">
      {/* The portal's own logo, then its favicon, then its initials. Nothing of theirs is stored. */}
      <SiteMark name={lgu.city} sources={[lgu.logoUrl, iconForDomain(lgu.domain)]} size={44} />
      <div className="min-w-0 flex-1">
        <h2 className="text-[15.5px] font-semibold leading-snug tracking-[-0.012em] [overflow-wrap:anywhere]">
          {/* The whole tile opens the portal; the links in the footer sit above this overlay. */}
          <a href={lgu.url} target="_blank" rel="noreferrer" className="after:absolute after:inset-0">
            {lgu.city}
          </a>
        </h2>
        {lgu.province && <p className="truncate text-[13px] text-[var(--fg-3)]">{lgu.province}</p>}
      </div>
      <ArrowUpRight
        size={16}
        strokeWidth={1.75}
        aria-hidden
        className="mt-0.5 shrink-0 text-slate-300 transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
      />
    </div>

    <p className="mt-4">
      <span className="s-addr">
        <Globe size={12} strokeWidth={1.75} className="shrink-0 opacity-60" aria-hidden />
        <span className="truncate">{lgu.domain}</span>
      </span>
    </p>

    {lgu.openForAdoption && (
      <p className="mt-2.5">
        <span className="rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11.5px] font-medium text-[var(--accent)]">
          Open for adoption
        </span>
      </p>
    )}

    <div className="flex-1" />
    <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3.5">
      <MaintainerFaces people={lgu.maintainers} />
      <span className="flex shrink-0 items-center gap-1">
        {lgu.repoUrl && (
          <a
            href={lgu.repoUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${lgu.city} source code on GitHub`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-3)] transition-colors duration-150 hover:bg-[var(--muted)] hover:text-[var(--fg)]"
          >
            <Github size={14} strokeWidth={1.75} />
          </a>
        )}
        {lgu.socialUrl && (
          <a
            href={lgu.socialUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${lgu.city} on Facebook`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-3)] transition-colors duration-150 hover:bg-[var(--muted)] hover:text-[var(--fg)]"
          >
            <Facebook size={14} strokeWidth={1.75} />
          </a>
        )}
      </span>
    </div>
  </li>
);

export default function Lgus() {
  // Read live from the directory's own source table, through our API, and kept current without a reload.
  const res = useCachedResource<Payload>('public-lgus', fetchLgus, { freshMs: 120_000, pollMs: 300_000 });
  const data = res.data ?? null;
  const [query, setQuery] = useState('');

  // Only portals that are actually up and looked after. Work-in-progress and planned entries live
  // on the directory itself, where people go to claim one.
  const live = useMemo(
    () => (data?.lgus ?? []).filter((l) => l.status === 'active' && !!l.url),
    [data],
  );
  const maintainerCount = useMemo(
    () => new Set(live.flatMap((l) => l.maintainers.map((m) => m.login.toLowerCase()))).size,
    [live],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return live;
    return live.filter((l) =>
      l.name.toLowerCase().includes(q) ||
      l.domain.toLowerCase().includes(q) ||
      l.maintainers.some((m) => m.login.toLowerCase().includes(q)));
  }, [live, query]);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-20 sm:pt-20">
        <PageIntro
          title="Every live Better LGU portal."
          lede={
            data ? (
              <>
                <span className="num font-semibold text-[var(--fg)]">{live.length.toLocaleString()}</span> local
                governments have a transparency portal up and running, kept by{' '}
                <span className="num font-semibold text-[var(--fg)]">{maintainerCount.toLocaleString()}</span>{' '}
                volunteer maintainers. Check for one before you build.
              </>
            ) : (
              'Local government transparency portals built and kept running by volunteers. Check for one before you build.'
            )
          }
          actions={
            <a
              href={data?.contributingUrl || 'https://lgu.bettergov.ph/CONTRIBUTING'}
              target="_blank"
              rel="noreferrer"
              className="s-btn s-btn-accent"
            >
              Add your LGU
              <ExternalLink size={15} strokeWidth={1.75} />
            </a>
          }
        />

        <DirectoryTabs active="/projects/lgus" />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Search LGUs</span>
            <SearchIcon size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              inputMode="search"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              placeholder="Search by LGU, domain or maintainer"
              className="s-field pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <XIcon size={14} strokeWidth={1.75} />
              </button>
            )}
          </label>
          {data && (
            <p className="num text-[13px] text-[var(--fg-3)]" aria-live="polite">
              {query ? `${shown.length} of ${live.length} portals` : `${live.length} portals`}
            </p>
          )}
        </div>

        <div className="mt-6">
          {res.loadingFirst ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading LGUs">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="s-tile h-[196px] p-5">
                  <div className="flex items-center gap-3.5">
                    <span className="block h-11 w-11 rounded-[13px] bg-[var(--muted)]" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3.5 w-2/3 rounded bg-[var(--muted)]" />
                      <span className="block h-3 w-1/3 rounded bg-[var(--muted)]" />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : res.error && !data ? (
            <div className="s-card px-6 py-10 text-center">
              <h2 className="text-[16px] font-semibold">Couldn’t load the LGU directory</h2>
              <p className="mt-1.5 text-[14px] text-[var(--fg-3)]">It’s read live from GitHub, so a hiccup there shows up here.</p>
              <button type="button" onClick={res.refresh} className="s-btn s-btn-plain mt-5">Try again</button>
            </div>
          ) : shown.length === 0 ? (
            <div className="s-card px-6 py-12 text-center">
              <h2 className="text-[16px] font-semibold">
                {query ? `Nothing matches “${query.trim()}”` : 'No live portals listed yet'}
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-[var(--fg-3)]">
                {query ? 'Try another town, province or maintainer.' : 'The directory has no active entries right now.'}
              </p>
              {query && (
                <button type="button" onClick={() => setQuery('')} className="s-btn s-btn-plain mt-5">Clear search</button>
              )}
            </div>
          ) : (
            <>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((l) => <LguCard key={l.name} lgu={l} />)}
              </ul>
              <p className="mt-8 text-[13px] text-[var(--fg-3)]">
                Read live from{' '}
                <a href={data?.directoryUrl || 'https://lgu.bettergov.ph/'} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
                  the BetterLGU directory
                </a>
                . Portals still being built, and LGUs open for adoption, are listed there.
              </p>
            </>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
