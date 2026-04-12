import { TIER_NAMES, TIER_COLORS } from '../utils/format';

export default function TrustScoreBadge({ score = 0, tier = 0, className = '' }) {
  const tierColor = TIER_COLORS[tier] || TIER_COLORS[0];

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-navy-800/50 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${tierColor.bg}`} />
      <span className="text-xs font-medium text-gray-300">{score}</span>
      <span className={`text-xs font-medium ${tierColor.text}`}>{TIER_NAMES[tier]}</span>
    </div>
  );
}
