import React, { useEffect, useState } from 'react';
import { skillToSlug, getSkillFallbackIcon } from '../utils/skillUtils';

interface SkillIconProps {
  skillName: string;
  size?: number;
  invert?: boolean;
  className?: string;
  forceFallback?: boolean;
}

export const SkillIcon: React.FC<SkillIconProps> = ({
  skillName,
  size = 14,
  invert = false,
  className = '',
  forceFallback = false,
}) => {
  const slug = skillToSlug(skillName);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgLoaded(false);
    setImgFailed(false);
  }, [slug, skillName]);

  const showFallback = !slug || imgFailed || forceFallback;
  const cdnUrl = slug ? `https://cdn.simpleicons.org/${slug}` : undefined;

  const fallbackEl = React.cloneElement(getSkillFallbackIcon(skillName, size), {
    style: { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' },
  });

  const dimensionStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    maxWidth: `${size}px`,
    maxHeight: `${size}px`,
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={dimensionStyle}
      title={skillName}
    >
      {showFallback ? (
        fallbackEl
      ) : (
        <>
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-out ${
              imgLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            aria-hidden="true"
          >
            {fallbackEl}
          </div>
          {cdnUrl && (
            <img
              key={cdnUrl}
              src={cdnUrl}
              alt={skillName}
              loading="eager"
              decoding="async"
              fetchPriority="auto"
              className={`w-full h-full object-contain transition-opacity duration-200 ease-out ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              } ${invert ? 'brightness-0 invert' : ''}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
            />
          )}
        </>
      )}
    </div>
  );
};


