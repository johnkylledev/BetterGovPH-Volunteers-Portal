import React, { useEffect, useState } from 'react';
import { skillIconUrl, getSkillFallbackIcon } from '../utils/skillUtils';

interface SkillIconProps {
  skillName: string;
  size?: number;
  invert?: boolean;
  className?: string;
  forceFallback?: boolean;
}

/** A skill's original logo (served locally), or a fitting icon when it has none or the image fails. */
export const SkillIcon: React.FC<SkillIconProps> = ({
  skillName,
  size = 14,
  invert = false,
  className = '',
  forceFallback = false,
}) => {
  const src = skillIconUrl(skillName);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const box: React.CSSProperties = { width: size, height: size, minWidth: size, minHeight: size };

  if (!src || failed || forceFallback) {
    return (
      <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} style={box} title={skillName}>
        {React.cloneElement(getSkillFallbackIcon(skillName, size), {
          style: { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' },
        })}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      title={skillName}
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={`inline-block shrink-0 object-contain ${invert ? 'brightness-0 invert' : ''} ${className}`}
      style={box}
    />
  );
};
