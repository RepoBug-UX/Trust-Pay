const MockUSDT = artifacts.require("MockUSDT");
const TrustScore = artifacts.require("TrustScore");
const LPPool = artifacts.require("LPPool");
const MerchantRegistry = artifacts.require("MerchantRegistry");
const BNPLContract = artifacts.require("BNPLContract");

module.exports = async function (deployer) {
  // 1. Deploy MockUSDT
  await deployer.deploy(MockUSDT);
  const usdt = await MockUSDT.deployed();
  console.log("MockUSDT:", usdt.address);

  // 2. Deploy TrustScore
  await deployer.deploy(TrustScore);
  const trustScore = await TrustScore.deployed();
  console.log("TrustScore:", trustScore.address);

  // 3. Deploy LPPool
  await deployer.deploy(LPPool, usdt.address);
  const lpPool = await LPPool.deployed();
  console.log("LPPool:", lpPool.address);

  // 4. Deploy MerchantRegistry
  await deployer.deploy(MerchantRegistry, usdt.address, trustScore.address);
  const merchantRegistry = await MerchantRegistry.deployed();
  console.log("MerchantRegistry:", merchantRegistry.address);

  // 5. Deploy BNPLContract (300s = 5 min intervals for demo)
  await deployer.deploy(
    BNPLContract,
    usdt.address,
    trustScore.address,
    lpPool.address,
    merchantRegistry.address,
    300
  );
  const bnpl = await BNPLContract.deployed();
  console.log("BNPLContract:", bnpl.address);

  // 6. Wire authorizations
  console.log("Wiring authorizations...");
  await trustScore.setAuthorized(merchantRegistry.address, true);
  await trustScore.setAuthorized(bnpl.address, true);
  await lpPool.setAuthorized(bnpl.address, true);
  console.log("Authorizations set.");

  // Log all addresses for frontend config
  console.log("\n=== Deployed Contract Addresses ===");
  console.log(JSON.stringify({
    mockUSDT: usdt.address,
    trustScore: trustScore.address,
    lpPool: lpPool.address,
    merchantRegistry: merchantRegistry.address,
    bnplContract: bnpl.address
  }, null, 2));
};
