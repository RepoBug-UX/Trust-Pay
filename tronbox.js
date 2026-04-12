require('dotenv').config();

module.exports = {
  networks: {
    development: {
      privateKey: process.env.PRIVATE_KEY_DEV || 'da146374a75310b9666e834ee4ad0866d6f4035967bfc76217c5a495fff9f0d0',
      userFeePercentage: 100,
      feeLimit: 1000 * 1e6, // 1000 TRX
      fullHost: 'http://127.0.0.1:9090',
      network_id: '9'
    },
    nile: {
      privateKey: process.env.PRIVATE_KEY_NILE,
      userFeePercentage: 100,
      feeLimit: 1000 * 1e6, // 1000 TRX
      fullHost: 'https://nile.trongrid.io',
      network_id: '3'
    },
    mainnet: {
      privateKey: process.env.PRIVATE_KEY_MAINNET,
      userFeePercentage: 100,
      feeLimit: 1000 * 1e6,
      fullHost: 'https://api.trongrid.io',
      network_id: '1'
    }
  },
  compilers: {
    solc: {
      version: '0.8.24',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: 'cancun'
      }
    }
  }
};
