import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useTrustScore } from '../hooks/useTrustScore';
import {
  getMerchantRegistry,
  getBNPLContract,
  approveAndCall,
  getAddresses
} from '../utils/contracts';
import {
  formatUSDT,
  parseUSDT,
  shortenAddress,
  tronscanTxLink,
  tronscanAddressLink,
  TIER_NAMES,
  TIER_COLORS
} from '../utils/format';
import TxStepIndicator from '../components/TxStepIndicator';
import TrustScoreBadge from '../components/TrustScoreBadge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { SkeletonCard } from '../components/SkeletonLoader';
import { toBase58 } from '../utils/tronlink';

const PLACEHOLDER_GRADIENTS = [
  'from-teal-500 to-cyan-600',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-green-600',
  'from-rose-500 to-red-600'
];

function getPlaceholderGradient(index) {
  return PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length];
}

export default function Storefront() {
  const { address: merchantAddress } = useParams();
  const { address: walletAddress, connected, connect } = useWallet();
  const { score, tier, tierName, refresh: refreshScore } = useTrustScore(walletAddress);

  // Merchant data
  const [merchant, setMerchant] = useState(null);
  const [merchantLoading, setMerchantLoading] = useState(true);
  const [merchantError, setMerchantError] = useState(null);

  // Products
  const [products, setProducts] = useState([]);

  // Purchase modal state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState('full');
  const [numInstallments, setNumInstallments] = useState(3);
  const [bnplSettings, setBnplSettings] = useState({
    minTrustTier: 1,
    maxInstallments: 3,
    maxAmount: 500
  });

  // Transaction state
  const [txStep, setTxStep] = useState(0);
  const [txMessage, setTxMessage] = useState('');
  const [txHash, setTxHash] = useState(null);
  const [txError, setTxError] = useState(null);
  const [txSuccess, setTxSuccess] = useState(false);

  // Load merchant info from contract
  const fetchMerchant = useCallback(async () => {
    if (!merchantAddress) return;
    setMerchantLoading(true);
    setMerchantError(null);
    try {
      const registry = await getMerchantRegistry();
      const info = await registry.merchants(merchantAddress).call();
      const name = info.name || info[1];
      const isActive = info.isActive !== undefined ? info.isActive : info[0];
      const totalOrders = info.totalOrders !== undefined
        ? Number(info.totalOrders)
        : Number(info[3] || 0);

      if (!isActive) {
        setMerchantError('This merchant is not currently active.');
        setMerchantLoading(false);
        return;
      }

      setMerchant({
        name,
        address: merchantAddress,
        totalOrders
      });
    } catch (err) {
      console.error('Failed to fetch merchant:', err);
      setMerchantError('Could not load merchant information. Make sure the address is correct.');
    } finally {
      setMerchantLoading(false);
    }
  }, [merchantAddress]);

  // Load products from localStorage
  const loadProducts = useCallback(() => {
    if (!merchantAddress) return;
    try {
      const stored = JSON.parse(
        localStorage.getItem('trustpay_products_' + merchantAddress) || '[]'
      );
      setProducts(stored);
    } catch {
      setProducts([]);
    }
  }, [merchantAddress]);

  // Load BNPL settings from localStorage
  const loadBnplSettings = useCallback(() => {
    if (!merchantAddress) return;
    try {
      const stored = JSON.parse(
        localStorage.getItem('trustpay_bnpl_' + merchantAddress) ||
          '{"minTrustTier":1,"maxInstallments":3,"maxAmount":500}'
      );
      setBnplSettings(stored);
    } catch {
      setBnplSettings({ minTrustTier: 1, maxInstallments: 3, maxAmount: 500 });
    }
  }, [merchantAddress]);

  useEffect(() => {
    fetchMerchant();
    loadProducts();
    loadBnplSettings();
  }, [fetchMerchant, loadProducts, loadBnplSettings]);

  // Open purchase modal
  function openPurchaseModal(product) {
    setSelectedProduct(product);
    setPaymentMode('full');
    setNumInstallments(Math.min(3, bnplSettings.maxInstallments));
    setTxStep(0);
    setTxMessage('');
    setTxHash(null);
    setTxError(null);
    setTxSuccess(false);
    setModalOpen(true);
  }

  function closePurchaseModal() {
    if (txStep > 0 && txStep < 4 && !txError) return;
    setModalOpen(false);
    setSelectedProduct(null);
  }

  // Check if BNPL is eligible for a given product
  function isBnplEligible(product) {
    if (!product.bnplEligible) return false;
    if (tier < bnplSettings.minTrustTier) return false;
    if (Number(product.price) > bnplSettings.maxAmount) return false;
    return true;
  }

  // Calculate installment schedule
  function getInstallmentSchedule(totalPrice, installments) {
    const total = Number(totalPrice);
    const downPayment = total / (installments + 1);
    const remaining = total - downPayment;
    const perInstallment = remaining / installments;
    return { downPayment, perInstallment, installments };
  }

  // Step callback for TxStepIndicator
  function onStep(step, message, result) {
    setTxStep(step);
    setTxMessage(message || '');
    if (step === 4 && result) {
      const hash = typeof result === 'string' ? result : result.txid || result;
      setTxHash(hash);
      setTxSuccess(true);
      refreshScore();
    }
  }

  // Pay in full
  async function handlePayFull() {
    if (!selectedProduct || !connected) return;
    setTxStep(1);
    setTxError(null);
    setTxSuccess(false);
    setTxHash(null);

    try {
      const addresses = getAddresses();
      const registry = await getMerchantRegistry();

      await approveAndCall(
        addresses.merchantRegistry,
        parseUSDT(selectedProduct.price),
        async () => {
          const r = await registry
            .pay(merchantAddress, parseUSDT(selectedProduct.price), selectedProduct.id)
            .send({ feeLimit: 100_000_000 });
          return r;
        },
        onStep
      );
    } catch (err) {
      console.error('Payment failed:', err);
      setTxError(
        err.message || 'Transaction failed. Please check your balance and try again.'
      );
      setTxStep(0);
    }
  }

  // Pay with BNPL
  async function handlePayBNPL() {
    if (!selectedProduct || !connected) return;
    setTxStep(1);
    setTxError(null);
    setTxSuccess(false);
    setTxHash(null);

    try {
      const addresses = getAddresses();

      await approveAndCall(
        addresses.bNPLContract,
        parseUSDT(selectedProduct.price),
        async () => {
          const bnpl = await getBNPLContract();
          return await bnpl
            .createPlan(
              merchantAddress,
              parseUSDT(selectedProduct.price),
              numInstallments,
              selectedProduct.id
            )
            .send({ feeLimit: 200_000_000 });
        },
        onStep
      );
    } catch (err) {
      console.error('BNPL plan creation failed:', err);
      setTxError(
        err.message || 'BNPL transaction failed. Please check your balance and try again.'
      );
      setTxStep(0);
    }
  }

  // ─── RENDER ───────────────────────────────────────────────────────────

  // Loading state
  if (merchantLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="animate-pulse mb-10">
          <div className="h-8 bg-navy-700 rounded w-48 mb-3" />
          <div className="h-4 bg-navy-700 rounded w-64" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Merchant error
  if (merchantError) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <EmptyState
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          title="Merchant Not Found"
          description={merchantError}
        />
      </div>
    );
  }

  const bnplEligibleForProduct = selectedProduct ? isBnplEligible(selectedProduct) : false;
  const schedule = selectedProduct
    ? getInstallmentSchedule(selectedProduct.price, numInstallments)
    : null;

  return (
    <div className="min-h-screen">
      {/* Merchant Header */}
      <div className="border-b border-navy-700/50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-heading font-bold text-white mb-1">
                {merchant?.name || 'Store'}
              </h1>
              <div className="flex items-center gap-3 text-sm">
                <a
                  href={tronscanAddressLink(merchantAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400 hover:text-teal-300 font-mono transition-colors"
                >
                  {shortenAddress(merchantAddress)}
                </a>
                <span className="text-navy-600">|</span>
                <span className="text-gray-400">
                  {merchant?.totalOrders || 0} order{merchant?.totalOrders !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {!connected && (
              <button
                onClick={connect}
                className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-teal-500/25"
              >
                Connect Wallet
              </button>
            )}

            {connected && (
              <div className="flex items-center gap-3">
                <TrustScoreBadge score={score} tier={tier} />
                <span className="text-xs text-gray-400 font-mono">
                  {shortenAddress(walletAddress)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        {products.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            }
            title="No Products Yet"
            description="This merchant hasn't added any products to their storefront."
          />
        ) : (
          <>
            <h2 className="text-xl font-heading font-semibold text-white mb-6">
              Products
              <span className="text-sm font-normal text-gray-400 ml-2">
                ({products.length})
              </span>
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product, idx) => (
                <div
                  key={product.id || idx}
                  className="group rounded-2xl border border-navy-700 bg-navy-800/50 overflow-hidden transition-all hover:border-navy-600 hover:shadow-xl hover:shadow-black/20 hover:scale-[1.02]"
                >
                  {/* Product Image / Placeholder */}
                  <div className="relative h-48 overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div
                        className={`w-full h-full bg-gradient-to-br ${getPlaceholderGradient(idx)} flex items-center justify-center`}
                      >
                        <span className="text-5xl font-heading font-bold text-white/30">
                          {(product.name || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* BNPL Badge */}
                    {product.bnplEligible && (
                      <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-teal-500/90 text-white text-xs font-medium backdrop-blur-sm">
                        BNPL eligible
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-5">
                    <h3 className="text-lg font-heading font-semibold text-white mb-1">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-teal-400">
                        ${Number(product.price).toFixed(2)}
                        <span className="text-xs font-normal text-gray-400 ml-1">USDT</span>
                      </span>

                      {connected ? (
                        <button
                          onClick={() => openPurchaseModal(product)}
                          className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white font-medium text-sm transition-all hover:shadow-lg hover:shadow-teal-500/25"
                        >
                          Buy
                        </button>
                      ) : (
                        <button
                          onClick={connect}
                          className="px-4 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-gray-300 font-medium text-sm border border-navy-600 transition-colors"
                        >
                          Connect to Buy
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Purchase Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closePurchaseModal}
        title={txSuccess ? 'Payment Successful' : `Buy ${selectedProduct?.name || ''}`}
      >
        {selectedProduct && (
          <div className="space-y-5">
            {/* Success State */}
            {txSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-teal-500/10 border-2 border-teal-500/30 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-teal-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-heading font-semibold text-white mb-2">
                  {paymentMode === 'bnpl' ? 'BNPL Plan Created!' : 'Payment Complete!'}
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  {paymentMode === 'bnpl'
                    ? `Your ${numInstallments}-installment plan has been created.`
                    : `You purchased ${selectedProduct.name} for $${Number(selectedProduct.price).toFixed(2)} USDT.`}
                </p>

                {txHash && (
                  <a
                    href={tronscanTxLink(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 font-mono underline transition-colors"
                  >
                    View on Tronscan
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                )}

                <div className="mt-5 p-3 rounded-xl bg-teal-500/5 border border-teal-500/20">
                  <p className="text-sm text-teal-400 font-medium">
                    Your trust score increased!
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Keep purchasing to unlock better BNPL terms.
                  </p>
                </div>

                <button
                  onClick={closePurchaseModal}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold text-sm transition-all w-full"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* Product Summary */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-navy-900/50 border border-navy-700">
                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    {selectedProduct.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={`w-full h-full bg-gradient-to-br ${getPlaceholderGradient(
                          products.indexOf(selectedProduct)
                        )} flex items-center justify-center`}
                      >
                        <span className="text-lg font-bold text-white/40">
                          {(selectedProduct.name || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-lg font-bold text-teal-400">
                      ${Number(selectedProduct.price).toFixed(2)}
                      <span className="text-xs font-normal text-gray-400 ml-1">USDT</span>
                    </p>
                  </div>
                </div>

                {/* Trust Score */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-navy-900/30 border border-navy-700">
                  <span className="text-sm text-gray-400">Your Trust Score</span>
                  <TrustScoreBadge score={score} tier={tier} />
                </div>

                {/* Payment Options */}
                {txStep === 0 && !txError && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Payment Method
                    </p>

                    {/* Pay in Full */}
                    <button
                      onClick={() => setPaymentMode('full')}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        paymentMode === 'full'
                          ? 'border-teal-500/50 bg-teal-500/5'
                          : 'border-navy-700 bg-navy-900/30 hover:border-navy-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">Pay in Full</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            One-time payment of ${Number(selectedProduct.price).toFixed(2)} USDT
                          </p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            paymentMode === 'full'
                              ? 'border-teal-500'
                              : 'border-navy-600'
                          }`}
                        >
                          {paymentMode === 'full' && (
                            <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* BNPL Option */}
                    {selectedProduct.bnplEligible && (
                      <button
                        onClick={() => {
                          if (bnplEligibleForProduct) setPaymentMode('bnpl');
                        }}
                        disabled={!bnplEligibleForProduct}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          !bnplEligibleForProduct
                            ? 'border-navy-700 bg-navy-900/20 opacity-50 cursor-not-allowed'
                            : paymentMode === 'bnpl'
                              ? 'border-teal-500/50 bg-teal-500/5'
                              : 'border-navy-700 bg-navy-900/30 hover:border-navy-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              Pay in Installments
                            </p>
                            {bnplEligibleForProduct ? (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Split into {numInstallments} payments
                              </p>
                            ) : (
                              <p className="text-xs text-amber-400 mt-0.5">
                                {tier < bnplSettings.minTrustTier
                                  ? `Requires ${TIER_NAMES[bnplSettings.minTrustTier] || 'higher'} trust tier`
                                  : `Max BNPL amount: $${bnplSettings.maxAmount}`}
                              </p>
                            )}
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              paymentMode === 'bnpl'
                                ? 'border-teal-500'
                                : 'border-navy-600'
                            }`}
                          >
                            {paymentMode === 'bnpl' && (
                              <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                            )}
                          </div>
                        </div>
                      </button>
                    )}

                    {/* BNPL Installment Preview */}
                    {paymentMode === 'bnpl' && bnplEligibleForProduct && schedule && (
                      <div className="p-4 rounded-xl bg-navy-900/50 border border-navy-700 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Installments</span>
                          <div className="flex items-center gap-2">
                            {[2, 3, 4]
                              .filter((n) => n <= bnplSettings.maxInstallments)
                              .map((n) => (
                                <button
                                  key={n}
                                  onClick={() => setNumInstallments(n)}
                                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                                    numInstallments === n
                                      ? 'bg-teal-500 text-white'
                                      : 'bg-navy-700 text-gray-400 hover:bg-navy-600'
                                  }`}
                                >
                                  {n}x
                                </button>
                              ))}
                          </div>
                        </div>

                        <div className="border-t border-navy-700 pt-3 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Down payment (today)</span>
                            <span className="text-white font-medium">
                              ${schedule.downPayment.toFixed(2)} USDT
                            </span>
                          </div>
                          {Array.from({ length: schedule.installments }).map((_, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-500">Installment {i + 1}</span>
                              <span className="text-gray-300">
                                ${schedule.perInstallment.toFixed(2)} USDT
                              </span>
                            </div>
                          ))}
                          <div className="border-t border-navy-700 pt-2 flex items-center justify-between text-sm">
                            <span className="text-gray-400 font-medium">Total</span>
                            <span className="text-teal-400 font-bold">
                              ${Number(selectedProduct.price).toFixed(2)} USDT
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 italic">
                          Due today, then every 5 minutes (demo schedule)
                        </p>
                      </div>
                    )}

                    {/* Confirm Button */}
                    <button
                      onClick={paymentMode === 'bnpl' ? handlePayBNPL : handlePayFull}
                      className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-teal-500/25"
                    >
                      {paymentMode === 'bnpl'
                        ? `Pay $${schedule?.downPayment.toFixed(2)} Now + ${numInstallments} Installments`
                        : `Pay $${Number(selectedProduct.price).toFixed(2)} USDT`}
                    </button>
                  </div>
                )}

                {/* Transaction Progress */}
                {(txStep > 0 || txError) && (
                  <TxStepIndicator
                    step={txStep}
                    txHash={txHash}
                    error={txError}
                    message={txMessage}
                  />
                )}

                {/* Retry on Error */}
                {txError && (
                  <button
                    onClick={() => {
                      setTxError(null);
                      setTxStep(0);
                    }}
                    className="w-full py-2.5 rounded-xl bg-navy-700 hover:bg-navy-600 text-white font-medium text-sm border border-navy-600 transition-colors"
                  >
                    Try Again
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
