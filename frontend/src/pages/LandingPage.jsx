import { Link } from 'react-router-dom';

const STEPS = [
  {
    num: '01',
    title: 'Merchant sets up shop',
    desc: 'Register your store, add products, and configure BNPL terms. Share your storefront link with customers.'
  },
  {
    num: '02',
    title: 'Customers buy & build trust',
    desc: 'Every on-chain payment builds your trust score. A portable, decentralized credit identity that belongs to you.'
  },
  {
    num: '03',
    title: 'Unlock buy now, pay later',
    desc: 'Higher trust scores unlock installment payments. No credit checks, no banks — just on-chain payment history.'
  }
];

const ROLES = [
  {
    title: 'Merchant',
    desc: 'Accept crypto payments with built-in BNPL. Get paid in full upfront while customers pay over time.',
    to: '/merchant',
    cta: 'Start Selling',
    gradient: 'from-teal-500/20 to-teal-500/5'
  },
  {
    title: 'Shopper',
    desc: 'Build your on-chain credit score with every purchase. Unlock installment plans at your favorite stores.',
    to: '/profile',
    cta: 'View Profile',
    gradient: 'from-blue-500/20 to-blue-500/5'
  },
  {
    title: 'Liquidity Provider',
    desc: 'Fund the BNPL pool and earn yield from installment repayments. Track utilization and returns.',
    to: '/lp',
    cta: 'Provide Liquidity',
    gradient: 'from-amber-500/20 to-amber-500/5'
  }
];

const FEATURES = [
  { title: 'On-Chain Verifiable', desc: 'Every transaction has a hash you can verify on TRON explorer' },
  { title: 'No Credit Checks', desc: 'Your trust score is built from real payment history, not paperwork' },
  { title: 'Instant Settlement', desc: 'Merchants get paid in full immediately, even for BNPL purchases' },
  { title: 'Portable Identity', desc: 'Your trust score works across all TrustPay merchants' },
  { title: 'LP Yield', desc: 'Liquidity providers earn returns from BNPL installment repayments' },
  { title: 'Decentralized', desc: 'No banks, no intermediaries. Smart contracts handle everything' }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-teal-500/5 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            Built on TRON · Nile Testnet
          </div>
          <h1 className="text-5xl md:text-7xl font-heading font-extrabold text-white leading-tight mb-6">
            Payments that
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-300">
              build trust
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Every purchase builds your on-chain credit score. Unlock buy-now-pay-later
            installment terms — no banks, no credit checks, just your payment history.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/merchant"
              className="px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold transition-all hover:shadow-lg hover:shadow-teal-500/25"
            >
              I'm a Merchant
            </Link>
            <Link
              to="/profile"
              className="px-6 py-3 rounded-xl bg-navy-700 hover:bg-navy-600 text-white font-semibold border border-navy-600 transition-all"
            >
              I'm a Shopper
            </Link>
            <Link
              to="/lp"
              className="px-6 py-3 rounded-xl bg-navy-700 hover:bg-navy-600 text-white font-semibold border border-navy-600 transition-all"
            >
              Provide Liquidity
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-heading font-bold text-white text-center mb-4">How it works</h2>
        <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
          Three steps to building your decentralized credit identity on TRON.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((step) => (
            <div key={step.num} className="relative">
              <span className="text-6xl font-heading font-extrabold text-navy-700 absolute -top-4 -left-2 select-none">
                {step.num}
              </span>
              <div className="relative pt-8 pl-4">
                <h3 className="text-lg font-heading font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Role Cards */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-heading font-bold text-white text-center mb-16">Choose your role</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {ROLES.map((role) => (
            <Link
              key={role.title}
              to={role.to}
              className="group rounded-2xl border border-navy-700 bg-gradient-to-b hover:border-navy-600 transition-all p-6 block"
              style={{ background: `linear-gradient(to bottom, ${role.gradient.split(' ')[0].replace('from-', '')}, transparent)` }}
            >
              <div className={`rounded-2xl bg-gradient-to-br ${role.gradient} p-6 mb-4`}>
                <h3 className="text-xl font-heading font-bold text-white mb-2">{role.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{role.desc}</p>
              </div>
              <span className="text-teal-400 text-sm font-medium group-hover:text-teal-300 transition-colors">
                {role.cta} &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-heading font-bold text-white text-center mb-16">Why TrustPay</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-navy-700 bg-navy-800/30 p-5">
              <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-navy-700/50 py-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-xs text-gray-500">
          <span>TrustPay &mdash; Built on TRON</span>
          <a
            href="https://nile.tronscan.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-teal-400 transition-colors"
          >
            Nile Testnet Explorer
          </a>
        </div>
      </footer>
    </div>
  );
}
