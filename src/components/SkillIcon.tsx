import React, { useEffect, useState } from 'react';
import { skillToSlug, getSkillFallbackIcon } from '../utils/skillUtils';

interface SkillIconProps {
  skillName: string;
  size?: number;
  invert?: boolean;
  className?: string;
}

export const SkillIcon: React.FC<SkillIconProps> = ({
  skillName,
  size = 14,
  invert = false,
  className = '',
}) => {
  const slug = skillToSlug(skillName);
  const [showFallback, setShowFallback] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setShowFallback(true);
    setTimedOut(false);
    const timer = setTimeout(() => setTimedOut(true), 1200);
    return () => clearTimeout(timer);
  }, [slug, skillName]);

  if (!slug || timedOut) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        {getSkillFallbackIcon(skillName, size)}
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className}`}>
      {showFallback && (
        <div className="absolute inset-0 flex items-center justify-center opacity-100">
          {getSkillFallbackIcon(skillName, size)}
        </div>
      )}
      <img
        src={`https://cdn.simpleicons.org/${slug}`}
        alt=""
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        className={`w-full h-full object-contain transition-opacity duration-200 ${
          showFallback ? 'opacity-0' : 'opacity-100'
        } ${invert ? 'brightness-0 invert' : ''}`}
        onLoad={(e) => {
          (e.target as HTMLImageElement).style.opacity = '1';
          setShowFallback(false);
        }}
        onError={() => setTimedOut(true)}
      />
    </div>
  );
};
