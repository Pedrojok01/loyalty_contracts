import hre, { ethers } from "hardhat";
import fs from "fs";
import { nonExpirableFactoryAddress, redeemableFactoryAddress } from "./constants";

async function main() {
  const MeedProgramFactory = await ethers.getContractFactory("MeedProgramFactory");
  const meedProgramFactory = await MeedProgramFactory.deploy([
    redeemableFactoryAddress,
    nonExpirableFactoryAddress,
    redeemableFactoryAddress,
  ]);
  await meedProgramFactory.deployed();

  console.log("\n");
  console.log("MeedProgramFactory deployed to: ", meedProgramFactory.address);
  console.log("\n");

  // Get Staking Contract ABI
  const abiFile = JSON.parse(
    fs.readFileSync("./artifacts/contracts/meedProgram/MeedProgramFactory.sol/MeedProgramFactory.json", "utf8")
  );
  const abi = JSON.stringify(abiFile.abi);

  console.log("MeedProgramFactory ABI:");
  console.log("\n");
  console.log(abi);
  console.log("\n");

  /** WAITING:
   ************/
  await meedProgramFactory.deployTransaction.wait(5);

  /** VERIFICATION:
   *****************/
  // await hre.run("verify:verify", {
  //   address: meedProgramFactory.address,
  //   constructorArguments: [],
  // });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
