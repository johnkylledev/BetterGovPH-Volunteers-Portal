import React from 'react';
import { ArrowUpRight, Package } from 'lucide-react';
import { DISCORD_INVITE } from '../site/links';

/** Placeholder until merch is planned. Deliberately says nothing about specific items. */
export const MerchTab: React.FC = () => (
  <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14">
    <h1 className="text-[28px] sm:text-[32px]">Merch</h1>
    <div className="s-card mt-8 flex flex-col items-center px-6 py-14 text-center sm:py-20">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Package size={22} strokeWidth={1.75} />
      </span>
      <h2 className="mt-5 text-[20px]">Coming soon</h2>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-slate-600">
        This page isn’t ready yet. Announcements will go out on Discord first.
      </p>
      <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="s-btn s-btn-plain mt-6">
        Follow on Discord
        <ArrowUpRight size={15} strokeWidth={1.75} />
      </a>
    </div>
  </main>
);
