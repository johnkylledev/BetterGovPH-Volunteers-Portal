import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { GITHUB_REPO } from './links';
import { Reveal } from './Reveal';

interface Contributor {
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
}

interface GitHubContributor {
  login: string;
  type: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

const CACHE_KEY = 'bgph:contributors:v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
// Automation and AI co-authors that GitHub lists next to people.
const NON_HUMAN = /\[bot\]$|^(dependabot|renovate|github-actions|copilot|claude|anthropic|codex|devin|cursor)/i;

const readCache = (): Contributor[] | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: Contributor[] };
    return Date.now() - at < CACHE_TTL_MS ? data : null;
  } catch {
    return null;
  }
};

const loadContributors = async (signal: AbortSignal): Promise<Contributor[]> => {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contributors?per_page=100`, { signal });
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  const list = (await res.json()) as GitHubContributor[];
  const people = list.filter((c) => c.type === 'User' && !NON_HUMAN.test(c.login));

  // Display names live on the profile endpoint; fall back to the login if it fails.
  return Promise.all(
    people.map(async (c) => {
      let name: string | null = null;
      try {
        const p = await fetch(`https://api.github.com/users/${c.login}`, { signal });
        if (p.ok) name = ((await p.json()) as { name: string | null }).name;
      } catch {
        name = null;
      }
      return {
        login: c.login,
        name,
        avatarUrl: `${c.avatar_url}${c.avatar_url.includes('?') ? '&' : '?'}s=96`,
        profileUrl: c.html_url,
        contributions: c.contributions,
      };
    })
  );
};

/** People who built this portal, pulled live from GitHub. Hidden if GitHub can't be reached. */
export const Contributors: React.FC = () => {
  const [people, setPeople] = useState<Contributor[] | null>(() => readCache());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (people) return;
    const ctrl = new AbortController();
    loadContributors(ctrl.signal)
      .then((data) => {
        setPeople(data);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch { /* storage unavailable */ }
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name !== 'AbortError') setFailed(true);
      });
    return () => ctrl.abort();
  }, [people]);

  if (failed || (people && people.length === 0)) return null;

  return (
    <section className="border-t border-[var(--line)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
        <Reveal className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[24px] sm:text-[28px]">The people who built this portal.</h2>
          </div>
          <a
            href={`https://github.com/${GITHUB_REPO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1 text-[14px] font-medium text-[var(--accent)]"
          >
            View the repository
            <ArrowUpRight size={14} strokeWidth={1.75} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </Reveal>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy={!people}>
          {people
            ? people.map((p) => (
                <li key={p.login}>
                  <a
                    href={p.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="s-card group flex items-center gap-3 p-3 pr-4 transition-[box-shadow,transform] duration-200 [@media(hover:hover)]:hover:shadow-[var(--e2)] [@media(hover:hover)]:hover:-translate-y-px active:scale-[0.99]"
                  >
                    <img
                      src={p.avatarUrl}
                      alt=""
                      width={44}
                      height={44}
                      loading="lazy"
                      className="h-11 w-11 shrink-0 rounded-full bg-[var(--muted)] outline outline-1 -outline-offset-1 outline-black/[0.08]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{p.name || p.login}</span>
                      <span className="block truncate text-[13px] text-[var(--fg-3)]">@{p.login}</span>
                    </span>
                    <span className="num shrink-0 text-[12px] text-[var(--fg-3)]" title={`${p.contributions} commits`}>
                      {p.contributions}
                    </span>
                  </a>
                </li>
              ))
            : Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="s-card flex items-center gap-3 p-3">
                  <span className="h-11 w-11 rounded-full bg-slate-100" />
                  <span className="flex-1 space-y-1.5">
                    <span className="block h-3 w-24 rounded bg-slate-100" />
                    <span className="block h-2.5 w-16 rounded bg-slate-100" />
                  </span>
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
};
