/**
 * Smart contract interaction utilities.
 * Handles contract instantiation, ABI loading, and the approve+call pattern.
 */

import MockUSDTAbi from '../contracts/MockUSDT.abi.json';
import TrustScoreAbi from '../contracts/TrustScore.abi.json';
import MerchantRegistryAbi from '../contracts/MerchantRegistry.abi.json';
import LPPoolAbi from '../contracts/LPPool.abi.json';
import BNPLContractAbi from '../contracts/BNPLContract.abi.json';
import addresses from '../contracts/addresses.json';

async function getContract(abi, address) {
  if (!window.tronWeb || !window.tronWeb.ready) {
    throw new Error('TronWeb not ready');
  }
  return await window.tronWeb.contract(abi, address);
}

export async function getUSDT() {
  return getContract(MockUSDTAbi, addresses.mockUSDT);
}

export async function getTrustScore() {
  return getContract(TrustScoreAbi, addresses.trustScore);
}

export async function getMerchantRegistry() {
  return getContract(MerchantRegistryAbi, addresses.merchantRegistry);
}

export async function getLPPool() {
  return getContract(LPPoolAbi, addresses.lPPool);
}

export async function getBNPLContract() {
  return getContract(BNPLContractAbi, addresses.bNPLContract);
}

export function getAddresses() {
  return addresses;
}

/**
 * Approve USDT spending then execute an action.
 * @param {string} spenderAddress - Contract address to approve
 * @param {number|string} amount - Amount in raw USDT (6 decimals)
 * @param {Function} actionFn - Async function to call after approval
 * @param {Function} onStep - Callback for step updates (1=approving, 2=waiting, 3=executing, 4=done)
 */
export async function approveAndCall(spenderAddress, amount, actionFn, onStep) {
  try {
    onStep?.(1, 'Approve USDT in TronLink...');

    const usdt = await getUSDT();
    // Use max approval to avoid repeated approvals
    const maxApproval = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
    const approveTx = await usdt.approve(spenderAddress, maxApproval).send({
      feeLimit: 100_000_000,
      callValue: 0
    });

    onStep?.(2, 'Waiting for approval confirmation...');
    // Wait briefly for approval to propagate
    await new Promise(r => setTimeout(r, 3000));

    onStep?.(3, 'Confirm transaction in TronLink...');
    const result = await actionFn();

    onStep?.(4, 'Transaction confirmed!', result);
    return result;
  } catch (err) {
    throw err;
  }
}

/**
 * Get USDT balance for an address.
 */
export async function getUSDTBalance(address) {
  const usdt = await getUSDT();
  const balance = await usdt.balanceOf(address).call();
  return balance.toString();
}
