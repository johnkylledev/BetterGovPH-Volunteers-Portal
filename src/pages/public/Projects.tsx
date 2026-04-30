import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApprovedProjects } from '../../services/supabase';
import { Project } from '../../types';
import clsx from 'clsx';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setStatus('loading');
      setMessage('');
      try {
        const list = await getApprovedProjects();
        if (!mounted) return;
        setProjects(list);
        setStatus('success');
      } catch (err: any) {
        if (!mounted) return;
        const m = err instanceof Error ? err.message : typeof err?.message === 'string' ? err.message : 'Failed to load projects';
        setStatus('error');
        setMessage(m);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="BetterGovPH Logo" className="h-7 w-auto" />
            <span className="font-display font-bold text-base tracking-tight text-blue-900">BetterGovPH</span>
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-900 text-white text-sm font-bold hover:bg-blue-800 transition-all"
          >
            Join
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Community Projects</h1>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">
              Approved projects submitted by members. Explore demos, docs, and repositories.
            </p>
          </div>
          <Link
            to="/"
            className="text-sm font-bold text-slate-600 hover:text-blue-700 transition-all"
          >
            Back to Landing
          </Link>
        </div>

        {status === 'loading' && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="mt-8 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-900 text-sm font-semibold">
            {message || 'Failed to load projects.'}
          </div>
        )}

        {status !== 'loading' && status !== 'error' && (
          <div className="mt-8">
            {projects.length === 0 ? (
              <div className="px-6 py-12 rounded-2xl bg-white border border-slate-200 text-center text-slate-600">
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
                    className="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-200 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-black text-slate-900 truncate">{p.title}</p>
                        <p className="mt-1 text-xs text-slate-500 break-all">{p.url}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 group-hover:text-blue-700 group-hover:border-blue-200 transition-all">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </div>

                    <p className="mt-4 text-sm text-slate-700 line-clamp-3">{p.description}</p>

                    {p.projType && (
                      <div className="mt-4">
                        <span className={clsx(
                          "inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                          "bg-blue-50 text-blue-800 border border-blue-100"
                        )}>
                          {p.projType}
                        </span>
                      </div>
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
