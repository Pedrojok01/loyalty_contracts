require("@nomicfoundation/hardhat-chai-matchers");
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  BundlesFactory,
  NonExpirableFactory,
  MeedProgramFactory,
  RedeemableFactory,
  Subscriptions,
  CollectiblesFactory,
} from "../typechain-types";
import {
  meedProgram_name,
  meedProgram_symbol,
  meedProgram_uri,
  duration,
  meedProgram_amounts,
  subscriptions_name,
  subscriptions_symbol,
  subscriptions_uris,
  promoType,
  TIER_TRACKER,
} from "./constant";
import { utils } from "ethers";
import { bytes16ToString } from "./helpers/utils";
import { deploy } from "./helpers/deploy";

describe("Promotions Factories Contract", function () {
  async function deployFixture() {
    const {
      adminRegistry,
      subscriptions,
      meedProgramFactory,
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
      meedProgramFactory,
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
      meedProgramFactory,
      redeemableFactory,
      nonExpirableFactory,
      collectiblesFactory,
      bundlesFactory,
    } = await loadFixture(deployFixture);

    expect(await meedProgramFactory.factories(0)).to.equal(redeemableFactory.address);
    expect(await meedProgramFactory.factories(1)).to.equal(nonExpirableFactory.address);
    expect(await meedProgramFactory.factories(2)).to.equal(collectiblesFactory.address);
    expect(await meedProgramFactory.factories(3)).to.equal(bundlesFactory.address);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                CREATE NEW MEED PROGRAM
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should create a new Meed Program and store it correctly", async () => {
    const { meedProgramFactory, owner } = await loadFixture(deployFixture);

    await meedProgramFactory.createNewMeedProgram(
      meedProgram_name,
      meedProgram_symbol,
      meedProgram_uri,
      TIER_TRACKER.total_amount,
      meedProgram_amounts,
      utils.formatBytes32String("food"),
      utils.formatBytes32String("HK")
    );

    // Total amount of programs should be 2 (1 default + 1 created)
    let totalMeedPrograms = await meedProgramFactory.getTotalMeedPrograms();
    expect(Number(totalMeedPrograms)).to.equal(2);

    const receipt = await meedProgramFactory.createNewMeedProgram(
      "new_name_II",
      meedProgram_symbol,
      meedProgram_uri,
      TIER_TRACKER.purchase_times,
      meedProgram_amounts,
      utils.formatBytes32String("shoes"),
      utils.formatBytes32String("BKK")
    );

    await expect(receipt)
      .to.emit(meedProgramFactory, "NewMeedProgramCreated")
      .withArgs(owner.address, anyValue, 2, "new_name_II");

    // Total amount of programs should be 3
    totalMeedPrograms = await meedProgramFactory.getTotalMeedPrograms();
    expect(Number(totalMeedPrograms)).to.equal(3);

    // Address of program 1 should be the same as the address of the event
    const meedProgramAddress = await meedProgramFactory.getMeedProgramPerIndex(0);
    const meedIds = await meedProgramFactory.getMeedIDPerOwner(owner.address);
    const meedProgram = await meedProgramFactory.getMeedAddressPerId(meedIds[0]);
    expect(meedProgram).to.equal(meedProgramAddress);

    // Check that the meed program's name return the correct id:
    expect(await meedProgramFactory.getMeedIDPerName(meedProgram_name)).to.equal(1);
  });

  it("shouldn't be possible to create 2 programs with the same name", async () => {
    const { meedProgramFactory } = await loadFixture(deployFixture);

    // Program at array 0 (won't revert since array 0 bug)
    await meedProgramFactory.createNewMeedProgram(
      meedProgram_name,
      meedProgram_symbol,
      meedProgram_uri,
      TIER_TRACKER.total_amount,
      meedProgram_amounts,
      utils.formatBytes32String("food"),
      utils.formatBytes32String("HK")
    );

    const programAddress_0 = await meedProgramFactory.getMeedProgramPerIndex(0);
    const programId_0 = await meedProgramFactory.getMeedIDPerAddress(programAddress_0);
    expect(programId_0).to.equal(0);

    // Need to create at least 2 program for the name check to work:
    await meedProgramFactory.createNewMeedProgram(
      "new_name_II",
      meedProgram_symbol,
      meedProgram_uri,
      TIER_TRACKER.total_amount,
      meedProgram_amounts,
      utils.formatBytes32String("food"),
      utils.formatBytes32String("HK")
    );

    const programAddress_1 = await meedProgramFactory.getMeedProgramPerIndex(1);

    const programId_1 = await meedProgramFactory.getMeedIDPerAddress(programAddress_1);
    expect(programId_1).to.equal(1);

    // revert if same name
    await expect(
      meedProgramFactory.createNewMeedProgram(
        "new_name_II",
        meedProgram_symbol,
        meedProgram_uri,
        TIER_TRACKER.total_amount,
        meedProgram_amounts,
        utils.formatBytes32String("food"),
        utils.formatBytes32String("HK")
      )
    ).to.be.revertedWithCustomError(meedProgramFactory, "MeedProgramFactory_NameAlreadyTaken");
  });

  it("should add the program the the Brands struct properly", async () => {
    const { meedProgramFactory, owner } = await loadFixture(deployFixture);

    await meedProgramFactory.createNewMeedProgram(
      meedProgram_name,
      meedProgram_symbol,
      meedProgram_uri,
      TIER_TRACKER.total_amount,
      meedProgram_amounts,
      utils.formatBytes32String("food"),
      utils.formatBytes32String("HK")
    );

    const brandDetails = await meedProgramFactory.getBrandDetails(0);

    expect(bytes16ToString(brandDetails.productType)).to.equal("food");
    expect(bytes16ToString(brandDetails.location)).to.equal("HK");
    expect(brandDetails.owner).to.equal(owner.address);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                            CREATE NEW REDEEMABLE PROMO
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to create new redeemable promo via the factory", async () => {
    const { meedProgramFactory, redeemableFactory, owner } = await loadFixture(deployFixture);

    // 1. Create a new Meed Program
    await meedProgramFactory.createNewMeedProgram(
      meedProgram_name,
      meedProgram_symbol,
      meedProgram_uri,
      TIER_TRACKER.total_amount,
      meedProgram_amounts,
      utils.formatBytes32String("food"),
      utils.formatBytes32String("HK")
    );

    const meedProgramAddress = await meedProgramFactory.getMeedProgramPerIndex(0);

    // 2. Create a new promo via the redeemable factory
    const startDate = Math.floor(Date.now() / 1000).toString();
    const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();
    const receipt = await redeemableFactory.createNewPromotion(
      "ipfs://uri",
      startDate,
      expirationDate,
      meedProgramAddress,
      promoType.freeProducts
    );
    await expect(receipt)
      .to.emit(redeemableFactory, "NewPromotionCreated")
      .withArgs(owner.address, anyValue);

    const meedProgram = await ethers.getContractAt("MeedProgram", meedProgramAddress);

    // Check the new state  (1 promo)
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                            CREATE NEW NonExpirable PROMO
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to create newNonExpirable promo via the factory", async () => {
    const { meedProgramFactory, nonExpirableFactory, owner } = await loadFixture(deployFixture);

    // 1. Create a new Meed Program
    await meedProgramFactory.createNewMeedProgram(
      meedProgram_name,
      meedProgram_symbol,
      meedProgram_uri,
      TIER_TRACKER.total_amount,
      meedProgram_amounts,
      utils.formatBytes32String("food"),
      utils.formatBytes32String("HK")
    );

    const meedProgramAddress = await meedProgramFactory.getMeedProgramPerIndex(0);

    // 2. Create a new promo via the redeemable factory
    const unkownData = 0;
    const receipt = await nonExpirableFactory.createNewPromotion(
      "SuperPromo",
      "SUP",
      "ipfs://uri",
      meedProgramAddress,
      unkownData,
      promoType.vipPass
    );
    await expect(receipt)
      .to.emit(nonExpirableFactory, "NewPromotionCreated")
      .withArgs(owner.address, anyValue, "SuperPromo");

    const meedProgram = await ethers.getContractAt("MeedProgram", meedProgramAddress);

    // Check the new state  (1 promo)
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                            CREATE NEW COLLECTIBLES PROMO
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to create new collectibles promo via the factory", async () => {
    const { meedProgramFactory, collectiblesFactory, owner } = await loadFixture(deployFixture);

    const meedProgramAddress = await meedProgramFactory.getMeedProgramPerIndex(0);

    // 2. Create a new promo via the redeemable factory
    const startDate = Math.floor(Date.now() / 1000).toString();
    const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();
    const receipt = await collectiblesFactory.createNewPromotion(
      subscriptions_uris, // array of uris
      startDate,
      expirationDate,
      meedProgramAddress,
      promoType.stamps
    );
    await expect(receipt)
      .to.emit(collectiblesFactory, "NewPromotionCreated")
      .withArgs(owner.address, anyValue);

    const meedProgram = await ethers.getContractAt("MeedProgram", meedProgramAddress);

    // Check the new state  (1 promo)
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                            CREATE NEW SPECIALS PROMO
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to create new bundles promo via the factory", async () => {
    const { meedProgramFactory, bundlesFactory, owner } = await loadFixture(deployFixture);

    // 1. Create a new Meed Program
    await meedProgramFactory.createNewMeedProgram(
      meedProgram_name,
      meedProgram_symbol,
      meedProgram_uri,
      TIER_TRACKER.total_amount,
      meedProgram_amounts,
      utils.formatBytes32String("food"),
      utils.formatBytes32String("HK")
    );

    const meedProgramAddress = await meedProgramFactory.getMeedProgramPerIndex(0);

    // 2. Create a new promo via the redeemable factory
    const startDate = Math.floor(Date.now() / 1000).toString();
    const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();

    // revert if wrong type
    await expect(
      bundlesFactory.createNewPromotion(
        "SuperPromo",
        "SUP",
        "ipfs://uri",
        meedProgramAddress,
        startDate,
        expirationDate,
        10_000,
        promoType.freeProducts
      )
    ).to.be.revertedWithCustomError(bundlesFactory, "BundlesFactory_TypeNotSupported");

    const receipt = await bundlesFactory.createNewPromotion(
      "SuperPromo",
      "SUP",
      "ipfs://uri",
      meedProgramAddress,
      startDate,
      expirationDate,
      10_000,
      promoType.packs
    );
    await expect(receipt)
      .to.emit(bundlesFactory, "NewPromotionCreated")
      .withArgs(owner.address, anyValue, "SuperPromo");

    const meedProgram = await ethers.getContractAt("MeedProgram", meedProgramAddress);

    // Check the new state  (1 promo)
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                      HANDLE UPDATE/REMOVAL PROMO FACTORIES
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to add a new factory", async () => {
    const { adminRegistry, subscriptions, meedProgramFactory, user1 } = await loadFixture(
      deployFixture
    );

    const CollectibleFactory = await ethers.getContractFactory("CollectiblesFactory");
    const collectibleFactory: CollectiblesFactory = await CollectibleFactory.deploy(
      subscriptions.address,
      adminRegistry.address
    );
    await collectibleFactory.deployed();

    // revert if not owner
    await expect(
      meedProgramFactory.connect(user1).addFactory(collectibleFactory.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    const receipt = await meedProgramFactory.addFactory(collectibleFactory.address);
    await expect(receipt)
      .to.emit(meedProgramFactory, "NewFactoryAdded")
      .withArgs(collectibleFactory.address);
  });

  it("should be possible to update an existing factory", async () => {
    const { adminRegistry, subscriptions, meedProgramFactory, user1 } = await loadFixture(
      deployFixture
    );

    // 1. Deploy the new factory to be added
    const CollectiblesFactory = await ethers.getContractFactory("CollectiblesFactory");
    const collectiblesFactory: CollectiblesFactory = await CollectiblesFactory.deploy(
      subscriptions.address,
      adminRegistry.address
    );
    await collectiblesFactory.deployed();

    // 2. Add the new factory and get its factory ID
    await meedProgramFactory.addFactory(collectiblesFactory.address);

    const index = await meedProgramFactory.getFactoryId(collectiblesFactory.address);
    expect(index).to.equal(4);

    // 3. Update the factory
    const indexToReplace = 2;
    const oldFactoryAddress = await meedProgramFactory.getFactoryAddress(indexToReplace);

    // Revert if not owner
    await expect(
      meedProgramFactory.connect(user1).updateFactory(indexToReplace, collectiblesFactory.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    // Revert if wrong index
    const wrongIndex = 5;
    await expect(
      meedProgramFactory.updateFactory(wrongIndex, collectiblesFactory.address)
    ).to.be.revertedWithCustomError(meedProgramFactory, "MeedProgramFactory_InvalidIndex");

    const receipt = await meedProgramFactory.updateFactory(
      indexToReplace,
      collectiblesFactory.address
    );
    await expect(receipt)
      .to.emit(meedProgramFactory, "FactoryUpdatedAdded")
      .withArgs(oldFactoryAddress, collectiblesFactory.address);
  });

  it("should be possible to delete an existing factory", async () => {
    const { meedProgramFactory, user1 } = await loadFixture(deployFixture);

    const indexToDelete = 1;
    const factoryAddressToDelete = await meedProgramFactory.getFactoryAddress(indexToDelete);

    // Revert if not owner
    await expect(meedProgramFactory.connect(user1).removeFactory(indexToDelete)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    // Revert if wrong index
    const wrongIndex = 5;
    await expect(meedProgramFactory.removeFactory(wrongIndex)).to.be.revertedWithCustomError(
      meedProgramFactory,
      "MeedProgramFactory_InvalidIndex"
    );

    const receipt = await meedProgramFactory.removeFactory(indexToDelete);
    await expect(receipt)
      .to.emit(meedProgramFactory, "FactoryDeleted")
      .withArgs(factoryAddressToDelete, indexToDelete);
  });
});
