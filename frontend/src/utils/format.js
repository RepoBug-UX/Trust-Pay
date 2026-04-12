/**
 * Formatting utilities for USDT amounts, addresses, and links.
 */

export function formatUSDT(amount) {
  if (amount === null || amount === undefined) return '0.00';
  const num = Number(amount) / 1e6;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseUSDT(displayAmount) {
  return Math.round(Number(displayAmount) * 1e6);
}

export function shortenAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function tronscanTxLink(txid) {
  return `https://nile.tronscan.org/#/transaction/${txid}`;
}

export function tronscanAddressLink(addr) {
  return `https://nile.tronscan.org/#/address/${addr}`;
}

export function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = Number(timestamp) * 1000 - now;
  if (diff < 0) return 'Overdue';
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

export const TIER_NAMES = ['New', 'Building', 'Trusted', 'Established'];
export const TIER_COLORS = {
  0: { text: 'text-gray-400', bg: 'bg-gray-400', ring: '#9ca3af' },
  1: { text: 'text-blue-400', bg: 'bg-blue-400', ring: '#60a5fa' },
  2: { text: 'text-teal-400', bg: 'bg-teal-400', ring: '#2dd4bf' },
  3: { text: 'text-amber-400', bg: 'bg-amber-400', ring: '#fbbf24' }
};
