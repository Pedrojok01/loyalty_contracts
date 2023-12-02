require("@nomicfoundation/hardhat-chai-matchers");
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  BundlesFactory,
  NonExpirableFactory,
  LoyaltyProgramFactory,
  RedeemableFactory,
  Subscriptions,
  CollectiblesFactory,
} from "../typechain-types";
import {
  loyaltyProgram_name,
  loyaltyProgram_symbol,
  loyaltyProgram_uri,
  duration,
  loyaltyProgram_amounts,
  subscriptions_name,
  subscriptions_symbol,
  subscriptions_uris,
  promoType,
  TIER_TRACKER,
} from "./helpers/constant";
import { bytes16ToString } from "./helpers/utils";
import { deploy } from "./helpers/deploy";
import { deployCollectiblesFactory } from "./helpers/contractDeployment";

describe("Promotions Factories Contract", function () {
  async function deployFixture() {
    const {
      adminRegistry,
      subscriptions,
      storage,
      loyaltyProgramFactory,
      redeemableFactory,
      nonExpirableFactory,
      collectiblesFactory,
      bundlesFactory,
      owner,
      user1,
      user2,
      user3,
      admin,
    } = await deploy();
    return {
      subscriptions,
      adminRegistry,
      storage,
      loyaltyProgramFactory,
      redeemableFactory,
      nonExpirableFactory,
      bundlesFactory,
      collectiblesFactory,
      owner,
      user1,
      user2,
      user3,
      admin,
    };
  }

  it("should initialise all factories contract correctly", async () => {
    const {
      loyaltyProgramFactory,
      redeemableFactory,
      nonExpirableFactory,
      collectiblesFactory,
      bundlesFactory,
    } = await loadFixture(deployFixture);

    expect(await loyaltyProgramFactory.instance.factories(0)).to.equal(redeemableFactory.address);
    expect(await loyaltyProgramFactory.instance.factories(1)).to.equal(nonExpirableFactory.address);
    expect(await loyaltyProgramFactory.instance.factories(2)).to.equal(collectiblesFactory.address);
    expect(await loyaltyProgramFactory.instance.factories(3)).to.equal(bundlesFactory.address);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                CREATE NEW LOYALTY PROGRAM
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should create a new Loyalty Program and store it correctly", async () => {
    const { loyaltyProgramFactory, owner } = await loadFixture(deployFixture);

    await loyaltyProgramFactory.instance.createNewLoyaltyProgram(
      loyaltyProgram_name,
      loyaltyProgram_symbol,
      loyaltyProgram_uri,
      TIER_TRACKER.total_amount,
      loyaltyProgram_amounts,
      ethers.encodeBytes32String("food"),
      ethers.encodeBytes32String("HK"),
    );

    // Total amount of programs should be 2 (1 default + 1 created)
    let totalLoyaltyPrograms = await loyaltyProgramFactory.instance.getTotalLoyaltyPrograms();
    expect(Number(totalLoyaltyPrograms)).to.equal(2);

    const receipt = await loyaltyProgramFactory.instance.createNewLoyaltyProgram(
      "new_name_II",
      loyaltyProgram_symbol,
      loyaltyProgram_uri,
      TIER_TRACKER.purchase_times,
      loyaltyProgram_amounts,
      ethers.encodeBytes32String("shoes"),
      ethers.encodeBytes32String("BKK"),
    );

    await expect(receipt)
      .to.emit(loyaltyProgramFactory.instance, "NewLoyaltyProgramCreated")
      .withArgs(owner.address, anyValue, 2, "new_name_II");

    // Total amount of programs should be 3
    totalLoyaltyPrograms = await loyaltyProgramFactory.instance.getTotalLoyaltyPrograms();
    expect(Number(totalLoyaltyPrograms)).to.equal(3);

    // Address of program 1 should be the same as the address of the event
    const loyaltyProgramAddress = await loyaltyProgramFactory.instance.getLoyaltyProgramPerIndex(0);
    const loyaltyIds = await loyaltyProgramFactory.instance.getLoyaltyIDPerOwner(owner.address);
    const loyaltyProgram = await loyaltyProgramFactory.instance.getLoyaltyAddressPerId(
      loyaltyIds[0],
    );
    expect(loyaltyProgram).to.equal(loyaltyProgramAddress);

    // Check that the loyalty program's name return the correct id:
    expect(await loyaltyProgramFactory.instance.getLoyaltyIDPerName(loyaltyProgram_name)).to.equal(
      1,
    );
  });

  it("shouldn't be possible to create 2 programs with the same name", async () => {
    const { loyaltyProgramFactory } = await loadFixture(deployFixture);

    // Program at array 0 (won't revert since array 0 bug)
    await loyaltyProgramFactory.instance.createNewLoyaltyProgram(
      loyaltyProgram_name,
      loyaltyProgram_symbol,
      loyaltyProgram_uri,
      TIER_TRACKER.total_amount,
      loyaltyProgram_amounts,
      ethers.encodeBytes32String("food"),
      ethers.encodeBytes32String("HK"),
    );

    const programAddress_0 = await loyaltyProgramFactory.instance.getLoyaltyProgramPerIndex(0);
    const programId_0 =
      await loyaltyProgramFactory.instance.getLoyaltyIDPerAddress(programAddress_0);
    expect(programId_0).to.equal(0);

    // Need to create at least 2 program for the name check to work:
    await loyaltyProgramFactory.instance.createNewLoyaltyProgram(
      "new_name_II",
      loyaltyProgram_symbol,
      loyaltyProgram_uri,
      TIER_TRACKER.total_amount,
      loyaltyProgram_amounts,
      ethers.encodeBytes32String("food"),
      ethers.encodeBytes32String("HK"),
    );

    const programAddress_1 = await loyaltyProgramFactory.instance.getLoyaltyProgramPerIndex(1);

    const programId_1 =
      await loyaltyProgramFactory.instance.getLoyaltyIDPerAddress(programAddress_1);
    expect(programId_1).to.equal(1);

    // revert if same name
    await expect(
      loyaltyProgramFactory.instance.createNewLoyaltyProgram(
        "new_name_II",
        loyaltyProgram_symbol,
        loyaltyProgram_uri,
        TIER_TRACKER.total_amount,
        loyaltyProgram_amounts,
        ethers.encodeBytes32String("food"),
        ethers.encodeBytes32String("HK"),
      ),
    ).to.be.revertedWithCustomError(
      loyaltyProgramFactory.instance,
      "LoyaltyProgramFactory_NameAlreadyTaken",
    );
  });

  it("should add the program the the Brands struct properly", async () => {
    const { loyaltyProgramFactory, owner } = await loadFixture(deployFixture);

    await loyaltyProgramFactory.instance.createNewLoyaltyProgram(
      loyaltyProgram_name,
      loyaltyProgram_symbol,
      loyaltyProgram_uri,
      TIER_TRACKER.total_amount,
      loyaltyProgram_amounts,
      ethers.encodeBytes32String("food"),
      ethers.encodeBytes32String("HK"),
    );

    const brandDetails = await loyaltyProgramFactory.instance.getBrandDetails(0);

    expect(bytes16ToString(brandDetails.productType)).to.equal("food");
    expect(bytes16ToString(brandDetails.location)).to.equal("HK");
    expect(brandDetails.owner).to.equal(owner.address);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                      BLACKLIST
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to blacklist a program", async () => {
    const { loyaltyProgramFactory, user1 } = await loadFixture(deployFixture);

    await loyaltyProgramFactory.instance.createNewLoyaltyProgram(
      loyaltyProgram_name,
      loyaltyProgram_symbol,
      loyaltyProgram_uri,
      TIER_TRACKER.total_amount,
      loyaltyProgram_amounts,
      ethers.encodeBytes32String("food"),
      ethers.encodeBytes32String("HK"),
    );

    const loyaltyProgramAddress = await loyaltyProgramFactory.instance.getLoyaltyProgramPerIndex(0);
    const loyaltyProgram = await ethers.getContractAt("LoyaltyProgram", loyaltyProgramAddress);

    expect(await loyaltyProgramFactory.instance.isBlacklisted(loyaltyProgramAddress)).to.equal(
      false,
    );

    await expect(
      loyaltyProgramFactory.instance.connect(user1).blacklistContract(loyaltyProgramAddress),
    ).to.be.revertedWithCustomError(loyaltyProgramFactory.instance, "OwnableUnauthorizedAccount");

    const receipt = await loyaltyProgramFactory.instance.blacklistContract(loyaltyProgramAddress);
    await expect(receipt)
      .to.emit(loyaltyProgramFactory.instance, "AddedToBlacklist")
      .withArgs(loyaltyProgramAddress);

    expect(await loyaltyProgramFactory.instance.isBlacklisted(loyaltyProgramAddress)).to.equal(
      true,
    );

    await expect(
      loyaltyProgramFactory.instance.blacklistContract(loyaltyProgramAddress),
    ).to.be.revertedWithCustomError(
      loyaltyProgramFactory.instance,
      "LoyaltyProgramFactory_AlreadyBlacklisted",
    );

    await expect(
      loyaltyProgramFactory.instance.connect(user1).unblacklistContract(loyaltyProgramAddress),
    ).to.be.revertedWithCustomError(loyaltyProgramFactory.instance, "OwnableUnauthorizedAccount");

    const receipt2 =
      await loyaltyProgramFactory.instance.unblacklistContract(loyaltyProgramAddress);
    await expect(receipt2)
      .to.emit(loyaltyProgramFactory.instance, "RemovedFromblacklist")
      .withArgs(loyaltyProgramAddress);

    expect(await loyaltyProgramFactory.instance.isBlacklisted(loyaltyProgramAddress)).to.equal(
      false,
    );

    await expect(
      loyaltyProgramFactory.instance.unblacklistContract(loyaltyProgramAddress),
    ).to.be.revertedWithCustomError(
      loyaltyProgramFactory.instance,
      "LoyaltyProgramFactory_NotBlacklisted",
    );
  });

  /*///////////////////////////////////////////////////////////////////////////////
                            CREATE NEW REDEEMABLE PROMO
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to create new redeemable promo via the factory", async () => {
    const { loyaltyProgramFactory, redeemableFactory, owner } = await loadFixture(deployFixture);

    // 1. Create a new Loyalty Program
    await loyaltyProgramFactory.instance.createNewLoyaltyProgram(
      loyaltyProgram_name,
      loyaltyProgram_symbol,
      loyaltyProgram_uri,
      TIER_TRACKER.total_amount,
      loyaltyProgram_amounts,
      ethers.encodeBytes32String("food"),
      ethers.encodeBytes32String("HK"),
    );

    const loyaltyProgramAddress = await loyaltyProgramFactory.instance.getLoyaltyProgramPerIndex(0);

    // 2. Create a new promo via the redeemable factory
    const startDate = Math.floor(Date.now() / 1000).toString();
    const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();
    const receipt = await redeemableFactory.instance.createNewPromotion(
      "ipfs://uri",
      startDate,
      expirationDate,
      loyaltyProgramAddress,
      promoType.freeProducts,
    );
    await expect(receipt)
      .to.emit(redeemableFactory.instance, "NewPromotionCreated")
      .withArgs(owner.address, anyValue);

    const loyaltyProgram = await ethers.getContractAt("LoyaltyProgram", loyaltyProgramAddress);

    // Check the new state  (1 promo)
    const allPromos = await loyaltyProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                            CREATE NEW NonExpirable PROMO
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to create newNonExpirable promo via the factory", async () => {
    const { loyaltyProgramFactory, nonExpirableFactory, owner } = await loadFixture(deployFixture);

    // 1. Create a new Loyalty Program
    await loyaltyProgramFactory.instance.createNewLoyaltyProgram(
      loyaltyProgram_name,
      loyaltyProgram_symbol,
      loyaltyProgram_uri,
      TIER_TRACKER.total_amount,
      loyaltyProgram_amounts,
      ethers.encodeBytes32String("food"),
      ethers.encodeBytes32String("HK"),
    );

    const loyaltyProgramAddress = await loyaltyProgramFactory.instance.getLoyaltyProgramPerIndex(0);

    // 2. Create a new promo via the redeemable factory
    const unkownData = 0;
    const receipt = await nonExpirableFactory.instance.createNewPromotion(
      "SuperPromo",
      "SUP",
      "ipfs://uri",
      loyaltyProgramAddress,
      unkownData,
      promoType.vipPass,
    );
    await expect(receipt)
      .to.emit(nonExpirableFactory.instance, "NewPromotionCreated")
      .withArgs(owner.address, anyValue, "SuperPromo");

    const loyaltyProgram = await ethers.getContractAt("LoyaltyProgram", loyaltyProgramAddress);

    // Check the new state  (1 promo)
    const allPromos = await loyaltyProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                            CREATE NEW COLLECTIBLES PROMO
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to create new collectibles promo via the factory", async () => {
    const { loyaltyProgramFactory, collectiblesFactory, owner } = await loadFixture(deployFixture);

    const loyaltyProgramAddress = await loyaltyProgramFactory.instance.getLoyaltyProgramPerIndex(0);

    // 2. Create a new promo via the redeemable factory
    const startDate = Math.floor(Date.now() / 1000).toString();
    const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();
    const receipt = await collectiblesFactory.instance.createNewPromotion(
      subscriptions_uris, // array of uris
      startDate,
      expirationDate,
      loyaltyProgramAddress,
      promoType.stamps,
    );
    await expect(receipt)
      .to.emit(collectiblesFactory.instance, "NewPromotionCreated")
      .withArgs(owner.address, anyValue);

    const loyaltyProgram = await ethers.getContractAt("LoyaltyProgram", loyaltyProgramAddress);

    // Check the new state  (1 promo)
    const allPromos = await loyaltyProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                            CREATE NEW SPECIALS PROMO
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to create new bundles promo via the factory", async () => {
    const { loyaltyProgramFactory, bundlesFactory, owner } = await loadFixture(deployFixture);

    // 1. Create a new Loyalty Program
    await loyaltyProgramFactory.instance.createNewLoyaltyProgram(
      loyaltyProgram_name,
      loyaltyProgram_symbol,
      loyaltyProgram_uri,
      TIER_TRACKER.total_amount,
      loyaltyProgram_amounts,
      ethers.encodeBytes32String("food"),
      ethers.encodeBytes32String("HK"),
    );

    const loyaltyProgramAddress = await loyaltyProgramFactory.instance.getLoyaltyProgramPerIndex(0);

    // 2. Create a new promo via the redeemable factory
    const startDate = Math.floor(Date.now() / 1000).toString();
    const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();

    // revert if wrong type
    await expect(
      bundlesFactory.instance.createNewPromotion(
        "SuperPromo",
        "SUP",
        "ipfs://uri",
        loyaltyProgramAddress,
        startDate,
        expirationDate,
        10_000,
        promoType.freeProducts,
      ),
    ).to.be.revertedWithCustomError(bundlesFactory.instance, "BundlesFactory_TypeNotSupported");

    const receipt = await bundlesFactory.instance.createNewPromotion(
      "SuperPromo",
      "SUP",
      "ipfs://uri",
      loyaltyProgramAddress,
      startDate,
      expirationDate,
      10_000,
      promoType.packs,
    );
    await expect(receipt)
      .to.emit(bundlesFactory.instance, "NewPromotionCreated")
      .withArgs(owner.address, anyValue, "SuperPromo");

    const loyaltyProgram = await ethers.getContractAt("LoyaltyProgram", loyaltyProgramAddress);

    // Check the new state  (1 promo)
    const allPromos = await loyaltyProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                      HANDLE UPDATE/REMOVAL PROMO FACTORIES
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to add a new factory", async () => {
    const { storage, loyaltyProgramFactory, user1 } = await loadFixture(deployFixture);

    const CollectiblesFactory = await ethers.getContractFactory("CollectiblesFactory");
    const collectiblesFactory: CollectiblesFactory = await CollectiblesFactory.deploy(
      storage.address,
    );
    await collectiblesFactory.waitForDeployment();

    // revert if not owner
    await expect(
      loyaltyProgramFactory.instance
        .connect(user1)
        .addFactory(await collectiblesFactory.getAddress()),
    ).to.be.revertedWithCustomError(loyaltyProgramFactory.instance, "OwnableUnauthorizedAccount");

    const receipt = await loyaltyProgramFactory.instance.addFactory(
      await collectiblesFactory.getAddress(),
    );
    await expect(receipt)
      .to.emit(loyaltyProgramFactory.instance, "NewFactoryAdded")
      .withArgs(await collectiblesFactory.getAddress());
  });

  it("should be possible to update an existing factory", async () => {
    const { storage, loyaltyProgramFactory, user1 } = await loadFixture(deployFixture);

    // 1. Deploy the new factory to be added
    const collectiblesFactory = await deployCollectiblesFactory(storage.address);

    // 2. Add the new factory and get its factory ID
    await loyaltyProgramFactory.instance.addFactory(collectiblesFactory.address);

    const index = await loyaltyProgramFactory.instance.getFactoryId(collectiblesFactory.address);
    expect(index).to.equal(4);

    // 3. Update the factory
    const indexToReplace = 2;
    const oldFactoryAddress =
      await loyaltyProgramFactory.instance.getFactoryAddress(indexToReplace);

    // Revert if not owner
    await expect(
      loyaltyProgramFactory.instance
        .connect(user1)
        .updateFactory(indexToReplace, collectiblesFactory.address),
    ).to.be.revertedWithCustomError(loyaltyProgramFactory.instance, "OwnableUnauthorizedAccount");

    // Revert if wrong index
    const wrongIndex = 5;
    await expect(
      loyaltyProgramFactory.instance.updateFactory(wrongIndex, collectiblesFactory.address),
    ).to.be.revertedWithCustomError(
      loyaltyProgramFactory.instance,
      "LoyaltyProgramFactory_InvalidIndex",
    );

    const receipt = await loyaltyProgramFactory.instance.updateFactory(
      indexToReplace,
      collectiblesFactory.address,
    );
    await expect(receipt)
      .to.emit(loyaltyProgramFactory.instance, "FactoryUpdatedAdded")
      .withArgs(oldFactoryAddress, collectiblesFactory.address);
  });

  it("should be possible to delete an existing factory", async () => {
    const { loyaltyProgramFactory, user1 } = await loadFixture(deployFixture);

    const indexToDelete = 1;
    const factoryAddressToDelete =
      await loyaltyProgramFactory.instance.getFactoryAddress(indexToDelete);

    // Revert if not owner
    await expect(
      loyaltyProgramFactory.instance.connect(user1).removeFactory(indexToDelete),
    ).to.be.revertedWithCustomError(loyaltyProgramFactory.instance, "OwnableUnauthorizedAccount");

    // Revert if wrong index
    const wrongIndex = 5;
    await expect(
      loyaltyProgramFactory.instance.removeFactory(wrongIndex),
    ).to.be.revertedWithCustomError(
      loyaltyProgramFactory.instance,
      "LoyaltyProgramFactory_InvalidIndex",
    );

    const receipt = await loyaltyProgramFactory.instance.removeFactory(indexToDelete);
    await expect(receipt)
      .to.emit(loyaltyProgramFactory.instance, "FactoryDeleted")
      .withArgs(factoryAddressToDelete, indexToDelete);
  });
});
