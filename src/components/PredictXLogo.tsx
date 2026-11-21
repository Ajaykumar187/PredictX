import React, { useId } from 'react';

interface PredictXLogoProps {
  size?: number;
  className?: string;
}

export const PredictXLogo: React.FC<PredictXLogoProps> = ({ size = 32, className = '' }) => {
  const uid = useId().replace(/:/g, '');
  const bgId = `px-bg-${uid}`;
  const riseId = `px-rise-${uid}`;
  const accentId = `px-accent-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bgId} x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="55%" stopColor="#132347" />
          <stop offset="100%" stopColor="#0B1220" />
        </linearGradient>
        <linearGradient id={riseId} x1="9" y1="30" x2="31" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="55%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id={accentId} x1="10" y1="10" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>

      <rect x="1" y="1" width="38" height="38" rx="10" fill={`url(#${bgId})`} />
      <rect x="1.5" y="1.5" width="37" height="37" rx="9.5" stroke="#334155" strokeOpacity="0.65" />

      <path d="M9 29H31" stroke="#334155" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />

      <path
        d="M11 11.5L28.5 29"
        stroke={`url(#${accentId})`}
        strokeWidth="3.2"
        strokeLinecap="round"
      />

      <path
        d="M10.5 29L18.5 20.5L22.5 23.5L30 11.5"
        stroke={`url(#${riseId})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M24.5 11.5H30V17"
        stroke="#10B981"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default PredictXLogo;
