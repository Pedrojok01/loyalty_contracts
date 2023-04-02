import hre, { ethers } from "hardhat";
import fs from "fs";

import { subscriptionAddress } from "./constants";

async function main() {
  const ExpirableFactory = await ethers.getContractFactory("ExpirableFactory");
  const expirableFactory = await ExpirableFactory.deploy(subscriptionAddress);
  await expirableFactory.deployed();

  console.log("\n");
  console.log("ExpirableFactory deployed to: ", expirableFactory.address);
  console.log("\n");

  // Get Staking Contract ABI
  const abiFile = JSON.parse(
    fs.readFileSync("./artifacts/contracts/promotions/ExpirableFactory.sol/ExpirableFactory.json", "utf8")
  );
  const abi = JSON.stringify(abiFile.abi);

  console.log("ExpirableFactory ABI:");
  console.log("\n");
  console.log(abi);
  console.log("\n");

  /** WAITING:
   ************/
  await expirableFactory.deployTransaction.wait(5);

  /** VERIFICATION:
   *****************/
  // await hre.run("verify:verify", {
  //   address: expirableFactory.address,
  //   constructorArguments: [subscriptionAddress],
  // });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
