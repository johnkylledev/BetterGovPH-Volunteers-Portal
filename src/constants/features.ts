/*
 * Feature switches.
 *
 * Off is the safe state: a switch has to be turned on deliberately, so an environment where nobody
 * set the variable shows the feature as unavailable rather than exposing it by accident.
 */

const on = (value: unknown) => String(value ?? '').trim().toLowerCase() === 'true';

/**
 * The Volunteer Card and its public verification page.
 *
 * Turned off while the card could be mistaken for official government identification — a member
 * waving it at the wrong moment misrepresents BetterGovPH, and that is not a risk worth carrying
 * for a feature that can wait. Everything stays built; nothing is reachable.
 *
 * Turn it back on with `VITE_CARDS_ENABLED=true` (and `CARDS_ENABLED=true` for the API, which
 * refuses card lookups independently — the client switch alone would only hide the buttons).
 */
export const CARDS_ENABLED = on(import.meta.env.VITE_CARDS_ENABLED);
