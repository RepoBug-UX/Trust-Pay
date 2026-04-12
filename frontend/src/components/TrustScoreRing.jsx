import { useEffect, useState } from 'react';
import { TIER_NAMES, TIER_COLORS } from '../utils/format';

export default function TrustScoreRing({ score = 0, tier = 0, size = 200, strokeWidth = 12 }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const maxScore = 400;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(animatedScore / maxScore, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const center = size / 2;
  const tierColor = TIER_COLORS[tier] || TIER_COLORS[0];

  useEffect(() => {
    let start = 0;
    const end = score;
    const duration = 1200;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedScore(Math.round(start + (end - start) * eased));
      if (t < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [score]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-navy-700"
        />
        {/* Progress ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={tierColor.ring}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.33, 1, 0.68, 1)' }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-heading font-bold text-white">{animatedScore}</span>
        <span className={`text-sm font-medium mt-1 ${tierColor.text}`}>
          {TIER_NAMES[tier]}
        </span>
      </div>
    </div>
  );
}
