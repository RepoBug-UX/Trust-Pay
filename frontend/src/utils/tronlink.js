/**
 * TronLink wallet integration utilities.
 * TronLink injects window.tronWeb asynchronously — must poll for it.
 */

export function waitForTronWeb(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (window.tronWeb && window.tronWeb.ready) {
      return resolve(window.tronWeb);
    }

    const start = Date.now();
    const interval = setInterval(() => {
      if (window.tronWeb && window.tronWeb.ready) {
        clearInterval(interval);
        resolve(window.tronWeb);
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error('TronLink not found. Please install TronLink extension.'));
      }
    }, 500);
  });
}

export function getAddress() {
  if (window.tronWeb && window.tronWeb.defaultAddress) {
    return window.tronWeb.defaultAddress.base58;
  }
  return null;
}

export function onAddressChanged(callback) {
  let lastAddress = getAddress();
  const interval = setInterval(() => {
    const current = getAddress();
    if (current !== lastAddress) {
      lastAddress = current;
      callback(current);
    }
  }, 2000);
  return () => clearInterval(interval);
}

export function isTronLinkInstalled() {
  return typeof window.tronWeb !== 'undefined';
}

export function toBase58(hexAddress) {
  if (!hexAddress || !window.tronWeb) return hexAddress;
  if (hexAddress.startsWith('T')) return hexAddress; // already base58
  try {
    return window.tronWeb.address.fromHex(hexAddress);
  } catch {
    return hexAddress;
  }
}
