import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { shortenAddress } from '../utils/format';
import TrustScoreBadge from './TrustScoreBadge';
import { useTrustScore } from '../hooks/useTrustScore';

const NAV_LINKS = [
  { to: '/merchant', label: 'Merchant' },
  { to: '/profile', label: 'My Profile' },
  { to: '/lp', label: 'Liquidity' }
];

export default function Navbar() {
  const { address, connected, connecting, connect } = useWallet();
  const { score, tier } = useTrustScore(address);
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 border-b border-navy-700/50 bg-navy-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="font-heading font-bold text-lg text-white">TrustPay</span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith(to)
                    ? 'text-teal-400 bg-teal-400/10'
                    : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Wallet */}
          <div className="flex items-center gap-3">
            {connected && address && (
              <TrustScoreBadge score={score} tier={tier} />
            )}
            {connected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-800 border border-navy-600">
                <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-sm text-gray-300 font-mono">
                  {shortenAddress(address)}
                </span>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={connecting}
                className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white font-medium text-sm transition-colors disabled:opacity-50"
              >
                {connecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden flex items-center gap-1 px-4 pb-2">
        {NAV_LINKS.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              location.pathname.startsWith(to)
                ? 'text-teal-400 bg-teal-400/10'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
