import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useTrustScore } from '../hooks/useTrustScore';
import { usePolling } from '../hooks/usePolling';
import { getMerchantRegistry, getUSDTBalance } from '../utils/contracts';
import { formatUSDT, shortenAddress, tronscanTxLink, formatDate } from '../utils/format';
import { toBase58 } from '../utils/tronlink';
import TxStepIndicator from '../components/TxStepIndicator';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { SkeletonCard, SkeletonRow } from '../components/SkeletonLoader';

/* ───────────────────── sidebar tab config ───────────────────── */
const TABS = [
  { id: 'overview',   label: 'Overview',        icon: OverviewIcon },
  { id: 'products',   label: 'Products',        icon: ProductsIcon },
  { id: 'orders',     label: 'Orders',          icon: OrdersIcon },
  { id: 'bnpl',       label: 'BNPL Settings',   icon: BNPLIcon },
  { id: 'storefront', label: 'Storefront Link', icon: StorefrontIcon },
];

/* ───────────────────── SVG icons ───────────────────── */
function OverviewIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  );
}
function ProductsIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
function OrdersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}
function BNPLIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function StorefrontIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function MerchantDashboard() {
  const { address, connected } = useWallet();
  const { score, tier, tierName } = useTrustScore(address);

  /* ── merchant registration state ── */
  const [merchantName, setMerchantName] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [merchantInfo, setMerchantInfo] = useState(null);
  const [checkingReg, setCheckingReg] = useState(true);
  const [regStep, setRegStep] = useState(0);
  const [regMsg, setRegMsg] = useState('');
  const [regError, setRegError] = useState(null);
  const [regTxHash, setRegTxHash] = useState(null);

  /* ── tab state ── */
  const [activeTab, setActiveTab] = useState('overview');

  /* ── balance ── */
  const [balance, setBalance] = useState(null);

  /* ── product modal ── */
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  /* ── BNPL tier options ── */
  const TIER_OPTIONS = [
    { value: 1, label: 'Building' },
    { value: 2, label: 'Trusted' },
    { value: 3, label: 'Established' },
  ];

  /* ── copy feedback ── */
  const [copied, setCopied] = useState(false);

  /* ═══════════ check registration on mount ═══════════ */
  useEffect(() => {
    if (!connected || !address) {
      setCheckingReg(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const registry = await getMerchantRegistry();
        const merchant = await registry.merchants(address).call();
        if (!cancelled) {
          const registered = merchant[0] || merchant.isRegistered;
          setIsRegistered(registered);
          if (registered) {
            setMerchantInfo({
              name: merchant[1] || merchant.name,
              totalRevenue: (merchant[2] || merchant.totalRevenue).toString(),
              orderCount: Number(merchant[3] || merchant.orderCount),
            });
          }
        }
      } catch (err) {
        console.error('Merchant check error:', err);
      } finally {
        if (!cancelled) setCheckingReg(false);
      }
    })();
    return () => { cancelled = true; };
  }, [connected, address]);

  /* ═══════════ fetch USDT balance ═══════════ */
  useEffect(() => {
    if (!connected || !address) return;
    let cancelled = false;
    (async () => {
      try {
        const bal = await getUSDTBalance(address);
        if (!cancelled) setBalance(bal);
      } catch (err) {
        console.error('Balance fetch error:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [connected, address, isRegistered]);

  /* ═══════════ fetch orders (polled every 15s) ═══════════ */
  const fetchOrders = useCallback(async () => {
    if (!connected || !address || !isRegistered) return [];
    try {
      const registry = await getMerchantRegistry();
      const indices = await registry.getMerchantPayments(address).call();
      const payments = await Promise.all(
        indices.map(async (idx) => {
          const p = await registry.getPayment(Number(idx)).call();
          return {
            index: Number(idx),
            customer: toBase58(p.customer || p[0]),
            merchant: toBase58(p.merchant || p[1]),
            amount: (p.amount || p[2]).toString(),
            timestamp: Number(p.timestamp || p[3]),
            productId: p.productId || p[4],
          };
        })
      );
      return payments.sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
      console.error('Fetch orders error:', err);
      return [];
    }
  }, [connected, address, isRegistered]);

  const { data: orders, loading: ordersLoading, refresh: refreshOrders } = usePolling(fetchOrders, 15000);

  /* ═══════════ products (localStorage) ═══════════ */
  const productsKey = `trustpay_products_${address}`;
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!address) return;
    try {
      const stored = localStorage.getItem(productsKey);
      if (stored) setProducts(JSON.parse(stored));
    } catch { /* ignore parse errors */ }
  }, [address, productsKey]);

  const saveProducts = (updated) => {
    setProducts(updated);
    localStorage.setItem(productsKey, JSON.stringify(updated));
  };

  const handleDeleteProduct = (id) => {
    saveProducts(products.filter((p) => p.id !== id));
  };

  /* ═══════════ BNPL settings (localStorage) ═══════════ */
  const bnplKey = `trustpay_bnpl_${address}`;
  const defaultBnpl = { minTrustTier: 1, maxInstallments: 3, maxAmount: 500 };
  const [bnplSettings, setBnplSettings] = useState(defaultBnpl);

  useEffect(() => {
    if (!address) return;
    try {
      const stored = localStorage.getItem(bnplKey);
      if (stored) setBnplSettings(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [address, bnplKey]);

  const updateBnpl = (patch) => {
    const next = { ...bnplSettings, ...patch };
    setBnplSettings(next);
    localStorage.setItem(bnplKey, JSON.stringify(next));
  };

  /* ═══════════ register merchant ═══════════ */
  const handleRegister = async () => {
    if (!merchantName.trim()) return;
    setRegError(null);
    setRegStep(1);
    setRegMsg('Confirm registration in TronLink...');
    try {
      const registry = await getMerchantRegistry();
      setRegStep(2);
      setRegMsg('Waiting for confirmation...');
      const tx = await registry.registerMerchant(merchantName.trim()).send({ feeLimit: 100_000_000 });
      setRegTxHash(tx);
      setRegStep(3);
      setRegMsg('Processing registration...');
      await new Promise((r) => setTimeout(r, 3000));
      setRegStep(4);
      setRegMsg('Registration complete!');
      setTimeout(() => {
        setIsRegistered(true);
        setMerchantInfo({ name: merchantName.trim(), totalRevenue: '0', orderCount: 0 });
        setRegStep(0);
      }, 1500);
    } catch (err) {
      console.error('Registration error:', err);
      setRegError(err.message || 'Registration failed. Please try again.');
      setRegStep(0);
    }
  };

  /* ═══════════ NOT CONNECTED ═══════════ */
  if (!connected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-navy-800 border border-navy-600 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h2 className="text-2xl font-heading font-bold text-white mb-3">Connect Your Wallet</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Connect your TronLink wallet to access the merchant dashboard. You will be able to
            register your store, manage products, and track payments.
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════ LOADING CHECK ═══════════ */
  if (checkingReg) {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  /* ═══════════ REGISTRATION FLOW ═══════════ */
  if (!isRegistered) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-navy-700 bg-navy-800/50 p-8">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500/20 to-teal-500/5 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-xl font-heading font-bold text-white mb-2">Register as a Merchant</h2>
              <p className="text-sm text-gray-400">
                Set up your on-chain store to accept USDT payments and offer BNPL to customers.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Store Name</label>
                <input
                  type="text"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  placeholder="e.g. My Crypto Store"
                  maxLength={64}
                  className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-600 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
                />
              </div>

              <button
                onClick={handleRegister}
                disabled={!merchantName.trim() || regStep > 0}
                className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-teal-500/25"
              >
                {regStep > 0 ? 'Registering...' : 'Register Store'}
              </button>

              {(regStep > 0 || regError) && (
                <TxStepIndicator step={regStep} txHash={regTxHash} error={regError} message={regMsg} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════ MAIN DASHBOARD (registered) ═══════════ */
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* ─── Sidebar ─── */}
      <aside className="w-60 flex-shrink-0 border-r border-navy-700/50 bg-navy-900/50 hidden lg:flex flex-col">
        <div className="p-5 border-b border-navy-700/50">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Store</p>
          <p className="text-sm font-heading font-semibold text-white truncate">
            {merchantInfo?.name || 'My Store'}
          </p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{shortenAddress(address)}</p>
        </div>

        <nav className="flex-1 py-3 px-3 space-y-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-teal-500/10 text-teal-400'
                    : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ─── Mobile Tab Bar ─── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-navy-900/95 backdrop-blur-xl border-t border-navy-700/50 flex items-center justify-around px-2 py-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                active ? 'text-teal-400' : 'text-gray-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[4rem]">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Content ─── */}
      <main className="flex-1 overflow-y-auto pb-24 lg:pb-8">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {activeTab === 'overview' && (
            <OverviewTab
              merchantInfo={merchantInfo}
              balance={balance}
              orders={orders}
              ordersLoading={ordersLoading}
            />
          )}
          {activeTab === 'products' && (
            <ProductsTab
              products={products}
              saveProducts={saveProducts}
              onDelete={handleDeleteProduct}
              modalOpen={productModalOpen}
              setModalOpen={setProductModalOpen}
              editingProduct={editingProduct}
              setEditingProduct={setEditingProduct}
            />
          )}
          {activeTab === 'orders' && (
            <OrdersTab orders={orders} ordersLoading={ordersLoading} />
          )}
          {activeTab === 'bnpl' && (
            <BNPLSettingsTab
              settings={bnplSettings}
              updateBnpl={updateBnpl}
              tierOptions={TIER_OPTIONS}
            />
          )}
          {activeTab === 'storefront' && (
            <StorefrontTab address={address} copied={copied} setCopied={setCopied} />
          )}
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Tab: Overview
   ═══════════════════════════════════════════════════════════════ */
function OverviewTab({ merchantInfo, balance, orders, ordersLoading }) {
  const recentOrders = (orders || []).slice(0, 5);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-white mb-1">Dashboard</h1>
        <p className="text-sm text-gray-400">Overview of your store performance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Revenue"
          value={`$${formatUSDT(merchantInfo?.totalRevenue || '0')}`}
          sub="USDT"
          color="teal"
        />
        <StatCard
          label="Total Orders"
          value={merchantInfo?.orderCount ?? 0}
          sub="all time"
          color="blue"
        />
        <StatCard
          label="USDT Balance"
          value={balance !== null ? `$${formatUSDT(balance)}` : '--'}
          sub="wallet"
          color="amber"
        />
      </div>

      {/* Recent Orders */}
      <div className="rounded-xl border border-navy-700 bg-navy-800/30">
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-700/50">
          <h3 className="text-sm font-heading font-semibold text-white">Recent Orders</h3>
          {recentOrders.length > 0 && (
            <span className="text-xs text-gray-500">{recentOrders.length} shown</span>
          )}
        </div>

        {ordersLoading && !orders ? (
          <div className="divide-y divide-navy-700/30">
            {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : recentOrders.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            title="No orders yet"
            description="Share your storefront link with customers to start receiving orders."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Customer</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                  <th className="text-right px-5 py-3 font-medium">TX Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/30">
                {recentOrders.map((order) => (
                  <tr key={order.index} className="hover:bg-navy-700/20 transition-colors">
                    <td className="px-5 py-3 text-gray-300 whitespace-nowrap">{formatDate(order.timestamp)}</td>
                    <td className="px-5 py-3 text-gray-400 font-mono">{shortenAddress(order.customer)}</td>
                    <td className="px-5 py-3 text-right text-white font-medium">${formatUSDT(order.amount)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-xs text-gray-500 font-mono">#{order.index}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Stat Card ── */
function StatCard({ label, value, sub, color }) {
  const accents = {
    teal:  'from-teal-500/10 to-transparent border-teal-500/10',
    blue:  'from-blue-500/10 to-transparent border-blue-500/10',
    amber: 'from-amber-500/10 to-transparent border-amber-500/10',
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-b p-5 ${accents[color] || accents.teal}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-heading font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Tab: Products
   ═══════════════════════════════════════════════════════════════ */
function ProductsTab({ products, saveProducts, onDelete, modalOpen, setModalOpen, editingProduct, setEditingProduct }) {
  const openAddModal = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setModalOpen(true);
  };

  const handleSaveProduct = (productData) => {
    if (editingProduct) {
      const updated = products.map((p) => (p.id === editingProduct.id ? { ...p, ...productData } : p));
      saveProducts(updated);
    } else {
      saveProducts([...products, { ...productData, id: Date.now().toString() }]);
    }
    setModalOpen(false);
    setEditingProduct(null);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white mb-1">Products</h1>
          <p className="text-sm text-gray-400">Manage your store inventory</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white font-medium text-sm transition-colors hover:shadow-lg hover:shadow-teal-500/25"
        >
          + Add Product
        </button>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
          title="No products yet"
          description="Add your first product to start accepting payments."
          action={openAddModal}
          actionLabel="Add Product"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-xl border border-navy-700 bg-navy-800/30 overflow-hidden group hover:border-navy-600 transition-colors"
            >
              {product.imageUrl && (
                <div className="h-40 bg-navy-700/30 overflow-hidden">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-white truncate">{product.name}</h3>
                  <span className="text-sm font-heading font-bold text-teal-400 flex-shrink-0">
                    ${product.price}
                  </span>
                </div>
                {product.description && (
                  <p className="text-xs text-gray-400 line-clamp-2 mb-3">{product.description}</p>
                )}
                <div className="flex items-center justify-between">
                  {product.bnplEligible ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      BNPL
                    </span>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(product)}
                      className="p-1.5 rounded-md hover:bg-navy-700 text-gray-400 hover:text-white transition-colors"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(product.id)}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProduct(null); }}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
      >
        <ProductForm
          initial={editingProduct}
          onSave={handleSaveProduct}
          onCancel={() => { setModalOpen(false); setEditingProduct(null); }}
        />
      </Modal>
    </>
  );
}

/* ── Product Form ── */
function ProductForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [price, setPrice] = useState(initial?.price || '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || '');
  const [bnplEligible, setBnplEligible] = useState(initial?.bnplEligible || false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !price) return;
    onSave({ name: name.trim(), description: description.trim(), price, imageUrl: imageUrl.trim(), bnplEligible });
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-600 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Product Name *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Premium Widget" className={inputClass} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief product description..." rows={3} className={`${inputClass} resize-none`} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Price (USDT) *</label>
        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" min="0" step="0.01" className={inputClass} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Image URL</label>
        <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className={inputClass} />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => setBnplEligible(!bnplEligible)}
          className={`relative w-10 h-5 rounded-full transition-colors ${bnplEligible ? 'bg-teal-500' : 'bg-navy-600'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${bnplEligible ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
        <label className="text-sm text-gray-300">Eligible for BNPL</label>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" className="flex-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold text-sm transition-colors">
          {initial ? 'Save Changes' : 'Add Product'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-navy-700 hover:bg-navy-600 text-gray-300 font-medium text-sm transition-colors border border-navy-600">
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Tab: Orders
   ═══════════════════════════════════════════════════════════════ */
function OrdersTab({ orders, ordersLoading }) {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-white mb-1">Orders</h1>
        <p className="text-sm text-gray-400">All payment transactions for your store</p>
      </div>

      <div className="rounded-xl border border-navy-700 bg-navy-800/30">
        {ordersLoading && !orders ? (
          <div className="divide-y divide-navy-700/30">
            {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : !orders || orders.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            title="No orders yet"
            description="When customers make purchases through your storefront, their orders will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-navy-700/50">
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Customer</th>
                  <th className="text-left px-5 py-3 font-medium">Product ID</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                  <th className="text-right px-5 py-3 font-medium">TX Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/30">
                {orders.map((order) => (
                  <tr key={order.index} className="hover:bg-navy-700/20 transition-colors">
                    <td className="px-5 py-3.5 text-gray-300 whitespace-nowrap">{formatDate(order.timestamp)}</td>
                    <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{shortenAddress(order.customer)}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {order.productId || <span className="text-gray-600">--</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right text-white font-medium">${formatUSDT(order.amount)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-xs text-gray-500 font-mono">#{order.index}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Tab: BNPL Settings
   ═══════════════════════════════════════════════════════════════ */
function BNPLSettingsTab({ settings, updateBnpl, tierOptions }) {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-white mb-1">BNPL Settings</h1>
        <p className="text-sm text-gray-400">Configure buy-now-pay-later terms for your customers</p>
      </div>

      <div className="max-w-lg space-y-6">
        {/* Min Trust Tier */}
        <div className="rounded-xl border border-navy-700 bg-navy-800/30 p-5">
          <label className="block text-sm font-medium text-white mb-1">Minimum Trust Tier</label>
          <p className="text-xs text-gray-400 mb-3">
            Customers must reach this trust tier before they can use BNPL at your store.
          </p>
          <select
            value={settings.minTrustTier}
            onChange={(e) => updateBnpl({ minTrustTier: Number(e.target.value) })}
            className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors appearance-none cursor-pointer"
          >
            {tierOptions.map((t) => (
              <option key={t.value} value={t.value}>{t.label} (Tier {t.value})</option>
            ))}
          </select>
        </div>

        {/* Max Installments */}
        <div className="rounded-xl border border-navy-700 bg-navy-800/30 p-5">
          <label className="block text-sm font-medium text-white mb-1">Max Installments</label>
          <p className="text-xs text-gray-400 mb-3">
            Maximum number of installment payments a customer can split their purchase into.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={2}
              max={4}
              step={1}
              value={settings.maxInstallments}
              onChange={(e) => updateBnpl({ maxInstallments: Number(e.target.value) })}
              className="flex-1 h-1.5 bg-navy-600 rounded-lg appearance-none cursor-pointer accent-teal-500"
            />
            <span className="w-12 text-center text-sm font-heading font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-lg py-1">
              {settings.maxInstallments}
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1.5 px-0.5">
            <span>2</span>
            <span>3</span>
            <span>4</span>
          </div>
        </div>

        {/* Max BNPL Amount */}
        <div className="rounded-xl border border-navy-700 bg-navy-800/30 p-5">
          <label className="block text-sm font-medium text-white mb-1">Max BNPL Amount (USDT)</label>
          <p className="text-xs text-gray-400 mb-3">
            Maximum purchase amount eligible for BNPL. Orders above this amount must be paid in full.
          </p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              value={settings.maxAmount}
              onChange={(e) => updateBnpl({ maxAmount: Number(e.target.value) })}
              min={10}
              max={10000}
              step={10}
              className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-navy-900 border border-navy-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-colors"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-5">
          <h4 className="text-sm font-medium text-teal-400 mb-2">Current Settings Summary</h4>
          <ul className="space-y-1 text-xs text-gray-300">
            <li>Customers with <span className="text-white font-medium">{tierOptions.find((t) => t.value === settings.minTrustTier)?.label || 'Building'}</span> tier or higher can use BNPL</li>
            <li>Purchases can be split into up to <span className="text-white font-medium">{settings.maxInstallments} installments</span></li>
            <li>Maximum BNPL order: <span className="text-white font-medium">${settings.maxAmount.toLocaleString()} USDT</span></li>
          </ul>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Tab: Storefront Link
   ═══════════════════════════════════════════════════════════════ */
function StorefrontTab({ address, copied, setCopied }) {
  const storefrontUrl = `${window.location.origin}/#/store/${address}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = storefrontUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-white mb-1">Storefront Link</h1>
        <p className="text-sm text-gray-400">Share this link with your customers so they can browse and buy your products</p>
      </div>

      <div className="max-w-lg">
        <div className="rounded-xl border border-navy-700 bg-navy-800/30 p-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">Your Storefront URL</label>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-600 text-sm text-gray-300 font-mono truncate flex items-center">
              {storefrontUrl}
            </div>
            <button
              onClick={copyToClipboard}
              className={`px-4 rounded-xl text-sm font-medium transition-all flex items-center gap-2 flex-shrink-0 ${
                copied
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                  : 'bg-teal-500 hover:bg-teal-400 text-white hover:shadow-lg hover:shadow-teal-500/25'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-navy-700/50">
            <h4 className="text-sm font-medium text-white mb-3">How it works</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-navy-700 text-gray-300 flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">1</span>
                Share this link with your customers via any channel
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-navy-700 text-gray-300 flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">2</span>
                Customers connect their TronLink wallet on your storefront
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-navy-700 text-gray-300 flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">3</span>
                They browse products and pay with USDT (or BNPL if eligible)
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-navy-700 text-gray-300 flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">4</span>
                Payments appear in your Orders tab automatically
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
