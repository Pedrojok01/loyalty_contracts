import hre, { ethers } from "hardhat";
import fs from "fs";
import {
  ADMIN_ADDRESS,
  adminRegistryAddress,
  nonExpirableFactoryAddress,
  redeemableFactoryAddress,
  subscriptionAddress,
} from "./constants";

async function main() {
  const LoyaltyProgramFactory = await ethers.getContractFactory("LoyaltyProgramFactory");
  const loyaltyProgramFactory = await LoyaltyProgramFactory.deploy(
    subscriptionAddress,
    adminRegistryAddress,
    [redeemableFactoryAddress],
    ADMIN_ADDRESS,
  );
  await loyaltyProgramFactory.waitForDeployment();

  console.log("\n");
  console.log("LoyaltyProgramFactory deployed to: ", loyaltyProgramFactory.address);
  console.log("\n");

  // Get Staking Contract ABI
  const abiFile = JSON.parse(
    fs.readFileSync(
      "./artifacts/contracts/loyaltyProgram/LoyaltyProgramFactory.sol/LoyaltyProgramFactory.json",
      "utf8",
    ),
  );
  const abi = JSON.stringify(abiFile.abi);

  console.log("LoyaltyProgramFactory ABI:");
  console.log("\n");
  console.log(abi);
  console.log("\n");

  /** WAITING:
   ************/
  await loyaltyProgramFactory.deployTransaction.wait(5);

  /** VERIFICATION:
   *****************/
  // await hre.run("verify:verify", {
  //   address: loyaltyProgramFactory.address,
  //   constructorArguments: [],
  // });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
