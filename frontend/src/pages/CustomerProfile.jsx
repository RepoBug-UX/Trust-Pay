import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useTrustScore } from '../hooks/useTrustScore';
import { usePolling } from '../hooks/usePolling';
import {
  getMerchantRegistry,
  getBNPLContract,
  getUSDT,
  getAddresses,
  getUSDTBalance,
  approveAndCall
} from '../utils/contracts';
import {
  formatUSDT,
  shortenAddress,
  tronscanAddressLink,
  formatDate,
  formatRelativeTime,
  TIER_COLORS
} from '../utils/format';
import { toBase58 } from '../utils/tronlink';
import TrustScoreRing from '../components/TrustScoreRing';
import TxStepIndicator from '../components/TxStepIndicator';
import EmptyState from '../components/EmptyState';
import { SkeletonCard, SkeletonRow, SkeletonRing } from '../components/SkeletonLoader';

/* ── Tier thresholds for progress bar ── */
const TIER_THRESHOLDS = [
  { from: 'New', to: 'Building', points: 50 },
  { from: 'Building', to: 'Trusted', points: 150 },
  { from: 'Trusted', to: 'Established', points: 300 }
];

function getNextTierInfo(score, tier) {
  if (tier >= 3) return null;
  const threshold = TIER_THRESHOLDS[tier];
  const remaining = Math.max(0, threshold.points - score);
  const progress = Math.min(score / threshold.points, 1);
  return { nextTier: threshold.to, remaining, progress };
}

function daysFromTimestamp(ts) {
  if (!ts || ts === 0) return 0;
  return Math.floor((Date.now() / 1000 - ts) / 86400);
}

