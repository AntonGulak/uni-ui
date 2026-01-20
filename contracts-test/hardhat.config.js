require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 800,
          },
          metadata: {
            bytecodeHash: "none",
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
};
