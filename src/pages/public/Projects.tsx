import React, { useEffect, useState, useCallback } from 'react';
import { ExternalLink, FolderKanban, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApprovedProjects, supabase } from '../../services/supabase';
import { Project } from '../../types';
import clsx from 'clsx';
import { Navbar } from '../../components/Navbar';

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
        {
          event: '*',
          schema: 'public',
          table: 'project_submissions',
        },
        () => {
          loadProjects(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(projectsChannel);
    };
  }, [loadProjects]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-14 sm:pt-32 sm:pb-18">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-7 sm:mb-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-slate-50 border border-slate-200 mb-4 sm:mb-5">
              <FolderKanban size={14} className="text-blue-900" />
              <span className="text-[11px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider">Projects</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-display font-bold leading-tight tracking-tight">
              Community projects.
            </h1>
            <p className="mt-2.5 sm:mt-3 text-xs sm:text-base text-slate-600 max-w-xl leading-relaxed">
              Approved projects submitted by members. Browse demos, docs, and repositories.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[6px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-xs font-semibold transition-all w-full sm:w-auto sm:self-start"
          >
            <Home size={14} />
            Back to Home
          </Link>
        </div>

        {status === 'loading' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[160px] rounded-[6px] bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="mt-6 sm:mt-8 px-4 py-3 rounded-[6px] border border-red-200 bg-red-50 text-red-800 text-xs sm:text-sm font-semibold">
            {message || 'Failed to load projects.'}
          </div>
        )}

        {status !== 'loading' && status !== 'error' && (
          <div>
            {projects.length === 0 ? (
              <div className="px-5 sm:px-6 py-10 sm:py-12 rounded-[6px] bg-white border border-slate-200 text-center text-xs sm:text-sm text-slate-600">
                No approved projects yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((p) => (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group bg-white border border-slate-200 rounded-[6px] p-4 sm:p-5 hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-2.5 sm:gap-3 mb-3 sm:mb-4">
                      <div className="min-w-0 flex-grow">
                        <p className="text-sm sm:text-base font-bold text-slate-900 truncate">{p.title}</p>
                        <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-500 break-all leading-tight">{p.url}</p>
                      </div>
                      <div className="p-2 rounded-[6px] bg-slate-50 border border-slate-200 text-slate-500 group-hover:text-blue-700 group-hover:bg-blue-50 group-hover:border-blue-200 transition-all flex-shrink-0">
                        <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed line-clamp-3 mb-3 sm:mb-4 flex-grow">{p.description}</p>

                    {p.projType && (
                      <span className={clsx(
                        "inline-flex self-start px-2.5 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wider",
                        "bg-blue-50 text-blue-800 border border-blue-100"
                      )}>
                        {p.projType}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
