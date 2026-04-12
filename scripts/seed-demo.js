const MockUSDT = artifacts.require("MockUSDT");
const MerchantRegistry = artifacts.require("MerchantRegistry");
const LPPool = artifacts.require("LPPool");

module.exports = async function (callback) {
  try {
    const usdt = await MockUSDT.deployed();
    const registry = await MerchantRegistry.deployed();
    const lpPool = await LPPool.deployed();

    const deployer = (await tronWrap.accounts)[0];
    console.log("Deployer:", deployer);

    // 1. Mint 100k USDT to deployer
    console.log("\nMinting 100,000 USDT...");
    const mintTx = await usdt.mint(deployer, 100_000 * 1e6);
    console.log("Mint tx:", mintTx.txid || mintTx);

    // 2. Register as merchant
    console.log("\nRegistering demo merchant...");
    const regTx = await registry.registerMerchant("TrustPay Demo Store");
    console.log("Register tx:", regTx.txid || regTx);

    // 3. Deposit 50k USDT into LP pool
    console.log("\nApproving LP pool...");
    const approveTx = await usdt.approve(lpPool.address, 50_000 * 1e6);
    console.log("Approve tx:", approveTx.txid || approveTx);

    console.log("Depositing 50,000 USDT into LP pool...");
    const depositTx = await lpPool.deposit(50_000 * 1e6);
    console.log("Deposit tx:", depositTx.txid || depositTx);

    console.log("\n=== Seed Complete ===");
    console.log("Demo merchant registered, LP pool funded with 50,000 USDT");

    callback();
  } catch (err) {
    console.error(err);
    callback(err);
  }
};
