import { useState, useEffect, useCallback } from 'react';
import { waitForTronWeb, getAddress, onAddressChanged } from '../utils/tronlink';

export function useWallet() {
  const [address, setAddress] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await waitForTronWeb(10000);
      const addr = getAddress();
      if (addr) {
        setAddress(addr);
        setConnected(true);
      } else {
        setError('No account found in TronLink. Please unlock your wallet.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Listen for address changes
  useEffect(() => {
    const cleanup = onAddressChanged((newAddr) => {
      setAddress(newAddr);
      setConnected(!!newAddr);
    });
    return cleanup;
  }, []);

  return { address, connected, connecting, error, connect };
}
