/**
 * The portal's icon rule, in one place:
 *
 * - Actions, navigation, inputs: outline (lucide-react, imported where used).
 * - Status and state, the small icons that carry meaning: filled (Phosphor `fill` weight, from here).
 *   Verified badges, approved/pending/declined, saved, connected, featured stars, unread counts.
 * - Selected state: the same icon goes from outline to filled (`TabIcon`).
 *
 * Change a status icon's look here and it changes everywhere.
 */
import React from 'react';
import {
  Bell as PhBell,
  Briefcase as PhBriefcase,
  CheckCircle as PhCheckCircle,
  Clock as PhClock,
  LinkSimple as PhLink,
  SealCheck as PhSealCheck,
  ShieldCheck as PhShieldCheck,
  ShieldWarning as PhShieldWarning,
  Star as PhStar,
  User as PhUser,
  Wrench as PhWrench,
  type Icon as PhIcon,
  type IconProps as PhIconProps,
} from '@phosphor-icons/react';

type StatusIconProps = Omit<PhIconProps, 'weight'> & { 'aria-label'?: string; 'aria-hidden'?: boolean | 'true' | 'false' };

/** A filled status glyph. Decorative unless an aria-label is given. */
const filled = (Glyph: PhIcon, name: string) => {
  const C: React.FC<StatusIconProps> = ({ size = 16, ...rest }) => (
    <Glyph size={size} weight="fill" aria-hidden={rest['aria-label'] ? undefined : true} {...rest} />
  );
  C.displayName = name;
  return C;
};

/** Verified member: the seal next to names and on the Volunteer Card. */
export const VerifiedIcon = filled(PhSealCheck, 'VerifiedIcon');
/** Approved, done, connected, saved. */
export const DoneIcon = filled(PhCheckCircle, 'DoneIcon');
/** Waiting for a decision. */
export const PendingIcon = filled(PhClock, 'PendingIcon');
/** Declined or blocked. */
export const DeclinedIcon = filled(PhShieldWarning, 'DeclinedIcon');
/** Privacy protected. */
export const PrivacyIcon = filled(PhShieldCheck, 'PrivacyIcon');
/** Featured / starred. */
export const FeaturedIcon = filled(PhStar, 'FeaturedIcon');

/** Notification bell: outline when everything is read, filled while something is unread. */
export const BellIcon: React.FC<StatusIconProps & { unread?: boolean }> = ({ unread, size = 18, ...rest }) => (
  <PhBell size={size} weight={unread ? 'fill' : 'regular'} aria-hidden {...rest} />
);

/** Tab icons go from outline to filled when the tab is selected. */
export const TAB_GLYPHS = {
  user: PhUser,
  briefcase: PhBriefcase,
  wrench: PhWrench,
  link: PhLink,
  shield: PhShieldCheck,
} as const satisfies Record<string, PhIcon>;

export const TabIcon: React.FC<{ glyph: keyof typeof TAB_GLYPHS; active: boolean; size?: number; className?: string }> = ({
  glyph, active, size = 16, className,
}) => {
  const Glyph = TAB_GLYPHS[glyph];
  return <Glyph size={size} weight={active ? 'fill' : 'regular'} className={className} aria-hidden />;
};
