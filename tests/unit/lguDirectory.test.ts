import { describe, it, expect } from 'vitest';
import { parseLguTable, parseLguLogos, pickIconFromHtml } from '../../api/_lib/lguDirectory';

/*
 * A verbatim slice of the live table at https://github.com/jmacj/better-lgu-directory, kept with
 * its real quirks: ragged column padding, `-` for "none", a repo link that points at a branch, two
 * maintainers in one cell, and a planned entry carrying the Stale / Open for Adoption tags on a
 * second line. If upstream changes the format, this is what should fail first.
 */
const SAMPLE = `
## Directory

<!-- SYNC_LGU_TABLE_START -->

| LGU                           | Domain                                         | Repository                                                                     | Socials                                               | Status                 | Maintainer/s                                                                           |
|-------------------------------|------------------------------------------------|--------------------------------------------------------------------------------|-------------------------------------------------------|------------------------|----------------------------------------------------------------------------------------|
| Solano, Nueva Vizcaya         | [bettersolano.org](https://bettersolano.org)   | [GitHub](https://github.com/BetterSolano/bettersolano)                         | [Facebook](https://www.facebook.com/bettersolano.org) | 🟢 Active              | [@ramonloganjr](https://github.com/ramonloganjr)                                       |
| Calauan, Laguna               | [bettercalauan.org](https://bettercalauan.org) | [GitHub](https://github.com/bettercalauan/bettercalauan/tree/react-typescript) | -                                                     | 🟢 Active              | [@xpall](https://github.com/xpall)                                                     |
| Pila, Laguna                  | -                                              | [GitHub](https://github.com/Necookie/betterpila)                               | -                                                     | 🟡 Work in Progress    | [@Necookie](https://github.com/Necookie)                                               |
| Cainta, Rizal                 | [bettercainta.org](https://bettercainta.org)   | -                                                                              | -                                                     | 🟢 Active              | -                                                                                      |
| Las Piñas City, Metro Manila  | [betterlaspinas.org](https://betterlaspinas.org) | [GitHub](https://github.com/betterlaspinas/betterlaspinas)                   | -                                                     | 🟢 Active              | [@jmacj](https://github.com/jmacj), [@Martin-Enghoy](https://github.com/Martin-Enghoy) |
| Santo Tomas, Pangasinan       | -                                              | -                                                                              | -                                                     | 🔵 Planned<br>⚠️ Stale | [@PatrickTomas2](https://github.com/PatrickTomas2)<br>🤝 Open for Adoption             |
| Somewhere, Nowhere            | -                                              | -                                                                              | -                                                     | 🔴 Unmaintained        | -                                                                                      |

<!-- SYNC_LGU_TABLE_END -->

## Community Templates

| Template | Stack | Repository | Description |
|---|---|---|---|
| Better Solano Starter | React | [GitHub](https://github.com/x/y) | Not an LGU |
`;

describe('parseLguTable', () => {
  const rows = parseLguTable(SAMPLE);

  it('reads every entry and stops at the end marker', () => {
    // Seven data rows: the header, the separator and the templates table below must not slip in.
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.name)).not.toContain('Better Solano Starter');
  });

  it('splits the city from the province', () => {
    expect(rows[0]).toMatchObject({ name: 'Solano, Nueva Vizcaya', city: 'Solano', province: 'Nueva Vizcaya' });
    expect(rows[4].city).toBe('Las Piñas City');
  });

  it('keeps the domain, repository and socials apart, and leaves "-" empty', () => {
    expect(rows[0].url).toBe('https://bettersolano.org/');
    expect(rows[0].domain).toBe('bettersolano.org');
    expect(rows[0].socialUrl).toContain('facebook.com');
    expect(rows[1].repoUrl).toContain('/tree/react-typescript');
    expect(rows[2].url).toBe('');
    expect(rows[3].repoUrl).toBe('');
    expect(rows[3].socialUrl).toBe('');
  });

  it('reads the status from the badge, not the words', () => {
    expect(rows.map((r) => r.status)).toEqual(
      ['active', 'active', 'wip', 'active', 'active', 'planned', 'unmaintained'],
    );
    expect(rows[2].statusLabel).toBe('Work in progress');
  });

  it('picks up every maintainer with a usable avatar', () => {
    expect(rows[4].maintainers.map((m) => m.login)).toEqual(['jmacj', 'Martin-Enghoy']);
    expect(rows[4].maintainers[1].avatarUrl).toBe('https://github.com/Martin-Enghoy.png?size=80');
    expect(rows[4].maintainers[0].profileUrl).toBe('https://github.com/jmacj');
    expect(rows[3].maintainers).toEqual([]);
  });

  it('carries the stale and open-for-adoption tags', () => {
    expect(rows[5]).toMatchObject({ status: 'planned', stale: true, openForAdoption: true });
    expect(rows[5].maintainers.map((m) => m.login)).toEqual(['PatrickTomas2']);
    expect(rows[0].stale).toBe(false);
    expect(rows[0].openForAdoption).toBe(false);
  });

  it('returns nothing rather than guessing when the table is missing', () => {
    expect(parseLguTable('# Just a readme\n\nNo table here.')).toEqual([]);
  });
});

