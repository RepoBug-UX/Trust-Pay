import { useState, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { usePolling } from '../hooks/usePolling';
import {
  getLPPool,
  getBNPLContract,
  approveAndCall,
  getAddresses,
  getUSDTBalance
} from '../utils/contracts';
import { formatUSDT, parseUSDT } from '../utils/format';
import TxStepIndicator from '../components/TxStepIndicator';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/SkeletonLoader';

/* ── Utilization Ring ─────────────────────────────────────────────── */

function UtilizationRing({ percent = 0, size = 140, strokeWidth = 10 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(percent / 100, 1);
  const offset = circumference * (1 - filled);
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-navy-700"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#2dd4bf"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-heading font-bold text-white">{percent.toFixed(1)}%</span>
        <span className="text-xs text-gray-400">utilized</span>
      </div>
    </div>
  );
}

/* ── Stat Card ────────────────────────────────────────────────────── */

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-5">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-heading font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────── */

export default function LPDashboard() {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState('deposit');

  /* deposit state */
  const [depositAmount, setDepositAmount] = useState('');
  const [depositStep, setDepositStep] = useState(0);
  const [depositHash, setDepositHash] = useState(null);
  const [depositError, setDepositError] = useState(null);
  const [depositing, setDepositing] = useState(false);

  /* withdraw state */
  const [withdrawShares, setWithdrawShares] = useState('');
  const [withdrawStep, setWithdrawStep] = useState(0);
  const [withdrawHash, setWithdrawHash] = useState(null);
  const [withdrawError, setWithdrawError] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);

  /* ── data fetcher ───────────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    if (!address) return null;

    const pool = await getLPPool();
    const bnpl = await getBNPLContract();

    const [
      totalValue,
      available,
      totalLent,
      utilRate,
      totalShares,
      myShares,
      myValue,
      usdtBal,
      totalBorrowed,
      totalRepaid,
      totalDefaulted,
      planCount
    ] = await Promise.all([
      pool.getTotalValue().call(),
      pool.availableLiquidity().call(),
      pool.totalLent().call(),
      pool.utilizationRate().call(),
      pool.totalShares().call(),
      pool.shares(address).call(),
      pool.getPositionValue(address).call(),
      getUSDTBalance(address),
      bnpl.totalBorrowed().call(),
      bnpl.totalRepaid().call(),
      bnpl.totalDefaulted().call(),
      bnpl.getPlanCount().call()
    ]);

    return {
      totalValue: totalValue.toString(),
      available: available.toString(),
      totalLent: totalLent.toString(),
      utilRate: Number(utilRate.toString()),
      totalShares: totalShares.toString(),
      myShares: myShares.toString(),
      myValue: myValue.toString(),
      usdtBalance: usdtBal,
      totalBorrowed: totalBorrowed.toString(),
      totalRepaid: totalRepaid.toString(),
      totalDefaulted: totalDefaulted.toString(),
      planCount: Number(planCount.toString())
    };
  }, [address]);

  const { data, loading, refresh } = usePolling(fetchData, 15000);

  /* ── deposit handler ────────────────────────────────────────────── */

  const handleDeposit = async () => {
    if (!depositAmount || Number(depositAmount) <= 0) return;
    setDepositing(true);
    setDepositError(null);
    setDepositStep(0);
    setDepositHash(null);

    try {
      const addresses = getAddresses();
      const raw = parseUSDT(depositAmount);

      const onStep = (step, msg, hash) => {
        setDepositStep(step);
        if (hash) setDepositHash(hash);
      };

      await approveAndCall(
        addresses.lPPool,
        raw,
        async () => {
          const pool = await getLPPool();
          return await pool.deposit(raw).send({ feeLimit: 100_000_000 });
        },
        onStep
      );

      setDepositAmount('');
      refresh();
    } catch (err) {
      setDepositError(err.message || 'Deposit failed');
    } finally {
      setDepositing(false);
    }
  };

  /* ── withdraw handler ───────────────────────────────────────────── */

  const handleWithdraw = async () => {
    if (!withdrawShares || Number(withdrawShares) <= 0) return;
    setWithdrawing(true);
    setWithdrawError(null);
    setWithdrawStep(0);
    setWithdrawHash(null);

    try {
      setWithdrawStep(1);
      const pool = await getLPPool();

      setWithdrawStep(2);
      setWithdrawStep(3);
      const tx = await pool.withdraw(withdrawShares).send({ feeLimit: 100_000_000 });

      setWithdrawHash(tx);
      setWithdrawStep(4);
      setWithdrawShares('');
      refresh();
    } catch (err) {
      setWithdrawError(err.message || 'Withdraw failed');
    } finally {
      setWithdrawing(false);
    }
  };

  /* ── estimated receive ──────────────────────────────────────────── */

  const estimatedReceive = (() => {
    if (!data || !withdrawShares || Number(data.totalShares) === 0) return null;
    const ratio = Number(withdrawShares) / Number(data.totalShares);
    const est = ratio * Number(data.totalValue);
    return formatUSDT(Math.round(est).toString());
  })();

  /* ── pool share percentage ──────────────────────────────────────── */

  const poolSharePct = (() => {
    if (!data || Number(data.totalShares) === 0) return '0.00';
    return ((Number(data.myShares) / Number(data.totalShares)) * 100).toFixed(2);
  })();

  /* ── utilization percentage ─────────────────────────────────────── */

  const utilPct = data ? data.utilRate / 100 : 0;

  /* ── not connected ──────────────────────────────────────────────── */

  if (!connected) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20">
        <EmptyState
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
            </svg>
          }
          title="Connect your wallet"
          description="Connect TronLink to view the liquidity pool dashboard and manage your position."
          action={connect}
          actionLabel="Connect Wallet"
        />
      </div>
    );
  }

  /* ── loading skeleton ───────────────────────────────────────────── */

  if (loading && !data) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="h-8 bg-navy-700 rounded w-48 mb-2 animate-pulse" />
          <div className="h-4 bg-navy-700 rounded w-72 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const hasPosition = data && Number(data.myShares) > 0;

  /* ── render ─────────────────────────────────────────────────────── */

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-heading font-bold text-white mb-1">Liquidity Pool</h1>
        <p className="text-gray-400 text-sm">
          Provide USDT liquidity to the BNPL pool and earn yield from installment repayments.
        </p>
      </div>

      {/* ── Pool Overview ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Pool Value" value={`$${formatUSDT(data?.totalValue)}`} />
        <StatCard label="Available Liquidity" value={`$${formatUSDT(data?.available)}`} />
        <StatCard label="Total Lent" value={`$${formatUSDT(data?.totalLent)}`} />
        <StatCard label="Utilization Rate" value={`${utilPct.toFixed(1)}%`} />
      </div>

      {/* Utilization ring + Your Position — side by side */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Utilization visual */}
        <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-6 flex flex-col items-center justify-center">
          <UtilizationRing percent={utilPct} />
          <p className="text-xs text-gray-500 mt-4">
            {formatUSDT(data?.totalLent)} USDT lent of {formatUSDT(data?.totalValue)} USDT total
          </p>
        </div>

        {/* ── Your Position ─────────────────────────────────────── */}
        {hasPosition ? (
          <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-6">
            <h2 className="text-sm font-semibold text-gray-400 mb-4">Your Position</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Your Shares</span>
                <span className="text-sm font-medium text-white">{Number(data.myShares).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Position Value</span>
                <span className="text-sm font-medium text-white">${formatUSDT(data.myValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Pool Share</span>
                <span className="text-sm font-medium text-teal-400">{poolSharePct}%</span>
              </div>
              <div className="border-t border-navy-700 pt-4 flex justify-between">
                <span className="text-sm text-gray-400">Your USDT Balance</span>
                <span className="text-sm font-medium text-white">${formatUSDT(data.usdtBalance)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-6 flex flex-col items-center justify-center text-center">
            <h2 className="text-sm font-semibold text-gray-400 mb-2">Your Position</h2>
            <p className="text-xs text-gray-500 mb-3">You have no shares in this pool yet.</p>
            <div className="flex justify-between w-full max-w-xs">
              <span className="text-sm text-gray-400">USDT Balance</span>
              <span className="text-sm font-medium text-white">${formatUSDT(data?.usdtBalance)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Deposit / Withdraw Tabs ───────────────────────────────── */}
      <div className="rounded-xl border border-navy-700 bg-navy-800/50 mb-8">
        {/* Tab bar */}
        <div className="flex border-b border-navy-700">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
              activeTab === 'deposit' ? 'text-teal-400' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Deposit
            {activeTab === 'deposit' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
              activeTab === 'withdraw' ? 'text-teal-400' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Withdraw
            {activeTab === 'withdraw' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />
            )}
          </button>
        </div>

        <div className="p-6">
          {/* ── Deposit ──────────────────────────────────────────── */}
          {activeTab === 'deposit' && (
            <div className="space-y-4">
              <label className="block text-sm text-gray-400 mb-1">Amount (USDT)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="flex-1 rounded-lg bg-navy-900 border border-navy-600 px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal-500 transition-colors"
                />
                <button
                  onClick={() => data?.usdtBalance && setDepositAmount(formatUSDT(data.usdtBalance).replace(/,/g, ''))}
                  className="px-3 py-2.5 rounded-lg bg-navy-700 hover:bg-navy-600 text-teal-400 text-xs font-medium transition-colors"
                >
                  Max
                </button>
              </div>

              <button
                onClick={handleDeposit}
                disabled={depositing || !depositAmount || Number(depositAmount) <= 0}
                className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
              >
                {depositing ? 'Depositing...' : 'Deposit'}
              </button>

              <TxStepIndicator step={depositStep} txHash={depositHash} error={depositError} />
            </div>
          )}

          {/* ── Withdraw ─────────────────────────────────────────── */}
          {activeTab === 'withdraw' && (
            <div className="space-y-4">
              <label className="block text-sm text-gray-400 mb-1">Shares to withdraw</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={withdrawShares}
                  onChange={(e) => setWithdrawShares(e.target.value)}
                  className="flex-1 rounded-lg bg-navy-900 border border-navy-600 px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal-500 transition-colors"
                />
                <button
                  onClick={() => data?.myShares && setWithdrawShares(data.myShares)}
                  className="px-3 py-2.5 rounded-lg bg-navy-700 hover:bg-navy-600 text-teal-400 text-xs font-medium transition-colors"
                >
                  Max
                </button>
              </div>

              {estimatedReceive && (
                <div className="flex items-center justify-between rounded-lg bg-navy-900/50 border border-navy-700 px-4 py-3">
                  <span className="text-xs text-gray-400">Estimated to receive</span>
                  <span className="text-sm font-medium text-white">${estimatedReceive} USDT</span>
                </div>
              )}

              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawShares || Number(withdrawShares) <= 0}
                className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
              >
                {withdrawing ? 'Withdrawing...' : 'Withdraw'}
              </button>

              <TxStepIndicator step={withdrawStep} txHash={withdrawHash} error={withdrawError} />
            </div>
          )}
        </div>
      </div>

      {/* ── Pool Activity ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-4">Pool Activity</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Borrowed</p>
            <p className="text-lg font-heading font-bold text-white">${formatUSDT(data?.totalBorrowed)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Repaid</p>
            <p className="text-lg font-heading font-bold text-teal-400">${formatUSDT(data?.totalRepaid)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Defaulted</p>
            <p className="text-lg font-heading font-bold text-red-400">${formatUSDT(data?.totalDefaulted)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Active Plans</p>
            <p className="text-lg font-heading font-bold text-white">{data?.planCount ?? 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
