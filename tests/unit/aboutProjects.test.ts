import { describe, it, expect } from 'vitest';
import { parseAboutProjects } from '../../api/_lib/aboutProjects';

/*
 * A verbatim slice of https://about.bettergov.ph/projects/, with the quirks that matter: React's
 * `<!-- -->` between text nodes, &amp; in an area name, a relative screenshot path, and the card
 * for a project whose site is down, which is an <article> with no link rather than an anchor.
 */
const SAMPLE = `
<div id="projects-grid" class="work-grid">
<a href="https://dynasties.bettergov.ph" target="_blank" rel="noopener noreferrer" class="work-card reveal" aria-label="Visit Dynasties (opens in a new tab)"><div class="work-card__shot"><div class="frame"><div class="frame__bar" aria-hidden="true"><i></i><i></i><i></i><span>dynasties.bettergov.ph</span></div><div class="frame__view"><img src="/screenshots/portfolio-dynasties.webp" alt="Preview of the Dynasties website" loading="lazy" decoding="async"/></div></div><span class="tag work-card__new">New</span></div><p class="label work-card__meta"><span>Project <!-- -->01</span><span>Law &amp; governance</span></p><h2 class="title">Dynasties</h2><p class="copy">See every candidate for local office since 2001.</p><p class="work-card__go">Visit project <span aria-hidden="true">&#8599;</span></p></a>
<article class="work-card work-card--off reveal"><div class="work-card__shot"><div class="work-card__empty"><span>Preview unavailable</span></div><span class="tag work-card__new">New</span></div><p class="label work-card__meta"><span>Project <!-- -->14</span><span>Public services</span></p><h2 class="title">BetterNAIA</h2><p class="copy">Project details are temporarily unavailable while the public website is offline.</p><p class="work-card__go">Website unavailable</p></article>
<a href="https://transparency.bettergov.ph" target="_blank" rel="noopener noreferrer" class="work-card reveal"><div class="work-card__shot"><div class="frame"><div class="frame__bar" aria-hidden="true"><i></i><i></i><i></i><span>transparency.bettergov.ph</span></div><div class="frame__view"><img src="/screenshots/portfolio-transparency-portal.webp" alt="Preview"/></div></div></div><p class="label work-card__meta"><span>Project <!-- -->15</span><span>Data &amp; transparency</span></p><h2 class="title">Transparency Portal</h2><p class="copy">Civic transparency platform aggregating government data.</p><p class="work-card__go">Visit project</p></a>
</div>
`;

describe('parseAboutProjects', () => {
  const rows = parseAboutProjects(SAMPLE);

  it('reads every project that has somewhere to send you', () => {
    expect(rows.map((r) => r.title)).toEqual(['Dynasties', 'Transparency Portal']);
  });

  it('skips a project whose site is down, because the card is not a link', () => {
    expect(rows.find((r) => r.title === 'BetterNAIA')).toBeUndefined();
  });

  it('takes the area, not the "Project 01" counter beside it', () => {
    // React's `<!-- -->` sits inside that span and used to defeat the check.
    expect(rows[0].area).toBe('Law & governance');
    expect(rows[1].area).toBe('Data & transparency');
  });

  it('keeps the link, the domain and the description', () => {
    expect(rows[0].url).toBe('https://dynasties.bettergov.ph/');
    expect(rows[0].domain).toBe('dynasties.bettergov.ph');
    expect(rows[0].description).toBe('See every candidate for local office since 2001.');
  });

  it('makes the screenshot path absolute', () => {
    expect(rows[0].imageUrl).toBe('https://about.bettergov.ph/screenshots/portfolio-dynasties.webp');
  });

  it('notes which ones the site marks as new', () => {
    expect(rows[0].isNew).toBe(true);
    expect(rows[1].isNew).toBe(false);
  });

  // The caller falls back to the JSON feed on an empty result, so failing quiet is the right shape.
  it('returns nothing rather than guessing when the markup changes', () => {
    expect(parseAboutProjects('<main><p>Our work</p></main>')).toEqual([]);
    expect(parseAboutProjects('')).toEqual([]);
  });
});
