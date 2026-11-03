export const DISCORD_INVITE = 'https://discord.com/invite/mHtThpN8bT';
export const GITHUB_ORG = 'https://github.com/BetterGovPH';
/** The repository for this portal; contributors are loaded from it. */
export const GITHUB_REPO = 'johnkylledev/BetterGovPH-Volunteers-Portal';
export const MAIN_WEBSITE = 'https://bettergov.ph/';
export const ABOUT_WEBSITE = 'https://about.bettergov.ph/';

export interface Role {
  title: string;
  description: string;
  skills: string[];
  commitment: string;
  href: string;
}

export const ROLES: Role[] = [
  {
    title: 'Frontend developer',
    description: 'Build fast, accessible interfaces that put public data in front of people who need it.',
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'Accessibility'],
    commitment: '5–10 hrs/week',
    href: `${GITHUB_ORG}/issues?q=label%3Afrontend`,
  },
  {
    title: 'Backend developer',
    description: 'Design APIs and the infrastructure behind them. Keep the data honest and the services up.',
    skills: ['Node.js or Python', 'PostgreSQL', 'API design'],
    commitment: '5–10 hrs/week',
    href: `${GITHUB_ORG}/issues?q=label%3Abackend`,
  },
  {
    title: 'Data engineer',
    description: 'Turn PDFs and spreadsheets from government sites into clean, usable datasets.',
    skills: ['Python', 'Pipelines', 'Scraping', 'SQL'],
    commitment: '5–10 hrs/week',
    href: `${GITHUB_ORG}/issues?q=label%3Adata`,
  },
  {
    title: 'Researcher',
    description: 'Read budgets, track procurement, check sources. Find what the numbers actually say.',
    skills: ['Budget analysis', 'Verification', 'Writing'],
    commitment: '3–5 hrs/week',
    href: `${GITHUB_ORG}/issues?q=label%3Aresearch`,
  },
  {
    title: 'Designer',
    description: 'Make complex public information readable on a cheap phone over a slow connection.',
    skills: ['UI/UX', 'Information design', 'Figma'],
    commitment: '3–5 hrs/week',
    href: `${GITHUB_ORG}/issues?q=label%3Adesign`,
  },
  {
    title: 'Community advocate',
    description: 'Write about the work, share it, and bring more people in. Transparency needs an audience.',
    skills: ['Writing', 'Social media', 'Organizing'],
    commitment: '2–3 hrs/week',
    href: DISCORD_INVITE,
  },
];
