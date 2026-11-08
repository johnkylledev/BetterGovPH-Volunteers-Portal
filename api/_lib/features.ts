/*
 * Server-side feature switches.
 *
 * The client has its own copy in src/constants/features.ts, but hiding a button is not turning a
 * feature off: the API has to refuse the request too, or the endpoint is still there for anyone who
 * knows the URL. Both default to off, so an environment where nobody set the variable is closed
 * rather than open.
 */

export const flagOn = (value: string | undefined): boolean =>
  String(value ?? '').trim().toLowerCase() === 'true';

/** The Volunteer Card and its public verification lookup. See src/constants/features.ts for why. */
export const cardsEnabled = (env: { CARDS_ENABLED?: string } = process.env): boolean =>
  flagOn(env.CARDS_ENABLED);
