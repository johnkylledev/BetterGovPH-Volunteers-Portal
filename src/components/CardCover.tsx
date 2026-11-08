import React from 'react';
import clsx from 'clsx';

/**
 * Covers the Volunteer Card while the feature is switched off.
 *
 * It wraps the real card rather than replacing it, which is what keeps every layout intact: the
 * hero, the dashboard column and the admin modals each hold exactly the height they were designed
 * around, because the thing inside is still the card.
 *
 * What changes is that it cannot be read or used. The card is blurred past legibility — no name,
 * no member ID, no scannable code — and the card passed in should be `isDemo`, so clicking it goes
 * nowhere. The verification endpoint refuses independently, so even a code recovered from the
 * screen leads nowhere either.
 *
 * The card keeps its own motion underneath: it arrives once and still leans toward the pointer,
 * which is what makes this read as "nearly here" rather than broken. The plate on top stays sharp
 * and does not intercept the pointer.
 */
export const CardCover: React.FC<{
  /** The card to cover — pass it with `isDemo` so it is inert. */
  children: React.ReactNode;
  /** One line on what this particular person is waiting for. */
  note?: string;
  className?: string;
}> = ({ children, note, className }) => (
  <div className={clsx('relative', className)}>
    <div aria-hidden className="select-none blur-[8px] saturate-[0.9] [&_*]:!cursor-default">
      {children}
    </div>

    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-5">
      <div className="rounded-[14px] bg-white/95 px-5 py-4 text-center shadow-[0_1px_2px_rgb(15_23_42/0.06),0_12px_28px_-10px_rgb(13_44_110/0.45),0_0_0_1px_rgb(15_23_42/0.06)] backdrop-blur-[2px]">
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-slate-900">
          The Volunteer Card is coming
        </p>
        <p className="mx-auto mt-1 max-w-[24ch] text-[12.5px] leading-snug text-slate-500">
          {note ?? 'We’re holding it back while we get it right.'}
        </p>
      </div>
    </div>
  </div>
);
