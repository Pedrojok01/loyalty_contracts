import hre, { ethers } from "hardhat";
import fs from "fs";

import { subscriptions_name, subscriptions_symbol, subscriptions_uris } from "./constants";

async function main() {
  const Subscriptions = await ethers.getContractFactory("Subscriptions");
  const subscriptions = await Subscriptions.deploy(subscriptions_name, subscriptions_symbol, subscriptions_uris);
  await subscriptions.deployed();

  console.log("\n");
  console.log("Subscriptions deployed to: ", subscriptions.address);
  console.log("\n");

  // Get Staking Contract ABI
  const abiFile = JSON.parse(fs.readFileSync("./artifacts/contracts/Subscriptions.sol/Subscriptions.json", "utf8"));
  const abi = JSON.stringify(abiFile.abi);

  console.log("Subscriptions ABI:");
  console.log("\n");
  console.log(abi);
  console.log("\n");

  /** WAITING:
   ************/
  await subscriptions.deployTransaction.wait(5);

  /** VERIFICATION:
   *****************/
  await hre.run("verify:verify", {
    address: subscriptions.address,
    constructorArguments: [subscriptions_name, subscriptions_symbol, subscriptions_uris],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
