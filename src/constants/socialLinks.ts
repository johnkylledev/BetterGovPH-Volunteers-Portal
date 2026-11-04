import type { TrackId } from './tracks';

export type LinkKey = 'youtube' | 'tiktok' | 'facebook' | 'instagram' | 'x' | 'linkedin' | 'github' | 'portfolio';
export type ProfileLinks = Partial<Record<LinkKey, string>>;

export interface LinkPlatform {
  key: LinkKey;
  label: string;
  /** Brand colour for the small logo tile. */
  color: string;
  placeholder: string;
  /** Hostnames that count as this platform (portfolio accepts any). */
  hosts?: string[];
  /** Logo served from /public/link-icons (portfolio has none and shows a globe). */
  icon?: string;
}

export const LINK_PLATFORMS: Record<LinkKey, LinkPlatform> = {
  youtube: {
    key: 'youtube', label: 'YouTube', color: '#FF0000', placeholder: 'youtube.com/@yourchannel', hosts: ['youtube.com', 'youtu.be'], icon: '/link-icons/youtube.svg',
  },
  tiktok: {
    key: 'tiktok', label: 'TikTok', color: '#000000', placeholder: 'tiktok.com/@yourhandle or @handle', hosts: ['tiktok.com'], icon: '/link-icons/tiktok.svg',
  },
  facebook: {
    key: 'facebook', label: 'Facebook', color: '#0866FF', placeholder: 'facebook.com/yourpage', hosts: ['facebook.com', 'fb.com', 'fb.me'], icon: '/link-icons/facebook.svg',
  },
  instagram: {
    key: 'instagram', label: 'Instagram', color: '#E4405F', placeholder: 'instagram.com/yourhandle', hosts: ['instagram.com'], icon: '/link-icons/instagram.svg',
  },
  x: {
    key: 'x', label: 'X', color: '#000000', placeholder: 'x.com/yourhandle', hosts: ['x.com', 'twitter.com'], icon: '/link-icons/x.svg',
  },
  linkedin: {
    key: 'linkedin', label: 'LinkedIn', color: '#0A66C2', placeholder: 'linkedin.com/in/yourname', hosts: ['linkedin.com'], icon: '/link-icons/linkedin.svg',
  },
  github: {
    key: 'github', label: 'GitHub', color: '#24292f', placeholder: 'github.com/yourname', hosts: ['github.com'], icon: '/link-icons/github.svg',
  },
  portfolio: {
    key: 'portfolio', label: 'Website or portfolio', color: '#1e3a8a', placeholder: 'yourwebsite.com',
  },
};

/** Which links to ask for first, by the kind of work someone does. The rest sit under "More links". */
export const LINKS_BY_TRACK: Record<TrackId, LinkKey[]> = {
  create: ['youtube', 'tiktok', 'facebook', 'instagram', 'x', 'portfolio'],
  build: ['github', 'linkedin', 'portfolio'],
  teach: ['linkedin', 'youtube', 'facebook', 'portfolio'],
  policy: ['linkedin', 'x', 'portfolio'],
  organize: ['facebook', 'instagram', 'tiktok', 'x'],
};

export const ALL_LINK_KEYS = Object.keys(LINK_PLATFORMS) as LinkKey[];

/**
 * Normalizes what someone typed into an https URL, or returns an error message.
 * Accepts "youtube.com/@me", a full URL, or "@handle" for handle-based platforms.
 */
export const normalizeLink = (key: LinkKey, raw: string): { url: string } | { error: string } => {
  const v = raw.trim();
  if (!v) return { url: '' };
  const p = LINK_PLATFORMS[key];
  let candidate = v;
  if (v.startsWith('@') && p.hosts?.length && ['tiktok', 'instagram', 'x', 'youtube'].includes(key)) {
    const handle = v.slice(1).replace(/[^\w.]/g, '');
    candidate = key === 'youtube' ? `https://youtube.com/@${handle}` : key === 'x' ? `https://x.com/${handle}` : `https://${p.hosts[0]}/${key === 'tiktok' ? '@' : ''}${handle}`;
  } else if (!/^https?:\/\//i.test(v)) {
    candidate = `https://${v}`;
  }
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return { error: 'That doesn’t look like a link.' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: 'Use a web link (https://…).' };
  u.protocol = 'https:';
  const host = u.hostname.replace(/^www\.|^m\./, '').toLowerCase();
  if (p.hosts && !p.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    return { error: `Use a ${p.label} link.` };
  }
  if (u.toString().length > 300) return { error: 'That link is too long.' };
  return { url: u.toString() };
};
