import hre, { ethers } from "hardhat";
import fs from "fs";
import { ADMIN_ADDRESS } from "./constants";

async function main() {
  const AdminRegistry = await ethers.getContractFactory("AdminRegistry");
  const adminRegistry = await AdminRegistry.deploy(ADMIN_ADDRESS);
  await adminRegistry.waitForDeployment();

  console.log("\n");
  console.log("AdminRegistry deployed to: ", adminRegistry.address);
  console.log("\n");

  // Get AdminRegistry Contract ABI
  const abiFile = JSON.parse(
    fs.readFileSync(
      "./artifacts/contracts/subscriptions/AdminRegistry.sol/AdminRegistry.json",
      "utf8",
    ),
  );
  const abi = JSON.stringify(abiFile.abi);

  console.log("AdminRegistry ABI:");
  console.log("\n");
  console.log(abi);
  console.log("\n");

  /** WAITING:
   ************/
  await adminRegistry.deployTransaction.wait(5);

  /** VERIFICATION:
   *****************/
  // await hre.run("verify:verify", {
  //   address: adminRegistry.address,
  //   constructorArguments: [],
  // });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
