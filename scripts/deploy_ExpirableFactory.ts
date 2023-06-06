import hre, { ethers } from "hardhat";
import fs from "fs";

import { adminRegistryAddress, subscriptionAddress } from "./constants";

async function main() {
  const NonExpirableFactory = await ethers.getContractFactory("NonExpirableFactory");
  const nonExpirableFactory = await NonExpirableFactory.deploy(
    subscriptionAddress,
    adminRegistryAddress
  );
  await nonExpirableFactory.deployed();

  console.log("\n");
  console.log("ExpirableFactory deployed to: ", nonExpirableFactory.address);
  console.log("\n");

  // Get Staking Contract ABI
  const abiFile = JSON.parse(
    fs.readFileSync(
      "./artifacts/contracts/promotions/NonExpirableFactory.sol/NonExpirableFactory.json",
      "utf8"
    )
  );
  const abi = JSON.stringify(abiFile.abi);

  console.log("ExpirableFactory ABI:");
  console.log("\n");
  console.log(abi);
  console.log("\n");

  /** WAITING:
   ************/
  await nonExpirableFactory.deployTransaction.wait(5);

  /** VERIFICATION:
   *****************/
  // await hre.run("verify:verify", {
  //   address: nonExpirableFactory.address,
  //   constructorArguments: [subscriptionAddress],
  // });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
