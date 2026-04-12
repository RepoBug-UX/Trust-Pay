import { useState, useEffect, useCallback } from 'react';
import { getTrustScore } from '../utils/contracts';
import { TIER_NAMES } from '../utils/format';

export function useTrustScore(address) {
  const [score, setScore] = useState(0);
  const [tier, setTier] = useState(0);
  const [tierName, setTierName] = useState('New');
  const [trustData, setTrustData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!address || !window.tronWeb?.ready) {
      setLoading(false);
      return;
    }
    try {
      const contract = await getTrustScore();
      const [scoreResult, tierResult, dataResult] = await Promise.all([
        contract.getScore(address).call(),
        contract.getTier(address).call(),
        contract.getTrustData(address).call()
      ]);
      setScore(Number(scoreResult));
      setTier(Number(tierResult));
      setTierName(TIER_NAMES[Number(tierResult)] || 'New');
      setTrustData({
        totalPayments: Number(dataResult.totalPayments),
        totalVolume: dataResult.totalVolume.toString(),
        firstPurchase: Number(dataResult.firstPurchase),
        defaults: Number(dataResult.defaults)
      });
    } catch (err) {
      console.error('Trust score fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { score, tier, tierName, trustData, loading, refresh };
}
