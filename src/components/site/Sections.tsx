import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { DISCORD_INVITE, ROLES } from './links';
import { Reveal } from './Reveal';

/** Open roles as cards. Each one links to the matching GitHub issues (or Discord for advocacy). */
export const RoleList: React.FC = () => (
  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {ROLES.map((role, i) => {
      const onDiscord = role.href === DISCORD_INVITE;
      return (
        <li key={role.title}>
          <Reveal delay={Math.min(i, 5) * 0.04} className="h-full">
            <a
              href={role.href}
              target="_blank"
              rel="noopener noreferrer"
              className="s-card group flex h-full flex-col p-6 transition-[box-shadow,transform] duration-200 [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:shadow-[var(--e2)] active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="inline-flex items-center gap-2 text-[17px] font-semibold">
                  <role.icon size={18} strokeWidth={1.75} className="shrink-0 text-[var(--accent)]" aria-hidden />
                  {role.title}
                </h3>
                <span className="num shrink-0 rounded-full px-2 py-0.5 text-[12px] text-[var(--fg-3)] shadow-[inset_0_0_0_1px_var(--line)]">
                  {role.commitment}
                </span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--fg-2)]">{role.description}</p>
              <ul className="mt-4 flex flex-1 flex-wrap content-start gap-1.5" aria-label="Skills">
                {role.skills.map((skill) => (
                  <li key={skill} className="rounded-md bg-[var(--muted)] px-2 py-1 text-[12px] font-medium text-[var(--fg-2)]">
                    {skill}
                  </li>
                ))}
              </ul>
              <span className="mt-6 inline-flex items-center gap-1 border-t border-[var(--line)] pt-4 text-[14px] font-medium text-[var(--accent)]">
                {onDiscord ? 'Join on Discord' : 'See open issues'}
                <ArrowUpRight
                  size={14}
                  strokeWidth={1.75}
                  className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </span>
            </a>
          </Reveal>
        </li>
      );
    })}
    <li className="sm:col-span-2 lg:col-span-3">
      <Reveal>
        <div className="flex flex-col gap-4 rounded-[14px] px-6 py-5 shadow-[inset_0_0_0_1px_var(--line)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] font-semibold">Don’t see your role?</p>
            <p className="mt-0.5 text-[14px] text-[var(--fg-2)]">
              Lawyers, writers, translators, organizers — introduce yourself and tell us what you’re good at.
            </p>
          </div>
          <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="s-btn s-btn-plain shrink-0">
            Say hello on Discord
          </a>
        </div>
      </Reveal>
    </li>
  </ul>
);

/** Closing call to action, shared by the landing and contribute pages. */
export const JoinBand: React.FC = () => (
  <section className="bg-[#0b1220] text-white">
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
      <Reveal className="max-w-2xl">
        <h2 className="text-[32px] sm:text-[44px] text-white">
          Hindi tayo tumitingin.
          <span className="block text-slate-400">Tayo ang gumagawa.</span>
        </h2>
        <p className="mt-5 text-[16px] leading-relaxed text-slate-300">
          We don't just watch. Bring a skill and a few hours a week, and help build the government services we deserve.
        </p>
        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
          <Link
            to="/register"
            className="s-btn bg-white text-slate-900 shadow-[inset_0_-1px_0_rgb(15_23_42/0.08)] [@media(hover:hover)]:hover:bg-slate-100"
          >
            Apply for membership
            <ArrowRight size={16} strokeWidth={1.75} />
          </Link>
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="s-btn text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)] [@media(hover:hover)]:hover:bg-white/5"
          >
            Join the Discord
          </a>
        </div>
      </Reveal>
    </div>
  </section>
);