/* ── Section header with horizontal rule ── */
function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <h2 className="text-xl font-heading font-bold text-white whitespace-nowrap">
        {title}
      </h2>
      <div className="h-px flex-1 bg-navy-700" />
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-heading font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function CustomerProfile() {
  const { address, connected, connect } = useWallet();
  const {
    score, tier, tierName, trustData,
    loading: scoreLoading, refresh: refreshScore
  } = useTrustScore(address);

  /* ── USDT balance ── */
  const [balance, setBalance] = useState(null);

  const refreshBalance = useCallback(async () => {
    if (!address || !window.tronWeb?.ready) return;
    try {
      const b = await getUSDTBalance(address);
      setBalance(b);
    } catch (err) {
      console.error('Balance fetch error:', err);
    }
  }, [address]);

  useEffect(() => {
    refreshBalance();
    const iv = setInterval(refreshBalance, 10000);
    return () => clearInterval(iv);
  }, [refreshBalance]);

  /* ── Mint test USDT ── */
  const [mintStep, setMintStep] = useState(0);
  const [mintMsg, setMintMsg] = useState('');
  const [mintTx, setMintTx] = useState(null);
  const [mintError, setMintError] = useState(null);
  const [minting, setMinting] = useState(false);

  const handleMint = async () => {
    setMinting(true);
    setMintStep(1);
    setMintMsg('Confirm mint in TronLink...');
    setMintError(null);
    setMintTx(null);
    try {
      const usdt = await getUSDT();
      setMintStep(2);
      setMintMsg('Waiting for confirmation...');
      const tx = await usdt
        .mint(address, 10000000000)
        .send({ feeLimit: 100_000_000 });
      setMintStep(4);
      setMintMsg('Minted 10,000 USDT!');
      setMintTx(tx);
      await refreshBalance();
      refreshScore();
    } catch (err) {
      setMintError(err.message || 'Mint failed');
      setMintStep(0);
    } finally {
      setMinting(false);
    }
  };

  /* ── Payment history ── */
  const fetchPayments = useCallback(async () => {
    if (!address || !window.tronWeb?.ready) return [];
    const registry = await getMerchantRegistry();
    const indices = await registry.getCustomerPayments(address).call();
    const payments = await Promise.all(
      indices.map(async (idx) => {
        const p = await registry.getPayment(Number(idx)).call();
        return {
          customer: toBase58(p.customer),
          merchant: toBase58(p.merchant),
          amount: p.amount.toString(),
          timestamp: Number(p.timestamp),
          productId: p.productId
        };
      })
    );
    return payments.sort((a, b) => b.timestamp - a.timestamp);
  }, [address]);

  const { data: payments, loading: paymentsLoading } = usePolling(
    fetchPayments,
    15000
  );

  /* ── BNPL installment plans ── */
  const fetchPlans = useCallback(async () => {
    if (!address || !window.tronWeb?.ready) return [];
    const bnpl = await getBNPLContract();
    const planIndices = await bnpl.getCustomerPlans(address).call();
    const plans = await Promise.all(
      planIndices.map(async (idx) => {
        const p = await bnpl.getPlan(Number(idx)).call();
        return {
          id: Number(idx),
          customer: toBase58(p.customer),
          merchant: toBase58(p.merchant),
          totalAmount: p.totalAmount.toString(),
          downPayment: p.downPayment.toString(),
          installmentAmount: p.installmentAmount.toString(),
          numInstallments: Number(p.numInstallments),
          installmentsPaid: Number(p.installmentsPaid),
          nextDueDate: Number(p.nextDueDate),
          isActive: p.isActive,
          isDefaulted: p.isDefaulted
        };
      })
    );
    return plans;
  }, [address]);

  const {
    data: plans,
    loading: plansLoading,
    refresh: refreshPlans
  } = usePolling(fetchPlans, 15000);

  /* ── Per-plan transaction state ── */
  const [planTxState, setPlanTxState] = useState({});

  const handleInstallmentPay = async (planId, installmentAmount, isEarly) => {
    const addresses = getAddresses();
    setPlanTxState((prev) => ({
      ...prev,
      [planId]: { step: 0, msg: '', tx: null, error: null, busy: true }
    }));

    const onStep = (step, msg, tx) => {
      setPlanTxState((prev) => ({
        ...prev,
        [planId]: {
          ...prev[planId],
          step,
          msg,
          tx: tx || prev[planId]?.tx,
          error: null
        }
      }));
    };

    try {
      await approveAndCall(
        addresses.bNPLContract,
        installmentAmount,
        async () => {
          const bnpl = await getBNPLContract();
          if (isEarly) {
            return await bnpl.payEarly(planId).send({ feeLimit: 100_000_000 });
          }
          return await bnpl
            .collectInstallment(planId)
            .send({ feeLimit: 100_000_000 });
        },
        onStep
      );
      await refreshBalance();
      refreshScore();
      refreshPlans();
    } catch (err) {
      setPlanTxState((prev) => ({
        ...prev,
        [planId]: {
          step: 0,
          msg: '',
          tx: null,
          error: err.message || 'Payment failed',
          busy: false
        }
      }));
    } finally {
      setPlanTxState((prev) => ({
        ...prev,
        [planId]: { ...prev[planId], busy: false }
      }));
    }
  };

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */

  /* Not connected */
  if (!connected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6">
        <EmptyState
          icon={
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
              />
            </svg>
          }
          title="Connect Your Wallet"
          description="Connect your wallet to view your trust score and payment history"
          action={connect}
          actionLabel="Connect Wallet"
        />
      </div>
    );
  }

  const nextTier = getNextTierInfo(score, tier);
  const tierColor = TIER_COLORS[tier] || TIER_COLORS[0];
  const accountAgeDays = trustData ? daysFromTimestamp(trustData.firstPurchase) : 0;

  const activePlans = (plans || []).filter((p) => p.isActive && !p.isDefaulted);
  const completedPlans = (plans || []).filter(
    (p) => !p.isActive && !p.isDefaulted
  );
  const defaultedPlans = (plans || []).filter((p) => p.isDefaulted);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* ── Trust Score Hero ── */}
      <section className="text-center mb-16">
        {scoreLoading ? (
          <SkeletonRing />
        ) : (
          <TrustScoreRing score={score} tier={tier} size={220} strokeWidth={14} />
        )}

        {!scoreLoading && (
          <div className="mt-6">
            <p className={`text-lg font-heading font-semibold ${tierColor.text}`}>
              {tierName}
            </p>

            {nextTier ? (
              <div className="mt-4 max-w-xs mx-auto">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                  <span>{score} pts</span>
                  <span>
                    {nextTier.remaining} pts to {nextTier.nextTier}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-navy-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${nextTier.progress * 100}%`,
                      backgroundColor: tierColor.ring
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-2">Maximum tier reached</p>
            )}
          </div>
        )}
      </section>

      {/* ── Score Breakdown ── */}
      <section className="mb-12">
        <SectionHeader title="Score Breakdown" />
        {scoreLoading || !trustData ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Payments Made"
              value={trustData.totalPayments}
              sub="On-chain transactions"
            />
            <StatCard
              label="Total Volume"
              value={`$${formatUSDT(trustData.totalVolume)}`}
              sub="USDT spent"
            />
            <StatCard
              label="Account Age"
              value={
                trustData.firstPurchase === 0 ? '--' : `${accountAgeDays}d`
              }
              sub={
                trustData.firstPurchase === 0
                  ? 'No purchases yet'
                  : `Since ${formatDate(trustData.firstPurchase).split(',')[0]}`
              }
            />
            <StatCard
              label="Defaults"
              value={trustData.defaults}
              sub={
                trustData.defaults === 0 ? 'Clean record' : 'Missed payments'
              }
            />
          </div>
        )}
      </section>

      {/* ── Mint Test USDT ── */}
      <section className="mb-12">
        <SectionHeader title="Test USDT Faucet" />
        <div className="rounded-2xl border border-navy-700 bg-gradient-to-br from-teal-500/5 to-navy-800/50 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-white font-heading font-semibold mb-1">
                Get Test USDT
              </p>
              <p className="text-sm text-gray-400">
                Mint 10,000 USDT to your wallet for testing on Nile testnet.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">Current Balance</p>
              <p className="text-xl font-heading font-bold text-white">
                {balance !== null ? `$${formatUSDT(balance)}` : '--'}
              </p>
            </div>
          </div>

          <button
            onClick={handleMint}
            disabled={minting}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-all hover:shadow-lg hover:shadow-teal-500/25"
          >
            {minting ? 'Minting...' : 'Mint 10,000 USDT'}
          </button>

          {(mintStep > 0 || mintError) && (
            <div className="mt-4">
              <TxStepIndicator
                step={mintStep}
                txHash={mintTx}
                error={mintError}
                message={mintMsg}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Payment History ── */}
      <section className="mb-12">
        <SectionHeader title="Payment History" />
        {paymentsLoading ? (
          <div className="rounded-xl border border-navy-700 bg-navy-800/30 divide-y divide-navy-700">
            {[...Array(4)].map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : !payments || payments.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            title="No Payments Yet"
            description="Your payment history will appear here after your first purchase from a TrustPay merchant."
          />
        ) : (
          <div className="rounded-xl border border-navy-700 bg-navy-800/30 divide-y divide-navy-700 overflow-hidden">
            {payments.map((payment, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-4 hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 sm:w-44">
                  <div className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                  <span className="text-sm text-gray-300">
                    {formatDate(payment.timestamp)}
                  </span>
                </div>
                <div className="sm:flex-1">
                  <a
                    href={tronscanAddressLink(payment.merchant)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    {shortenAddress(payment.merchant)}
                  </a>
                </div>
                {payment.productId && (
                  <span className="text-xs text-gray-500 sm:w-32 truncate">
                    {payment.productId}
                  </span>
                )}
                <span className="text-sm font-heading font-semibold text-white sm:text-right sm:w-28">
                  ${formatUSDT(payment.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Active Installments ── */}
      <section className="mb-12">
        <SectionHeader title="Active Installments" />
        {plansLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : activePlans.length === 0 &&
          completedPlans.length === 0 &&
          defaultedPlans.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                />
              </svg>
            }
            title="No Installment Plans"
            description="When you use Buy Now, Pay Later at a merchant, your active plans will appear here."
          />
        ) : (
          <div className="space-y-4">
            {/* Active plans */}
            {activePlans.map((plan) => {
              const isDue = Date.now() / 1000 >= plan.nextDueDate;
              const pctPaid =
                (plan.installmentsPaid / plan.numInstallments) * 100;
              const txState = planTxState[plan.id] || {};

              return (
                <div
                  key={plan.id}
                  className="rounded-xl border border-navy-700 bg-navy-800/50 p-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Merchant</p>
                      <a
                        href={tronscanAddressLink(plan.merchant)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-teal-400 hover:text-teal-300 transition-colors"
                      >
                        {shortenAddress(plan.merchant)}
                      </a>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 mb-0.5">Total</p>
                      <p className="text-lg font-heading font-bold text-white">
                        ${formatUSDT(plan.totalAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                      <span>
                        {plan.installmentsPaid} of {plan.numInstallments} paid
                      </span>
                      <span>{Math.round(pctPaid)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-navy-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-400 transition-all duration-500"
                        style={{ width: `${pctPaid}%` }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mb-4">
                    <div>
                      <span className="text-gray-400">Next due: </span>
                      <span
                        className={
                          isDue ? 'text-amber-400 font-medium' : 'text-white'
                        }
                      >
                        {isDue ? 'Due now' : formatRelativeTime(plan.nextDueDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Per installment: </span>
                      <span className="text-white">
                        ${formatUSDT(plan.installmentAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Down payment: </span>
                      <span className="text-white">
                        ${formatUSDT(plan.downPayment)}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3">
                    {isDue ? (
                      <button
                        onClick={() =>
                          handleInstallmentPay(
                            plan.id,
                            plan.installmentAmount,
                            false
                          )
                        }
                        disabled={txState.busy}
                        className="px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
                      >
                        {txState.busy ? 'Processing...' : 'Pay Now'}
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          handleInstallmentPay(
                            plan.id,
                            plan.installmentAmount,
                            true
                          )
                        }
                        disabled={txState.busy}
                        className="px-5 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 border border-navy-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
                      >
                        {txState.busy ? 'Processing...' : 'Pay Early'}
                      </button>
                    )}
                  </div>

                  {/* Tx step indicator */}
                  {(txState.step > 0 || txState.error) && (
                    <div className="mt-4">
                      <TxStepIndicator
                        step={txState.step}
                        txHash={txState.tx}
                        error={txState.error}
                        message={txState.msg}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Completed plans */}
            {completedPlans.length > 0 && (
              <>
                <div className="flex items-center gap-3 mt-8 mb-2">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    Completed
                  </h3>
                  <div className="h-px flex-1 bg-navy-700" />
                </div>
                {completedPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-xl border border-navy-700 bg-navy-800/30 p-5 opacity-70"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <a
                          href={tronscanAddressLink(plan.merchant)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono text-teal-400 hover:text-teal-300 transition-colors"
                        >
                          {shortenAddress(plan.merchant)}
                        </a>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                          Completed
                        </span>
                      </div>
                      <span className="text-sm font-heading font-semibold text-white">
                        ${formatUSDT(plan.totalAmount)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-navy-700 overflow-hidden">
                      <div className="h-full rounded-full bg-green-400 w-full" />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {plan.numInstallments} of {plan.numInstallments}{' '}
                      installments paid
                    </p>
                  </div>
                ))}
              </>
            )}

            {/* Defaulted plans */}
            {defaultedPlans.length > 0 && (
              <>
                <div className="flex items-center gap-3 mt-8 mb-2">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    Defaulted
                  </h3>
                  <div className="h-px flex-1 bg-navy-700" />
                </div>
                {defaultedPlans.map((plan) => {
                  const pctPaid =
                    (plan.installmentsPaid / plan.numInstallments) * 100;
                  return (
                    <div
                      key={plan.id}
                      className="rounded-xl border border-red-500/20 bg-red-500/5 p-5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <a
                            href={tronscanAddressLink(plan.merchant)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-mono text-teal-400 hover:text-teal-300 transition-colors"
                          >
                            {shortenAddress(plan.merchant)}
                          </a>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            Defaulted
                          </span>
                        </div>
                        <span className="text-sm font-heading font-semibold text-white">
                          ${formatUSDT(plan.totalAmount)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-navy-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-400"
                          style={{ width: `${pctPaid}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {plan.installmentsPaid} of {plan.numInstallments}{' '}
                        installments paid before default
                      </p>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
