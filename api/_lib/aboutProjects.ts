/*
 * Reads the project list from about.bettergov.ph/projects.
 *
 * That page is the one BetterGovPH actually keeps current — it carries 29 projects with real
 * descriptions and areas, where the older bettergov.ph/api/projects.json has 18 and lags. It has no
 * JSON endpoint, but the markup is pre-rendered and server-fetchable, and each card is a plain
 * anchor with a stable set of classes. So we read the page.
 *
 * Parsing someone else's HTML is only acceptable because the alternative is a stale list, and
 * because it degrades honestly: a markup change yields nothing rather than nonsense, and the caller
 * falls back to the old JSON feed.
 */

export type AboutProject = {
  title: string;
  url: string;
  description: string;
  /** The area the site files it under: "Law & governance", "Data & transparency", … */
  area: string;
  /** The domain shown in the card's browser-chrome strip, e.g. "dynasties.bettergov.ph". */
  domain: string;
  /** Absolute url of the card's screenshot, when it has one. */
  imageUrl: string;
  isNew: boolean;
};

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

const decode = (raw: string): string =>
  raw
    // React leaves `<!-- -->` between adjacent text nodes; it is markup, not content.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[String(name).toLowerCase()] ?? whole)
    .replace(/\s+/g, ' ')
    .trim();

/** Inner text of the first element matching a class, tags stripped. */
const textOf = (card: string, tag: string, className: string): string => {
  const re = new RegExp(`<${tag}[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = card.match(re);
  return m ? decode(m[1].replace(/<[^>]+>/g, ' ')) : '';
};

const httpUrl = (raw: string, base?: string): string => {
  try {
    const u = new URL(raw, base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch { return ''; }
};

export function parseAboutProjects(html: string, pageUrl = 'https://about.bettergov.ph/projects/'): AboutProject[] {
  const out: AboutProject[] = [];
  const seen = new Set<string>();

  // Each project is one anchor carrying the work-card class. Split on the anchor openings rather
  // than trying to match balanced tags, which HTML does not reward.
  const parts = html.split(/<a\b/i).slice(1);
  for (const part of parts) {
    const open = part.slice(0, part.indexOf('>') + 1);
    if (!/class="[^"]*\bwork-card\b/i.test(open)) continue;
    const card = part.slice(0, part.search(/<\/a>/i) >= 0 ? part.search(/<\/a>/i) : undefined);

    const href = open.match(/href="([^"]+)"/i)?.[1] ?? '';
    const url = httpUrl(decode(href), pageUrl);
    const title = textOf(card, 'h2', 'title');
    const description = textOf(card, 'p', 'copy');
    if (!url || !title || !description || seen.has(url)) continue;
    seen.add(url);

    // The meta line reads "Project 01" then the area; only the second is worth keeping.
    const metaRaw = card.match(/class="[^"]*\bwork-card__meta\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
    const spans = [...metaRaw.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((m) => decode(m[1]));
    const area = spans.find((s) => s && !/^project\s*\d+$/i.test(s)) ?? '';

    const domain = decode(card.match(/class="[^"]*\bframe__bar\b[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
    const img = card.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? '';

    out.push({
      title,
      url,
      description,
      area,
      domain,
      imageUrl: img ? httpUrl(decode(img), pageUrl) : '',
      isNew: /\bwork-card__new\b/i.test(card),
    });
  }
  return out;
}
