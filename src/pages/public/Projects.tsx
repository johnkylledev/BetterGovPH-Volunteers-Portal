import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ExternalLink, FolderKanban, Home, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApprovedProjects, supabase } from '../../services/supabase';
import { Project } from '../../types';
import { Navbar } from '../../components/Navbar';

const hostnameFromUrl = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const loadProjects = useCallback(async (isInitial = false) => {
    if (isInitial) setStatus('loading');
    setMessage('');
    try {
      const list = await getApprovedProjects();
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

  const enriched = useMemo(() => {
    return projects.map((p) => ({ ...p, host: hostnameFromUrl(p.url) }));
  }, [projects]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar />

      <main className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 pt-20 pb-12 sm:pt-24 sm:pb-16">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-white border border-slate-200 mb-3.5 sm:mb-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <FolderKanban size={13} className="text-blue-900" />
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.14em]">Projects</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-display font-bold leading-tight tracking-tight">
              Community projects.
            </h1>
            <p className="mt-2 text-[12px] sm:text-[13.5px] text-slate-600 max-w-xl leading-relaxed">
              Approved projects submitted by members. Browse demos, docs, and repositories.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:self-start">
            <Link
              to="/dashboard?tab=submit-project"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-[7px] rounded-[6px] bg-slate-900 text-white text-[11.5px] font-bold hover:bg-slate-800 active:scale-[0.98] transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] w-full sm:w-auto shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_20px_-8px_rgba(15,23,42,0.25)]"
            >
              <Plus size={13} />
              Submit Project
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-[7px] rounded-[6px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11.5px] font-semibold active:scale-[0.98] transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] w-full sm:w-auto shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <Home size={13} />
              Home
            </Link>
          </div>
        </div>

        {status === 'loading' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-[6px] border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-6px_rgba(15,23,42,0.06)]">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-4 w-4 rounded bg-slate-100" />
                  <div className="h-4 w-4 rounded bg-slate-100" />
                </div>
                <div className="h-3.5 w-[55%] bg-slate-200 rounded mb-1.5" />
                <div className="h-2.5 w-[96%] bg-slate-100 rounded mb-1.5" />
                <div className="h-2.5 w-[80%] bg-slate-100 rounded mb-3" />
                <div className="flex gap-1.5">
                  <div className="h-4 w-14 bg-slate-100 rounded-[4px]" />
                  <div className="h-4 w-20 bg-slate-100 rounded-[4px]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 px-4 py-3 rounded-[6px] border border-red-200 bg-red-50 text-red-800 text-[12px] font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {message || 'Failed to load projects.'}
          </div>
        )}

        {status !== 'loading' && status !== 'error' && (
          projects.length === 0 ? (
            <div className="rounded-[6px] border border-slate-200/80 bg-white py-10 sm:py-12 px-5 sm:px-8 flex flex-col items-center text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
              <div className="w-10 h-10 rounded-[6px] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3.5 shadow-inner">
                <FolderKanban size={16} />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-1">No projects yet.</h2>
              <p className="text-[12px] sm:text-[13px] text-slate-500 max-w-sm mb-4 leading-relaxed">
                Be the first to ship an approved community project.
              </p>
              <Link
                to="/dashboard?tab=submit-project"
                className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[6px] bg-slate-900 text-white text-[11.5px] font-bold hover:bg-slate-800 active:scale-[0.98] transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_20px_-8px_rgba(15,23,42,0.25)]"
              >
                <Plus size={13} />
                Submit First Project
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {enriched.map((p, i) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative block rounded-[6px] border border-slate-200/80 bg-white p-3.5 sm:p-4 hover:border-slate-200 hover:-translate-y-[1px] hover:shadow-[0_0_0_1px_rgba(15,23,42,0.04),0_10px_28px_-10px_rgba(15,23,42,0.14),0_2px_4px_-2px_rgba(15,23,42,0.06)] active:scale-[0.99] active:translate-y-0 transition-[transform,box-shadow,border-color,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
                >
                  <div className="flex items-start justify-between mb-3 sm:mb-3.5">
                    <span className="inline-flex items-center text-[10.5px] font-bold tabular-nums text-blue-900/25 group-hover:text-blue-900/50 transition-colors duration-200 pt-[1px]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-[6px] bg-slate-50 border border-slate-100 text-slate-300 group-hover:text-blue-700 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors duration-200 shrink-0">
                      <ExternalLink size={12} />
                    </span>
                  </div>
                  <h2 className="text-[13.5px] sm:text-[14.5px] font-bold text-slate-900 tracking-tight leading-tight truncate mb-1.5">
                    {p.title}
                  </h2>
                  <p className="text-[12px] sm:text-[12.5px] text-slate-600 leading-snug line-clamp-3 mb-3 sm:mb-3.5 min-h-[44px] sm:min-h-[46px]">
                    {p.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.host && (
                      <span className="inline-flex items-center px-2 py-[3px] rounded-[4px] bg-slate-50 border border-slate-200/80 text-[10px] font-semibold text-slate-600 tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                        {p.host}
                      </span>
                    )}
                    {p.projType && (
                      <span className="inline-flex items-center px-2 py-[3px] rounded-[4px] bg-blue-50 border border-blue-100 text-[10px] font-bold uppercase tracking-wider text-blue-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                        {p.projType}
                      </span>
                    )}
                    {p.createdAt && (
                      <span className="inline-flex items-center text-[10px] font-medium text-slate-400 tabular-nums ml-auto sm:ml-0">
                        {new Date(p.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
