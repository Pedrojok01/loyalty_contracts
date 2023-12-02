import { ethers } from "hardhat";
import {
  AdminRegistry,
  BundlesFactory,
  CollectiblesFactory,
  LoyaltyProgramFactory,
  NonExpirableFactory,
  RedeemableFactory,
  Storage,
  Subscriptions,
} from "../../typechain-types";

export const deployAdminRegistry = async (adminAddress: string) => {
  const AdminRegistry = await ethers.getContractFactory("AdminRegistry");
  const adminRegistry: AdminRegistry = await AdminRegistry.deploy(adminAddress);
  await adminRegistry.waitForDeployment();
  const adminRegistryAddress = await adminRegistry.getAddress();

  return { instance: adminRegistry, address: adminRegistryAddress };
};

export const deploySubscriptions = async (
  subscriptionsName: string,
  subscriptionsSymbol: string,
  subscriptionsUris: [string, string, string, string],
  adminRegistryAddress: string,
  ownerAddress: string,
) => {
  const Subscriptions = await ethers.getContractFactory("Subscriptions");
  const subscriptions: Subscriptions = await Subscriptions.deploy(
    subscriptionsName,
    subscriptionsSymbol,
    subscriptionsUris,
    adminRegistryAddress,
    ownerAddress,
  );
  await subscriptions.waitForDeployment();
  const subscriptionsAddress = await subscriptions.getAddress();

  return { instance: subscriptions, address: subscriptionsAddress };
};

export const deployStorage = async (
  adminRegistryAddress: string,
  subscriptionsAddress: string,
  ownerAddress: string,
) => {
  const Storage = await ethers.getContractFactory("Storage");
  const storage: Storage = await Storage.deploy(
    adminRegistryAddress,
    subscriptionsAddress,
    ownerAddress,
  );
  await storage.waitForDeployment();
  const storageAddress = await storage.getAddress();

  return { instance: storage, address: storageAddress };
};

export const deployRedeemCodeLib = async () => {
  const RedeemCodeLib = await ethers.getContractFactory("RedeemCodeLib");
  const redeemCodeLib = await RedeemCodeLib.deploy();
  await redeemCodeLib.waitForDeployment();
  const redeemCodeLibAddress = await redeemCodeLib.getAddress();

  return { instance: redeemCodeLib, address: redeemCodeLibAddress };
};

export const deployRedeemableFactory = async (
  redeemCodeLibAddress: string,
  storageAddress: string,
) => {
  const RedeemableFactory = await ethers.getContractFactory("RedeemableFactory", {
    libraries: {
      RedeemCodeLib: redeemCodeLibAddress,
    },
  });
  const redeemableFactory: RedeemableFactory = await RedeemableFactory.deploy(storageAddress);
  await redeemableFactory.waitForDeployment();
  const redeemableFactoryAddress = await redeemableFactory.getAddress();

  return { instance: redeemableFactory, address: redeemableFactoryAddress };
};

export const deployNonExpirableFactory = async (storageAddress: string) => {
  const NonExpirableFactory = await ethers.getContractFactory("NonExpirableFactory");
  const nonExpirableFactory: NonExpirableFactory = await NonExpirableFactory.deploy(storageAddress);
  await nonExpirableFactory.waitForDeployment();
  const nonExpirableFactoryAddress = await nonExpirableFactory.getAddress();

  return { instance: nonExpirableFactory, address: nonExpirableFactoryAddress };
};

export const deployCollectiblesFactory = async (storageAddress: string) => {
  const CollectiblesFactory = await ethers.getContractFactory("CollectiblesFactory");
  const collectiblesFactory: CollectiblesFactory = await CollectiblesFactory.deploy(storageAddress);
  await collectiblesFactory.waitForDeployment();
  const collectiblesFactoryAddress = await collectiblesFactory.getAddress();

  return { instance: collectiblesFactory, address: collectiblesFactoryAddress };
};

export const deployBundlesFactory = async (storageAddress: string) => {
  const BundlesFactory = await ethers.getContractFactory("BundlesFactory");
  const bundlesFactory: BundlesFactory = await BundlesFactory.deploy(storageAddress);
  await bundlesFactory.waitForDeployment();
  const bundlesFactoryAddress = await bundlesFactory.getAddress();

  return { instance: bundlesFactory, address: bundlesFactoryAddress };
};

export const deployLoyaltyProgramFactory = async (
  storageAddress: string,
  factoryAddresses: string[],
  ownerAddress: string,
) => {
  const LoyaltyProgramFactory = await ethers.getContractFactory("LoyaltyProgramFactory");
  const loyaltyProgramFactory: LoyaltyProgramFactory = await LoyaltyProgramFactory.deploy(
    storageAddress,
    factoryAddresses,
    ownerAddress,
  );
  await loyaltyProgramFactory.waitForDeployment();
  const loyaltyProgramFactoryAddress = await loyaltyProgramFactory.getAddress();

  return { instance: loyaltyProgramFactory, address: loyaltyProgramFactoryAddress };
};
