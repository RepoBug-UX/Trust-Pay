# TrustPay — Payments That Build Trust

A merchant payment platform on the TRON blockchain where every purchase builds an on-chain trust score that progressively unlocks buy-now-pay-later (BNPL) installment terms. Payment history becomes a portable, decentralized credit identity.

**Live on TRON Nile Testnet**

## Architecture

```
Customer ──► Storefront ──► MerchantRegistry ──► Merchant (paid in full)
                │                    │
                │                    ▼
                │              TrustScore (updated)
                │
                └──► BNPLContract ──► LPPool (funds merchant)
                         │               ▲
                         └───────────────┘ (repayments)
```

### Smart Contracts

| Contract | Purpose |
|----------|---------|
| `MockUSDT` | TRC-20 test token with public mint (6 decimals) |
| `TrustScore` | On-chain trust scoring engine — tracks payments, volume, defaults |
| `MerchantRegistry` | Merchant registration and direct payment processing |
| `LPPool` | Proportional-share liquidity pool funding BNPL purchases |
| `BNPLContract` | Installment plan creation, collection, and default handling |

### Trust Score Formula

```
score = (payments × 10) + (volume_USDT / 10) + (account_age_days / 2) - (defaults × 50)
```

| Tier | Score | BNPL Access |
|------|-------|-------------|
| New | 0–49 | Pay in full only |
| Building | 50–149 | 2-installment plans |
| Trusted | 150–299 | Up to 3-installment plans |
| Established | 300+ | Up to 4-installment plans |

## Three Roles

### Merchant
- Register store, add products, configure BNPL policy
- Dashboard with revenue, orders (with tx hash links), BNPL receivables
- Shareable storefront URL

### Customer
- Browse storefronts, purchase products, build trust score
- BNPL unlocked when trust score meets merchant's threshold
- Profile with score breakdown, payment history, active installments

### Liquidity Provider
- Deposit USDT into the BNPL pool
- Earn yield from installment repayments
- Track utilization rate, pool stats, and position value

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Smart Contracts**: Solidity 0.8.24, compiled with TronBox
- **Blockchain**: TRON Nile Testnet
- **Wallet**: TronLink
- **No backend** — all state from smart contracts + localStorage for UI preferences

## Setup

### Prerequisites

- Node.js 18+
- [TronLink wallet](https://www.tronlink.org/) (browser extension)
- TronLink configured for **Nile Testnet**

### Install & Build

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/Trust-Pay.git
cd Trust-Pay

# Install contract dependencies
npm install

# Compile contracts
npm run compile

# Install frontend dependencies
cd frontend
npm install

# Start development server
npm run dev
```

### Deploy Contracts to Nile

```bash
# Copy .env.example to .env and add your Nile testnet private key
cp .env.example .env

# Deploy all contracts
npm run migrate:nile

# Extract ABIs and addresses for frontend
npm run extract-abis

# (Optional) Seed demo data
npm run seed:nile
```

### Get Test Tokens

1. Get test TRX from the [Nile faucet](https://nileex.io/join/getJoinPage)
2. In the app, visit your Customer Profile and click "Get Test USDT" to mint mock USDT

## Demo Walkthrough

1. **Merchant Setup**: Connect wallet → Register store → Add products with prices → Configure BNPL settings
2. **Customer Purchase**: Switch to a different wallet → Visit storefront → Buy a product (Pay in Full) → Watch trust score increase
3. **Build Trust**: Make 4–5 purchases to reach Building tier (score 50+)
4. **BNPL Purchase**: Buy a BNPL-eligible product → Choose installments → First payment processes, merchant gets full amount from LP pool
5. **Installment Payment**: Wait 5 minutes (demo interval) → Pay installment from Customer Profile
6. **LP Dashboard**: Deposit USDT → Watch utilization rate change → See yield from repayments

## Project Structure

```
├── contracts/           # Solidity smart contracts
│   ├── MockUSDT.sol
│   ├── TrustScore.sol
│   ├── MerchantRegistry.sol
│   ├── LPPool.sol
│   └── BNPLContract.sol
├── migrations/          # TronBox deployment scripts
├── scripts/             # Utility scripts (ABI extraction, seeding)
├── frontend/            # React application
│   └── src/
│       ├── components/  # Shared UI components
│       ├── contracts/   # ABIs and deployed addresses
│       ├── hooks/       # React hooks (wallet, polling, trust score)
│       ├── pages/       # Page components
│       └── utils/       # TronLink, formatting, contract helpers
├── tronbox.js           # TronBox configuration
└── package.json         # Root package (TronBox + contracts)
```

## Testnet Info

- **Network**: TRON Nile Testnet
- **RPC**: https://nile.trongrid.io
- **Explorer**: https://nile.tronscan.org
- **Faucet**: https://nileex.io/join/getJoinPage
