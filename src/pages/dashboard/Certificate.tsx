import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer } from 'lucide-react';
import { getCertificate } from '../../services/supabase';
import type { CertificateData } from '../../types';

const fmtDate = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
const fmtHours = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1));

/**
 * Certificate of volunteer service: legal name, roles, confirmed hours per project, and a QR code to
 * the public verify page. "Save as PDF" uses the browser's print dialog (A4 landscape).
 */
export default function Certificate() {
  const [data, setData] = useState<CertificateData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getCertificate().then(setData).catch((err) => setError(err instanceof Error ? err.message : 'Couldn’t load your certificate'));
  }, []);

  const verifyUrl = data?.memberId ? `${window.location.origin}/verify/${data.memberId}` : window.location.origin;

  return (
    <div className="site min-h-screen bg-slate-100 pb-16 print:bg-white print:pb-0">
      <style>{`@media print { @page { size: A4 landscape; margin: 0; } .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      <div className="no-print mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pt-6 sm:px-6">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-[14px] text-slate-600 hover:text-slate-900">
          <ArrowLeft size={15} strokeWidth={1.75} />Back to dashboard
        </Link>
        {data && (
          <button type="button" onClick={() => window.print()} className="s-btn s-btn-accent">
            <Printer size={16} strokeWidth={1.75} />Save as PDF or print
          </button>
        )}
      </div>

      {error ? (
        <div className="mx-auto mt-16 max-w-md px-4 text-center">
          <h1 className="text-[22px]">No certificate yet</h1>
          <p className="mt-2 text-[15px] text-slate-600">{error}</p>
          <Link to="/dashboard" className="s-btn s-btn-plain mt-5">Back to dashboard</Link>
        </div>
      ) : !data ? (
        <p className="mt-16 text-center text-[14px] text-slate-500" role="status">Preparing your certificate…</p>
      ) : (
        <div className="mx-auto mt-6 max-w-5xl px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
          <article
            className="relative mx-auto aspect-[297/210] w-full overflow-hidden rounded-[14px] bg-white shadow-[0_24px_60px_-24px_rgb(15_23_42/0.35)] print:rounded-none print:shadow-none"
            style={{ fontFamily: '"Open Runde", Inter, system-ui, sans-serif' }}
          >
            {/* Frame */}
            <div className="absolute inset-[3.2%] rounded-[10px] border-[1.5px] border-[#1e3a8a]/25 print:rounded-none" aria-hidden />
            <div className="absolute inset-x-0 top-0 h-[2.2%] bg-[linear-gradient(90deg,#1d4ea8,#0d2c6e)]" aria-hidden />

            <div className="relative flex h-full flex-col px-[8%] py-[6.5%]">
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src="/logo.svg" alt="" className="h-[clamp(28px,4.2vw,44px)] w-auto" />
                  <div className="leading-tight">
                    <p className="text-[clamp(12px,1.5vw,16px)] font-semibold text-slate-900">BetterGovPH</p>
                    <p className="text-[clamp(9px,1.05vw,12px)] text-slate-500">Volunteers</p>
                  </div>
                </div>
                <p className="num text-right text-[clamp(9px,1.05vw,12px)] text-slate-500">Issued {fmtDate(data.issuedAt)}</p>
              </header>

              <div className="mt-[5%] text-center">
                <p className="text-[clamp(10px,1.25vw,14px)] font-medium tracking-[0.18em] text-[#1e3a8a]">CERTIFICATE OF VOLUNTEER SERVICE</p>
                <p className="mt-[2%] text-[clamp(10px,1.2vw,14px)] text-slate-500">This certifies that</p>
                <h1 className="mt-[1.2%] text-[clamp(22px,4.4vw,52px)] font-semibold tracking-[-0.02em] text-slate-900">{data.name}</h1>
                <p className="mx-auto mt-[1.6%] max-w-[78%] text-[clamp(10px,1.3vw,15px)] leading-relaxed text-slate-600">
                  served as a volunteer {data.role ? <><span className="font-medium text-slate-800">{data.role}</span>{data.secondaryRole ? <> and {data.secondaryRole}</> : null}</> : null} with the
                  BetterGovPH civic tech community, contributing <span className="font-semibold text-slate-900">{fmtHours(data.totalHours)} confirmed hours</span>
                  {data.items.length ? <> across {data.items.length} {data.items.length === 1 ? 'project' : 'projects and calls'}</> : null}.
                </p>
              </div>

              {data.items.length > 0 && (
                <table className="mx-auto mt-[3%] w-[78%] text-left text-[clamp(9px,1.1vw,13px)]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-[0.8%] font-medium">Project or call</th>
                      <th className="py-[0.8%] font-medium">Period</th>
                      <th className="py-[0.8%] text-right font-medium">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.slice(0, 6).map((it) => (
                      <tr key={it.name + it.from} className="border-b border-slate-100 text-slate-800">
                        <td className="py-[0.8%] pr-3">{it.name}</td>
                        <td className="num py-[0.8%] pr-3 text-slate-600">{fmtDate(it.from)}{it.to !== it.from ? ` – ${fmtDate(it.to)}` : ''}</td>
                        <td className="num py-[0.8%] text-right font-medium">{fmtHours(it.hours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <footer className="mt-auto flex items-end justify-between gap-6">
                <div className="text-[clamp(9px,1.05vw,12px)] text-slate-500">
                  <p>Member ID <span className="num font-medium text-slate-800">{data.memberId ?? '—'}</span>{data.yearJoined ? <> · member since {data.yearJoined}</> : null}</p>
                  <p className="mt-1">Hours are confirmed by team heads and call organisers on the portal.</p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div className="text-[clamp(8px,0.95vw,11px)] text-slate-500">
                    <p className="font-medium text-slate-700">Scan to verify</p>
                    <p className="break-all">{verifyUrl.replace(/^https?:\/\//, '')}</p>
                  </div>
                  <QRCodeSVG value={verifyUrl} size={88} level="M" className="h-[clamp(56px,8vw,96px)] w-[clamp(56px,8vw,96px)]" />
                </div>
              </footer>
            </div>
          </article>
          {data.totalHours === 0 && (
            <p className="no-print mt-4 text-center text-[13px] text-slate-500">
              No confirmed hours yet. Log hours from your dashboard; once a team head confirms them they appear here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
