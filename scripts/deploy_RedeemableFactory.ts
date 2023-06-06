import hre, { ethers } from "hardhat";
import fs from "fs";

import { adminRegistryAddress, subscriptionAddress } from "./constants";

async function main() {
  const RedeemCodeLib = await ethers.getContractFactory("RedeemCodeLib");
  const redeemCodeLib = await RedeemCodeLib.deploy();
  await redeemCodeLib.deployed();

  const RedeemableFactory = await ethers.getContractFactory("RedeemableFactory", {
    libraries: {
      RedeemCodeLib: redeemCodeLib.address,
    },
  });
  const redeemableFactory = await RedeemableFactory.deploy(
    subscriptionAddress,
    adminRegistryAddress
  );
  await redeemableFactory.deployed();

  console.log("\n");
  console.log("RedeemableFactory deployed to: ", redeemableFactory.address);
  console.log("\n");

  // Get Staking Contract ABI
  const abiFile = JSON.parse(
    fs.readFileSync(
      "./artifacts/contracts/promotions/RedeemableFactory.sol/RedeemableFactory.json",
      "utf8"
    )
  );
  const abi = JSON.stringify(abiFile.abi);

  console.log("RedeemableFactory ABI:");
  console.log("\n");
  console.log(abi);
  console.log("\n");

  /** WAITING:
   ************/
  await redeemableFactory.deployTransaction.wait(5);

  /** VERIFICATION:
   *****************/
  // await hre.run("verify:verify", {
  //   address: redeemCodeLib.address,
  //   constructorArguments: [],
  // });
  // await hre.run("verify:verify", {
  //   address: redeemableFactory.address,
  //   constructorArguments: [subscriptionAddress],
  // });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
