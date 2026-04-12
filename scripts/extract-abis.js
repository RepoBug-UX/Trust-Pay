const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build', 'contracts');
const OUTPUT_DIR = path.join(__dirname, '..', 'frontend', 'src', 'contracts');

const contracts = [
  'MockUSDT',
  'TrustScore',
  'MerchantRegistry',
  'LPPool',
  'BNPLContract'
];

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const addresses = {};

for (const name of contracts) {
  const artifactPath = path.join(BUILD_DIR, `${name}.json`);
  if (!fs.existsSync(artifactPath)) {
    console.error(`Missing artifact: ${artifactPath}`);
    continue;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  // Extract ABI
  const abiPath = path.join(OUTPUT_DIR, `${name}.abi.json`);
  fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
  console.log(`Extracted ABI: ${abiPath}`);

  // Extract deployed address from networks (Nile = network_id 3)
  const networks = artifact.networks || {};
  const nileNetwork = Object.values(networks).find(n => n && n.address);
  if (nileNetwork) {
    const camelName = name.charAt(0).toLowerCase() + name.slice(1);
    addresses[camelName] = nileNetwork.address;
  }
}

// Write addresses file
const addressesPath = path.join(OUTPUT_DIR, 'addresses.json');
fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
console.log(`\nAddresses written to: ${addressesPath}`);
console.log(JSON.stringify(addresses, null, 2));
