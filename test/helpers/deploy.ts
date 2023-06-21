require("@nomicfoundation/hardhat-chai-matchers");
import { ethers } from "hardhat";
import {
  MeedProgramFactory,
  RedeemableFactory,
  Subscriptions,
  NonExpirableFactory,
  CollectiblesFactory,
  BundlesFactory,
} from "../../typechain-types";
import {
  meedProgram_name,
  meedProgram_symbol,
  meedProgram_uri,
  duration,
  meedProgram_amounts,
  subscriptions_name,
  subscriptions_symbol,
  subscriptions_uris,
} from "../constant";
import { utils } from "ethers";

export async function deploy() {
  const [owner, user1, user2, user3, admin] = await ethers.getSigners();

  const AdminRegistry = await ethers.getContractFactory("AdminRegistry");
  const adminRegistry = await AdminRegistry.deploy(admin.address);
  await adminRegistry.deployed();

  const Subscriptions = await ethers.getContractFactory("Subscriptions");
  const subscriptions: Subscriptions = await Subscriptions.deploy(
    subscriptions_name,
    subscriptions_symbol,
    subscriptions_uris,
    adminRegistry.address
  );
  await subscriptions.deployed();

  const RedeemCodeLib = await ethers.getContractFactory("RedeemCodeLib");
  const redeemCodeLib = await RedeemCodeLib.deploy();
  await redeemCodeLib.deployed();

  // Deploy all Promotion Factories
  const RedeemableFactory = await ethers.getContractFactory("RedeemableFactory", {
    libraries: {
      RedeemCodeLib: redeemCodeLib.address,
    },
  });
  const redeemableFactory: RedeemableFactory = await RedeemableFactory.deploy(
    subscriptions.address,
    adminRegistry.address
  );
  await redeemableFactory.deployed();

  const NonExpirableFactory = await ethers.getContractFactory("NonExpirableFactory");
  const nonExpirableFactory: NonExpirableFactory = await NonExpirableFactory.deploy(
    subscriptions.address,
    adminRegistry.address
  );
  await nonExpirableFactory.deployed();

  const CollectiblesFactory = await ethers.getContractFactory("CollectiblesFactory");
  const collectiblesFactory: CollectiblesFactory = await CollectiblesFactory.deploy(
    subscriptions.address,
    adminRegistry.address
  );
  await collectiblesFactory.deployed();

  const BundlesFactory = await ethers.getContractFactory("BundlesFactory");
  const bundlesFactory: BundlesFactory = await BundlesFactory.deploy(
    subscriptions.address,
    adminRegistry.address
  );
  await bundlesFactory.deployed();

  // Deploy the MeedProgramFactory
  const MeedProgramFactory = await ethers.getContractFactory("MeedProgramFactory");
  const meedProgramFactory: MeedProgramFactory = await MeedProgramFactory.deploy(
    subscriptions.address,
    adminRegistry.address,
    [
      redeemableFactory.address,
      nonExpirableFactory.address,
      collectiblesFactory.address,
      bundlesFactory.address,
    ]
  );
  await meedProgramFactory.deployed();

  await adminRegistry.connect(admin).setMeedFactoryAddress(meedProgramFactory.address);

  await meedProgramFactory.createNewMeedProgram(
    meedProgram_name,
    meedProgram_symbol,
    meedProgram_uri,
    false,
    meedProgram_amounts,
    utils.formatBytes32String("food"),
    utils.formatBytes32String("HK")
  );

  const meedProgramAddress = await meedProgramFactory.getMeedProgramPerIndex(0);
  const meedProgram = await ethers.getContractAt("MeedProgram", meedProgramAddress);
  const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();

  return {
    adminRegistry,
    subscriptions,
    meedProgramFactory,
    redeemableFactory,
    nonExpirableFactory,
    collectiblesFactory,
    bundlesFactory,
    meedProgram,
    expirationDate,
    owner,
    user1,
    user2,
    user3,
    admin,
  };
}
