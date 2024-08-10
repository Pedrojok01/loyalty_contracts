require("@nomicfoundation/hardhat-chai-matchers");
import { ethers } from "hardhat";
import {
  loyaltyProgram_name,
  loyaltyProgram_symbol,
  loyaltyProgram_uri,
  duration,
  loyaltyProgram_amounts,
  subscriptions_name,
  subscriptions_symbol,
  subscriptions_uris,
} from "./constant";
import {
  deployAdminRegistry,
  deployBundlesFactory,
  deployCollectiblesFactory,
  deployLoyaltyProgramFactory,
  deployNonExpirableFactory,
  deployRedeemCodeLib,
  deployRedeemableFactory,
  deployStorage,
  deploySubscriptions,
} from "./contractDeployment";

export async function deploy() {
  const [owner, user1, user2, user3, admin] = await ethers.getSigners();

  const adminRegistry = await deployAdminRegistry(admin.address);
  const subscriptions = await deploySubscriptions(
    subscriptions_name,
    subscriptions_symbol,
    subscriptions_uris,
    adminRegistry.address,
    owner.address,
  );
  const storage = await deployStorage(adminRegistry.address, subscriptions.address, owner.address);
  const redeemCodeLib = await deployRedeemCodeLib();

  // Deploy all Promotion Factories
  const redeemableFactory = await deployRedeemableFactory(redeemCodeLib.address, storage.address);
  const nonExpirableFactory = await deployNonExpirableFactory(storage.address);
  const collectiblesFactory = await deployCollectiblesFactory(storage.address);
  const bundlesFactory = await deployBundlesFactory(storage.address);

  // Deploy the LoyaltyProgramFactory
  const loyaltyProgramFactory = await deployLoyaltyProgramFactory(
    storage.address,
    [
      redeemableFactory.address,
      nonExpirableFactory.address,
      collectiblesFactory.address,
      bundlesFactory.address,
    ],
    owner.address,
  );

  await adminRegistry.instance
    .connect(admin)
    .setLoyaltyFactoryAddress(loyaltyProgramFactory.address);

  await loyaltyProgramFactory.instance.createNewLoyaltyProgram(
    loyaltyProgram_name,
    loyaltyProgram_symbol,
    loyaltyProgram_uri,
    false,
    loyaltyProgram_amounts,
    ethers.encodeBytes32String("food"),
    ethers.encodeBytes32String("HK"),
  );

  const loyaltyProgramAddress = await loyaltyProgramFactory.instance.getLoyaltyProgramPerIndex(0);
  const loyaltyProgram = await ethers.getContractAt("LoyaltyProgram", loyaltyProgramAddress);
  const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();

  return {
    adminRegistry,
    subscriptions,
    storage,
    loyaltyProgramFactory,
    redeemableFactory,
    nonExpirableFactory,
    collectiblesFactory,
    bundlesFactory,
    loyaltyProgram,
    expirationDate,
    redeemCodeLib,
    owner,
    user1,
    user2,
    user3,
    admin,
  };
}
