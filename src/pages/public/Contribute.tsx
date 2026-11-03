import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { SiteLayout, PageIntro } from '../../components/site/SiteLayout';
import { Reveal } from '../../components/site/Reveal';
import { RoleList, JoinBand } from '../../components/site/Sections';
import { DISCORD_INVITE, GITHUB_ORG } from '../../components/site/links';

const CODE_STANDARDS = [
  { title: 'Readable first', desc: 'Someone new should understand it next month without asking you.' },
  { title: 'Follow what’s there', desc: 'Match the patterns already in the repo before introducing new ones.' },
  { title: 'Accessible', desc: 'Keyboard, screen reader, and contrast checks are part of done.' },
  { title: 'Works on a phone', desc: 'Most Filipinos will see it on mobile data. Test small and slow.' },
  { title: 'Typed', desc: 'TypeScript on the frontend; validate anything that comes from outside.' },
  { title: 'Ask before adding', desc: 'New dependencies get discussed in the issue first.' },
];

const Contribute: React.FC = () => (
  <SiteLayout>
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-16 sm:pt-20">
      <PageIntro
        title="Bring a skill and a few hours a week."
        lede="Everything we build is open source and run by volunteers. Here’s where help is needed most, and how we work once you’re in."
        actions={
          <>
            <Link to="/register" className="s-btn s-btn-accent">
              Apply for membership
              <ArrowRight size={16} strokeWidth={1.75} />
            </Link>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="s-btn s-btn-plain">
              Join the Discord
            </a>
          </>
        }
      />
    </section>

    <section className="border-t border-[var(--line)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
        <Reveal className="mb-8 max-w-2xl">
          <h2 className="text-[24px] sm:text-[28px]">Open roles</h2>
          <p className="mt-2 text-[15px] text-[var(--fg-2)]">Each role links to the matching issues on GitHub.</p>
        </Reveal>
        <Reveal>
          <RoleList />
        </Reveal>
      </div>
    </section>

    <section className="border-t border-[var(--line)] bg-[var(--card)]">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 py-16 sm:py-20 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <Reveal>
          <h2 className="text-[24px] sm:text-[28px]">Code in public, work in public.</h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--fg-2)]">
            Fork a repo, open a pull request, and someone from the team will review it. Small, focused changes get merged fastest.
          </p>
          <a
            href={GITHUB_ORG}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-6 inline-flex items-center gap-1 text-[14px] font-medium text-[var(--accent)]"
          >
            github.com/BetterGovPH
            <ArrowUpRight size={14} strokeWidth={1.75} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </Reveal>
        <Reveal delay={0.06}>
          <h3 className="text-[13px] font-medium text-[var(--fg-3)]">What we look for in a pull request</h3>
          <dl className="mt-3 grid border-t border-[var(--line)] sm:grid-cols-2 sm:gap-x-10">
            {CODE_STANDARDS.map((s) => (
              <div key={s.title} className="border-b border-[var(--line)] py-4">
                <dt className="text-[15px] font-semibold tracking-[-0.01em]">{s.title}</dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-[var(--fg-2)]">{s.desc}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>

    <JoinBand />
  </SiteLayout>
);

export default Contribute;
