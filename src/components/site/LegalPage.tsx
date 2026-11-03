import React from 'react';
import { SiteLayout } from './SiteLayout';
import { DISCORD_INVITE } from './links';

export interface LegalSection {
  n: string;
  title: string;
  body: React.ReactNode;
}

/** Reading layout for policy pages: narrow column, numbered sections. */
export const LegalPage: React.FC<{ title: string; lede: string; updated: string; sections: LegalSection[] }> = ({
  title,
  lede,
  updated,
  sections,
}) => (
  <SiteLayout>
    <article className="mx-auto max-w-[680px] px-4 sm:px-6 pt-14 pb-20 sm:pt-20">
      <p className="num text-[13px] text-[var(--fg-3)]">Last updated {updated}</p>
      <h1 className="mt-3 text-[32px] sm:text-[40px]">{title}</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-[var(--fg-2)]">{lede}</p>

      <div className="mt-12 space-y-10">
        {sections.map((s) => (
          <section key={s.n} aria-labelledby={`sec-${s.n}`}>
            <h2 id={`sec-${s.n}`} className="flex items-baseline gap-3 text-[19px]">
              <span className="num text-[15px] font-normal text-[var(--fg-3)]">{s.n}.</span>
              {s.title}
            </h2>
            <div className="mt-3 pl-7 text-[16px] leading-[1.65] text-[var(--fg-2)] [&_li]:relative [&_li]:pl-4 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-[var(--fg-3)] [&_li]:before:content-['–'] [&_ul]:!mt-0 [&_ul]:!space-y-2">
              {s.body}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-14 border-t border-[var(--line)] pt-6 text-[15px] text-[var(--fg-2)]">
        Questions about this page?{' '}
        <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="s-link">
          Ask the team on Discord
        </a>
        .
      </p>
    </article>
  </SiteLayout>
);