describe('parseLguLogos', () => {
  // The rendered index is the only place that says which extension each logo uses.
  const HTML = `
    <img src="/assets/images/lgu-logos/bettersolano.org.svg" alt="">
    <img src="https://lgu.bettergov.ph/assets/images/lgu-logos/bettercalauan.org.png" alt="">
    <img src="/assets/images/lgu-logos/bettersolano.org.svg" alt="">
    <img src="/assets/images/logos/BetterGov_Icon-Primary.svg" alt="">
  `;

  it('maps each domain to its real file, whatever the extension', () => {
    const logos = parseLguLogos(HTML);
    expect(logos.get('bettersolano.org')).toBe('https://lgu.bettergov.ph/assets/images/lgu-logos/bettersolano.org.svg');
    expect(logos.get('bettercalauan.org')).toBe('https://lgu.bettergov.ph/assets/images/lgu-logos/bettercalauan.org.png');
  });

  it('ignores the site’s own logos and does not invent entries', () => {
    const logos = parseLguLogos(HTML);
    expect(logos.size).toBe(2);
    expect(logos.get('bettercainta.org')).toBeUndefined();
  });

  it('attaches a logo only to the LGU that has one', () => {
    const rows = parseLguTable(SAMPLE, parseLguLogos(HTML));
    expect(rows[0].logoUrl).toContain('bettersolano.org.svg');
    expect(rows[1].logoUrl).toContain('bettercalauan.org.png');
    expect(rows[3].logoUrl).toBe('');  // Cainta has a portal but no logo on file
    expect(rows[2].logoUrl).toBe('');  // Pila has no portal at all
  });

  it('leaves every logo empty when the page could not be read', () => {
    expect(parseLguTable(SAMPLE).every((r) => r.logoUrl === '')).toBe(true);
  });
});

describe('pickIconFromHtml', () => {
  const at = (head: string) => pickIconFromHtml(`<html><head>${head}</head><body></body></html>`, 'https://betterindang.org/');

  it('resolves a relative icon against the page', () => {
    // betterindang.org declares exactly this.
    expect(at('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')).toBe('https://betterindang.org/favicon.svg');
  });

  it('takes the icon that stays sharp at card size', () => {
    const head = `
      <link rel="icon" href="/favicon.ico" sizes="16x16">
      <link rel="icon" type="image/webp" sizes="32x32" href="/favicon.webp">
      <link rel="apple-touch-icon" sizes="180x180" href="/touch.png">
    `;
    expect(at(head)).toBe('https://betterindang.org/touch.png');
  });

  it('prefers a vector over a small raster', () => {
    expect(at('<link rel="icon" href="/f.ico"><link rel="icon" href="/logo.svg">')).toBe('https://betterindang.org/logo.svg');
  });

  it('keeps an absolute href on another host', () => {
    expect(at('<link rel="icon" href="https://cdn.example.org/a.png">')).toBe('https://cdn.example.org/a.png');
  });

  it('returns nothing rather than a guess', () => {
    expect(at('<title>No icon here</title>')).toBe('');
    expect(at('<link rel="icon" href="data:image/png;base64,AAA">')).toBe('');
    expect(at('<link rel="stylesheet" href="/app.css">')).toBe('');
  });
});
