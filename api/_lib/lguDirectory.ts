/*
 * Parses the BetterLGU directory.
 *
 * lgu.bettergov.ph is a Jekyll site rendered from one Markdown table in the README of
 * jmacj/better-lgu-directory. That README is the source of truth, so we read it raw from GitHub —
 * no token, no API quota — and turn the table into rows. Kept in its own module so the shape can be
 * tested against a real sample of the table without booting the API.
 */

export type LguMaintainer = { login: string; profileUrl: string; avatarUrl: string };

/**
 * The directory hosts a logo for some LGUs, named after the portal's domain. Only the rendered
 * index knows which extension each one uses, so read the filenames from there rather than guessing
 * and leaving a trail of 404s. Returns domain → absolute url; an empty map is fine, the UI falls
 * back to the LGU's initials.
 */
export function parseLguLogos(html: string, base = 'https://lgu.bettergov.ph/'): Map<string, string> {
  const logos = new Map<string, string>();
  for (const m of html.matchAll(/assets\/images\/lgu-logos\/([A-Za-z0-9._-]+\.(?:svg|png|jpg|jpeg|webp))/g)) {
    const file = m[1];
    const domain = file.replace(/\.(svg|png|jpg|jpeg|webp)$/i, '').toLowerCase();
    if (!logos.has(domain)) logos.set(domain, new URL(`assets/images/lgu-logos/${file}`, base).toString());
  }
  return logos;
}

export type LguRow = {
  name: string;
  /** "Solano" and "Nueva Vizcaya" from "Solano, Nueva Vizcaya". */
  city: string;
  province: string;
  domain: string;
  url: string;
  repoUrl: string;
  socialUrl: string;
  status: LguStatus;
  statusLabel: string;
  /** A planned entry the directory has flagged as quiet for 30+ days. */
  stale: boolean;
  openForAdoption: boolean;
  /** The portal's own logo, where the directory has one. */
  logoUrl: string;
  maintainers: LguMaintainer[];
};

export type LguStatus = 'active' | 'wip' | 'unmaintained' | 'planned';

/** The badge emoji is what the directory keys on; the words beside it vary between rows. */
const STATUSES: { key: LguStatus; label: string; badge: string }[] = [
  { key: 'active', label: 'Active', badge: '\u{1F7E2}' },
  { key: 'wip', label: 'Work in progress', badge: '\u{1F7E1}' },
  { key: 'unmaintained', label: 'Unmaintained', badge: '\u{1F534}' },
  { key: 'planned', label: 'Planned', badge: '\u{1F535}' },
];

export const LGU_STATUS_LABEL: Record<LguStatus, string> =
  STATUSES.reduce((acc, s) => ({ ...acc, [s.key]: s.label }), {} as Record<LguStatus, string>);

const httpUrl = (raw: string): string => {
  try {
    const u = new URL(raw);
    return (u.protocol === 'https:' || u.protocol === 'http:') && raw.length <= 500 ? u.toString() : '';
  } catch { return ''; }
};

/** `[text](https://…)` → both halves. Plain text, `-` or an empty cell gives no url. */
const mdLink = (cell: string): { text: string; url: string } => {
  const m = cell.match(/\[([^\]]*)\]\(\s*([^)\s]+)[^)]*\)/);
  if (m) return { text: m[1].trim(), url: httpUrl(m[2]) };
  const text = cell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { text: text === '-' ? '' : text, url: '' };
};

/**
 * The best icon a portal declares for itself, resolved against the page it came from.
 *
 * The directory only has logo files for some LGUs; the rest declare their own favicon, and these
 * portals do it properly — `favicon.svg`, `favicon.webp`, an apple-touch-icon. Reading the markup
 * beats guessing `/favicon.ico`, which most of them do not have. Nothing is copied or stored: the
 * result is a url on the LGU's own site, so a logo they change is the logo we show.
 */
export function pickIconFromHtml(html: string, pageUrl: string): string {
  // Only the head matters, and it keeps a huge SPA payload out of the regex.
  const head = html.slice(0, 60_000);
  type Found = { href: string; score: number };
  const found: Found[] = [];
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1] ?? '').toLowerCase();
    if (!/\b(apple-touch-icon|apple-touch-icon-precomposed|icon|shortcut icon|mask-icon)\b/.test(rel)) continue;
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || href.startsWith('data:')) continue;
    const type = (tag.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1] ?? '').toLowerCase();
    const size = Number((tag.match(/\bsizes\s*=\s*["'](\d+)/i)?.[1] ?? 0));
    // Prefer something that stays sharp at 44px: a touch icon, then a vector, then the biggest
    // declared raster. A bare .ico is the last thing worth showing.
    let score = 0;
    if (/apple-touch-icon/.test(rel)) score += 120;
    if (type.includes('svg') || /\.svg(\?|$)/i.test(href)) score += 100;
    if (/\.(png|webp)(\?|$)/i.test(href) || type.includes('png') || type.includes('webp')) score += 40;
    if (/\.ico(\?|$)/i.test(href) || type.includes('icon')) score -= 20;
    score += Math.min(size, 512) / 8;
    found.push({ href, score });
  }
  if (!found.length) return '';
  found.sort((a, b) => b.score - a.score);
  try {
    const u = new URL(found[0].href, pageUrl);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch { return ''; }
}

export function parseLguTable(markdown: string, logos?: Map<string, string>): LguRow[] {
  // The table sits between sync markers; without them, scan the whole file.
  const start = markdown.indexOf('SYNC_LGU_TABLE_START');
  const endAt = markdown.indexOf('SYNC_LGU_TABLE_END');
  const body = start >= 0 ? markdown.slice(start, endAt > start ? endAt : undefined) : markdown;

  const rows: LguRow[] = [];
  const seen = new Set<string>();
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.length < 6) continue;
    if (/^:?-{2,}:?$/.test(cells[0])) continue; // the --- separator row
    if (/^lgu$/i.test(cells[0])) continue;      // the header row

    const [nameCell, domainCell, repoCell, socialCell, statusCell, maintainerCell] = cells;
    const name = mdLink(nameCell).text;
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    const domain = mdLink(domainCell);
    const status = STATUSES.find((s) => statusCell.includes(s.badge));
    // Maintainers are GitHub handles: `[@handle](https://github.com/handle)`, comma separated.
    const maintainers = [...maintainerCell.matchAll(/\[@([A-Za-z0-9][A-Za-z0-9-]{0,38})\]\(\s*([^)\s]+)[^)]*\)/g)]
      .map((m) => ({
        login: m[1],
        profileUrl: httpUrl(m[2]) || `https://github.com/${m[1]}`,
        // GitHub serves every profile picture here: no API call, and it follows a change of avatar.
        avatarUrl: `https://github.com/${m[1]}.png?size=80`,
      }));

    const comma = name.lastIndexOf(',');
    rows.push({
      name,
      city: comma > 0 ? name.slice(0, comma).trim() : name,
      province: comma > 0 ? name.slice(comma + 1).trim() : '',
      domain: domain.text,
      url: domain.url,
      repoUrl: mdLink(repoCell).url,
      socialUrl: mdLink(socialCell).url,
      status: status?.key ?? 'planned',
      statusLabel: status?.label ?? 'Planned',
      logoUrl: logos?.get(domain.text.toLowerCase()) ?? '',
      stale: /stale/i.test(statusCell),
      openForAdoption: /adoption/i.test(`${statusCell} ${maintainerCell}`),
      maintainers,
    });
  }
  return rows;
}
