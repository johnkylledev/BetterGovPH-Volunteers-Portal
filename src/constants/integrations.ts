/**
 * Discord linking is paused while the integration is unavailable. With this off, every
 * "Connect Discord" button becomes a "Coming soon" label, so there's nothing to click that would fail.
 * Flip to true (or set VITE_DISCORD_ENABLED=true) once the integration is back.
 */
export const DISCORD_AVAILABLE = import.meta.env.VITE_DISCORD_ENABLED === 'true';

/** Non-interactive label shown in place of a Connect button. */
export const COMING_SOON_PILL =
  'inline-flex h-8 shrink-0 items-center rounded-full bg-white px-3 text-[12px] font-medium text-slate-500 shadow-[0_0_0_1px_rgb(15_23_42/0.1)]';
