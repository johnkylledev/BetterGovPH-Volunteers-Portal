import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { SiteLayout } from '../../components/site/SiteLayout';
import { useStore } from '../../store/useStore';
import { createOrUpdateUserRecord } from '../../services/supabase';

const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: 'Everyone is welcome',
    points: [
      'Developers, designers, writers, educators, lawyers, organisers and first-timers all belong here. You don’t need to code.',
      'Treat people with respect regardless of gender, sexual orientation, age, disability, appearance, ethnicity, religion, politics, region, language or level of experience.',
    ],
  },
  {
    title: 'How we work together',
    points: [
      'Assume good intent, ask before assuming, and explain your reasoning.',
      'Work in the open where you can: share progress early, document decisions, and credit the people who helped.',
      'Projects run themselves. Respect each team’s decisions, and remember you speak for yourself, not for all of BetterGovPH.',
      'Keep commitments small and honest. If you can’t continue, say so and hand over your work.',
    ],
  },
  {
    title: 'Not acceptable',
    points: [
      'Harassment, threats, insults, or discriminatory jokes, online or at events.',
      'Sexual language or imagery, unwelcome attention, or inappropriate contact.',
      'Sharing someone’s personal information (doxxing), or exposing data a project holds about people.',
      'Spam, scams, partisan campaigning using the community’s name, or misleading posts.',
      'Repeatedly disrupting discussions, meetings or events.',
    ],
  },
  {
    title: 'If something goes wrong',
    points: [
      'If someone asks you to stop, stop.',
      'Use “Report” on a call or project, or tell an admin or the team head. Reports are confidential: the person reported isn’t told who reported them.',
      'Admins may hide posts, remove people from teams, or end a membership. Team heads and event organisers can ask someone to leave.',
    ],
  },
];

export default function CodeOfConduct() {
  const currentUser = useStore((s) => s.currentUser);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const [busy, setBusy] = useState(false);
  const agreed = !!currentUser?.cocAcceptedAt;

  return (
    <SiteLayout>
      <article className="mx-auto max-w-[680px] px-4 pb-20 pt-14 sm:px-6 sm:pt-20">
        <h1 className="text-[32px] sm:text-[40px]">Code of conduct</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-[var(--fg-2)]">
          BetterGovPH is open collaboration for a better government. These are the ground rules for the portal, our chats and our events.
        </p>

        <div className="mt-12 space-y-10">
          {SECTIONS.map((sec, i) => (
            <section key={sec.title} aria-labelledby={`coc-${i}`}>
              <h2 id={`coc-${i}`} className="flex items-baseline gap-3 text-[19px]">
                <span className="num text-[15px] font-normal text-[var(--fg-3)]">{i + 1}.</span>
                {sec.title}
              </h2>
              <ul className="mt-3 space-y-2.5 text-[16px] leading-relaxed text-[var(--fg-2)]">
                {sec.points.map((p) => (
                  <li key={p} className="flex gap-3"><span aria-hidden className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />{p}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-[14px] bg-white p-5 shadow-[0_0_0_1px_rgb(15_23_42/0.1)]">
          {currentUser ? (
            agreed ? (
              <p className="flex items-center gap-2 text-[15px] font-medium text-emerald-800">
                <Check size={18} strokeWidth={2.25} />
                You agreed on {new Date(currentUser.cocAcceptedAt!).toLocaleDateString(undefined, { dateStyle: 'medium' })}.
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[15px] text-slate-700">Agree to take part on these terms.</p>
                <button
                  type="button"
                  disabled={busy}
                  className="s-btn s-btn-accent"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const saved = await createOrUpdateUserRecord({ acceptCoc: true });
                      if (saved) setCurrentUser({ ...currentUser, ...saved });
                      toast.success('Thanks for agreeing');
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Couldn’t save');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Saving…' : 'I agree'}
                </button>
              </div>
            )
          ) : (
            <p className="text-[15px] text-slate-700">
              You’ll be asked to agree when you <Link to="/register" className="s-link">join</Link>.
            </p>
          )}
        </div>
      </article>
    </SiteLayout>
  );
}
