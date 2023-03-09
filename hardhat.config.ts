import dotenv from "dotenv";
dotenv.config();
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import { HardhatUserConfig } from "hardhat/config";
import "hardhat-contract-sizer";

const privateKey: string | undefined =
  process.env.NODE_ENV === "production" ? process.env.PRIVATE_KEY : process.env.PRIVATE_KEY_TEST;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10,
      },
    },
  },
  networks: {
    // Polygon networks
    polygon: {
      url: `${process.env.API_NODE_POLYGON}`,
      accounts: privateKey !== undefined ? [privateKey] : [],
      chainId: 137,
    },
    polygonMumbai: {
      url: `${process.env.API_NODE_POLYGON_MUMBAI}`,
      accounts: privateKey !== undefined ? [privateKey] : [],
      chainId: 80001,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  contractSizer: {
    runOnCompile: true,
    strict: true,
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },
};

export default config;
