import hre, { ethers } from "hardhat";
import fs from "fs";

import { subscriptionAddress } from "./constants";

async function main() {
  const BundlesFactory = await ethers.getContractFactory("BundlesFactory");
  const bundlesFactory = await BundlesFactory.deploy(subscriptionAddress);
  await bundlesFactory.deployed();

  console.log("\n");
  console.log("BundlesFactory deployed to: ", bundlesFactory.address);
  console.log("\n");

  // Get Staking Contract ABI
  const abiFile = JSON.parse(fs.readFileSync("./artifacts/contracts/BundlesFactory.sol/BundlesFactory.json", "utf8"));
  const abi = JSON.stringify(abiFile.abi);

  console.log("BundlesFactory ABI:");
  console.log("\n");
  console.log(abi);
  console.log("\n");

  /** WAITING:
   ************/
  await bundlesFactory.deployTransaction.wait(5);

  /** VERIFICATION:
   *****************/
  await hre.run("verify:verify", {
    address: bundlesFactory.address,
    constructorArguments: [subscriptionAddress],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
