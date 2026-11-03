import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ArrowUpRight, Plus, Search as SearchIcon, X as XIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApprovedProjects, supabase } from '../../services/supabase';
import { Project } from '../../types';
import { SiteLayout, PageIntro } from '../../components/site/SiteLayout';

const hostnameFromUrl = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');

  const loadProjects = useCallback(async (isInitial = false) => {
    if (isInitial) setStatus('loading');
    setMessage('');
    try {
      const list = await getApprovedProjects({ merged: true });
      setProjects(list);
      setStatus('success');
    } catch (err: any) {
      const m = err instanceof Error ? err.message : typeof err?.message === 'string' ? err.message : 'Failed to load projects';
      setStatus('error');
      setMessage(m);
    }
  }, []);

  useEffect(() => {
    loadProjects(true);

    const projectsChannel = supabase
      .channel('public-projects-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_submissions' },
        () => loadProjects(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(projectsChannel);
    };
  }, [loadProjects]);

  const q = query.trim().toLowerCase();
  const enriched = useMemo(() => {
    return projects.map((p) => ({ ...p, host: hostnameFromUrl(p.url) }));
  }, [projects]);

  const filtered = useMemo(() => {
    if (!q) return enriched;
    return enriched.filter((p) => (
      p.title.toLowerCase().includes(q) ||
      p.host.toLowerCase().includes(q) ||
      (p.projType || '').toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    ));
  }, [enriched, q]);

  const total = enriched.length;
  const matched = filtered.length;

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-20 sm:pt-20">
        <PageIntro
          title="What the community has shipped."
          lede="Approved projects from members — live tools, datasets, and the repositories behind them."
          actions={
            <Link to="/dashboard?tab=submit-project" className="s-btn s-btn-plain">
              <Plus size={16} strokeWidth={1.75} />
              Submit a project
            </Link>
          }
        />

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Search projects</span>
            <SearchIcon size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              inputMode="search"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              placeholder="Search by name, site, or type"
              className="s-field pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
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
          {status === 'success' && (
            <p className="num text-[13px] text-[var(--fg-3)]" aria-live="polite">
              {q ? `${matched} of ${total} projects` : `${total} ${total === 1 ? 'project' : 'projects'}`}
            </p>
          )}
        </div>

        <div className="mt-6">
          {status === 'loading' || status === 'idle' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="s-card p-5">
                  <div className="h-4 w-1/2 rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
                  <div className="mt-5 h-3 w-full rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : status === 'error' ? (
            <div className="s-card px-6 py-10 text-center">
              <h2 className="text-[16px] font-semibold">Couldn’t load projects</h2>
              <p className="mt-1.5 text-[14px] text-[var(--fg-3)]">{message || 'Something went wrong on our side.'}</p>
              <button type="button" onClick={() => loadProjects(true)} className="s-btn s-btn-plain mt-5">
                Try again
              </button>
            </div>
          ) : matched === 0 ? (
            <div className="s-card px-6 py-12 text-center">
              <h2 className="text-[16px] font-semibold">{q ? `Nothing matches “${query.trim()}”` : 'No projects yet'}</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-[var(--fg-3)]">
                {q ? 'Try a shorter or different term.' : 'Approved member projects will appear here.'}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                {q && (
                  <button type="button" onClick={() => setQuery('')} className="s-btn s-btn-plain">
                    Clear search
                  </button>
                )}
                <Link to="/dashboard?tab=submit-project" className="s-btn s-btn-accent">
                  Submit a project
                </Link>
              </div>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <li key={p.id}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="s-card group flex h-full flex-col p-5 transition-[box-shadow,transform] duration-200 [@media(hover:hover)]:hover:shadow-[var(--e2)] [@media(hover:hover)]:hover:-translate-y-px active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 truncate text-[16px] font-semibold tracking-[-0.012em]">{p.title}</h2>
                      <ArrowUpRight
                        size={16}
                        strokeWidth={1.75}
                        className="mt-0.5 shrink-0 text-slate-300 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-700"
                      />
                    </div>
                    {p.host && <p className="mt-0.5 truncate text-[13px] text-[var(--fg-3)]">{p.host}</p>}
                    <p className="mt-3 flex-1 text-[14px] leading-relaxed text-[var(--fg-2)] line-clamp-3">{p.description}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3 text-[12px] text-[var(--fg-3)]">
                      <span className="truncate">
                        {p.projType || ((p as any).source === 'bettergov.ph' ? 'bettergov.ph' : 'Community')}
                      </span>
                      {p.createdAt && (
                        <time className="num shrink-0" dateTime={p.createdAt}>
                          {new Date(p.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </time>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
