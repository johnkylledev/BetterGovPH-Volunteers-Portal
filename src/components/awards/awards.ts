import type { LucideIcon } from 'lucide-react';
import { BadgeCheck, Rocket, HandHeart, UsersRound, Layers, CalendarHeart, Link2, Award as AwardIcon } from 'lucide-react';

export type Tier = 'bronze' | 'silver' | 'gold';

/** Everything an award can be earned from — all derived from data the dashboard already loads. */
export interface AwardStats {
  verified: boolean;
  discordLinked: boolean;
  recognized: boolean; // community role Fellow or Contributor
  projectsShipped: number; // approved project submissions
  callsPosted: number; // volunteer calls this member opened
  callsFilled: number; // their calls marked closed (team found)
  skills: number;
  days: number; // days since joining
}

type NumericStat = 'projectsShipped' | 'callsPosted' | 'callsFilled' | 'skills' | 'days';

interface TieredDef {
  kind: 'tiered';
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  stat: NumericStat;
  unit: [string, string]; // singular, plural
  thresholds: [number, number, number]; // bronze, silver, gold
}

interface SingleDef {
  kind: 'single';
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  earned: (s: AwardStats) => boolean;
  how: string; // what to do to earn it
}

export type AwardDef = TieredDef | SingleDef;

export interface AwardState {
  def: AwardDef;
  earned: boolean;
  tier: Tier | null;
  value?: number;
  next?: { tier: Tier; target: number; remaining: number; label: string };
  progress: number; // 0–1 toward the next tier (1 when maxed or earned)
}

export const AWARDS: AwardDef[] = [
  {
    kind: 'single',
    id: 'verified',
    name: 'Verified Volunteer',
    description: 'Approved into the BetterGovPH community.',
    icon: BadgeCheck,
    earned: (s) => s.verified,
    how: 'Granted when an admin approves your application.',
  },
  {
    kind: 'tiered',
    id: 'builder',
    name: 'Builder',
    description: 'Shipped projects the admins approved for the public list.',
    icon: Rocket,
    stat: 'projectsShipped',
    unit: ['project', 'projects'],
    thresholds: [1, 3, 10],
  },
  {
    kind: 'tiered',
    id: 'bayanihan',
    name: 'Bayanihan',
    description: 'Opened volunteer calls so others could pitch in.',
    icon: HandHeart,
    stat: 'callsPosted',
    unit: ['call', 'calls'],
    thresholds: [1, 3, 10],
  },
  {
    kind: 'tiered',
    id: 'team-assembled',
    name: 'Team Assembled',
    description: 'Volunteer calls you closed after finding your people.',
    icon: UsersRound,
    stat: 'callsFilled',
    unit: ['call filled', 'calls filled'],
    thresholds: [1, 3, 5],
  },
  {
    kind: 'tiered',
    id: 'toolkit',
    name: 'Toolkit',
    description: 'Skills listed on your profile.',
    icon: Layers,
    stat: 'skills',
    unit: ['skill', 'skills'],
    thresholds: [4, 8, 15],
  },
  {
    kind: 'tiered',
    id: 'tenure',
    name: 'Tenure',
    description: 'Time spent as part of the community.',
    icon: CalendarHeart,
    stat: 'days',
    unit: ['day', 'days'],
    thresholds: [30, 180, 365],
  },
  {
    kind: 'single',
    id: 'connected',
    name: 'Connected',
    description: 'Linked Discord so the team can reach you.',
    icon: Link2,
    earned: (s) => s.discordLinked,
    how: 'Link Discord from your profile.',
  },
  {
    kind: 'single',
    id: 'recognized',
    name: 'Recognized',
    description: 'Named a Fellow or Contributor by the community.',
    icon: AwardIcon,
    earned: (s) => s.recognized,
    how: 'Awarded by admins for sustained contribution.',
  },
];

const TIERS: Tier[] = ['bronze', 'silver', 'gold'];
export const TIER_LABEL: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

export const evaluateAward = (def: AwardDef, s: AwardStats): AwardState => {
  if (def.kind === 'single') {
    const earned = def.earned(s);
    return { def, earned, tier: earned ? 'gold' : null, progress: earned ? 1 : 0 };
  }
  const value = s[def.stat];
  let tierIndex = -1;
  def.thresholds.forEach((t, i) => {
    if (value >= t) tierIndex = i;
  });
  const tier = tierIndex >= 0 ? TIERS[tierIndex] : null;
  if (tierIndex === 2) return { def, earned: true, tier, value, progress: 1 };

  const nextIndex = tierIndex + 1;
  const target = def.thresholds[nextIndex];
  const remaining = Math.max(0, target - value);
  const unit = remaining === 1 ? def.unit[0] : def.unit[1];
  return {
    def,
    earned: tier !== null,
    tier,
    value,
    next: {
      tier: TIERS[nextIndex],
      target,
      remaining,
      label: `${remaining} more ${unit} for ${TIER_LABEL[TIERS[nextIndex]]}`,
    },
    progress: Math.min(1, Math.max(0, value / target)),
  };
};

export const evaluateAwards = (s: AwardStats) => AWARDS.map((d) => evaluateAward(d, s));
