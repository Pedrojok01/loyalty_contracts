require("@nomicfoundation/hardhat-chai-matchers");
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
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
  promoType,
  plan,
  pricePerPlan,
} from "./helpers/constant";
import { LoyaltyProgram, RedeemableFactory, Subscriptions } from "../typechain-types";
import {
  deployAdminRegistry,
  deployLoyaltyProgramFactory,
  deployRedeemCodeLib,
  deployRedeemableFactory,
  deployStorage,
  deploySubscriptions,
} from "./helpers/contractDeployment";

describe("LoyaltyProgram Contract", function () {
  async function deployFixture() {
    const [owner, user1, user2, user3, admin] = await ethers.getSigners();

    const adminRegistry = await deployAdminRegistry(admin.address);
    const subscriptions = await deploySubscriptions(
      subscriptions_name,
      subscriptions_symbol,
      subscriptions_uris,
      adminRegistry.address,
      owner.address,
    );

    const storage = await deployStorage(
      adminRegistry.address,
      subscriptions.address,
      owner.address,
    );
    const redeemCodeLib = await deployRedeemCodeLib();
    const redeemableFactory = await deployRedeemableFactory(redeemCodeLib.address, storage.address);

    // Manually register the owner: revert if unauthorized
    await expect(
      adminRegistry.instance.connect(user1).registerOwner(owner.address),
    ).to.be.revertedWithCustomError(adminRegistry.instance, "AdminRegistry__NotAuthorized");

    // Manually register the owner in the AdminRegistry (since we are not using the factory)
    await adminRegistry.instance.connect(admin).registerOwner(owner.address);

    const LoyaltyProgram = await ethers.getContractFactory("LoyaltyProgram");
    const loyaltyProgram: LoyaltyProgram = await LoyaltyProgram.deploy(
      loyaltyProgram_name,
      loyaltyProgram_symbol,
      loyaltyProgram_uri,
      false,
      owner.address,
      loyaltyProgram_amounts,
      storage.address,
      [redeemableFactory.address, redeemableFactory.address, redeemableFactory.address],
    );
    await loyaltyProgram.waitForDeployment();

    return {
      subscriptions,
      adminRegistry,
      storage,
      loyaltyProgram,
      redeemableFactory,
      owner,
      user1,
      user2,
      user3,
      admin,
    };
  }

  it("should initialise the contract correctly", async () => {
    const { loyaltyProgram, owner } = await loadFixture(deployFixture);

    expect(await loyaltyProgram.owner()).to.equal(owner.address);
    expect(await loyaltyProgram.name()).to.equal(loyaltyProgram_name);
    expect(await loyaltyProgram.symbol()).to.equal(loyaltyProgram_symbol);
    expect(await loyaltyProgram.totalSupply()).to.equal(1); // first for owner
    expect(await loyaltyProgram.tokenURI(0)).to.equal(loyaltyProgram_uri);

    const tiers = await loyaltyProgram.getTierStructure();
    expect(tiers.silver).to.equal(loyaltyProgram_amounts[0]);
    expect(tiers.gold).to.equal(loyaltyProgram_amounts[1]);
    expect(tiers.platinum).to.equal(loyaltyProgram_amounts[2]);
    expect(tiers.diamond).to.equal(loyaltyProgram_amounts[3]);
  });

  it("should correctly determine whether a provided interface is supported", async () => {
    const { loyaltyProgram } = await loadFixture(deployFixture);

    const ERC165_ID = "0x01ffc9a7";
    const ERC721_ID = "0x80ac58cd";
    const ERC721Enumerable_ID = "0x780e9d63";
    const ERC721Metadata_ID = "0x5b5e139f";
    const nonExistentInterface_ID = "0x12345678";

    expect(await loyaltyProgram.supportsInterface(ERC165_ID)).to.be.true;
    expect(await loyaltyProgram.supportsInterface(ERC721_ID)).to.be.true;
    expect(await loyaltyProgram.supportsInterface(ERC721Enumerable_ID)).to.be.true;
    expect(await loyaltyProgram.supportsInterface(ERC721Metadata_ID)).to.be.true;
    expect(await loyaltyProgram.supportsInterface(nonExistentInterface_ID)).to.be.false;
  });

  it("should correctly update the admin if authorized", async () => {
    const { adminRegistry, admin, user1 } = await loadFixture(deployFixture);

    // revert if not owner or admin
    await expect(
      adminRegistry.instance.connect(user1).transferAdmin(user1.address),
    ).to.be.revertedWithCustomError(adminRegistry.instance, "AdminRegistry__NotAuthorized");

    // revert if not owner or admin
    await expect(
      adminRegistry.instance.connect(admin).transferAdmin(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(adminRegistry.instance, "AdminRegistry__AddressZero");

    // Update success
    const receipt = await adminRegistry.instance.connect(admin).transferAdmin(user1.address);
    await expect(receipt)
      .to.emit(adminRegistry.instance, "AdminTransferred")
      .withArgs(admin.address, user1.address);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    MINTING
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to become member from the program", async () => {
    const { loyaltyProgram, owner, user1, user2 } = await loadFixture(deployFixture);

    expect(await loyaltyProgram.isMember(user1.address)).to.equal(false);
    expect(await loyaltyProgram.isMember(user2.address)).to.equal(false);

    // revert if not owner or admin
    await expect(loyaltyProgram.connect(user1).mint(user1.address)).to.be.revertedWithCustomError(
      loyaltyProgram,
      "Adminable__NotAuthorized",
    );

    await loyaltyProgram.mint(user1.address);
    await loyaltyProgram.mint(user2.address);

    expect(await loyaltyProgram.tokenURI(1)).to.equal(loyaltyProgram_uri);
    expect(await loyaltyProgram.tokenURI(2)).to.equal(loyaltyProgram_uri);

    // revert if already subscribed
    await expect(loyaltyProgram.mint(user1.address)).to.be.revertedWithCustomError(
      loyaltyProgram,
      "LoyaltyProgram_AlreadyMember",
    );

    expect(await loyaltyProgram.isMember(user1.address)).to.equal(true);
    expect(await loyaltyProgram.isMember(user2.address)).to.equal(true);
  });

  it("should revert when trying to get URI of non-existant NFT", async () => {
    const { loyaltyProgram, owner, user1 } = await loadFixture(deployFixture);

    await expect(loyaltyProgram.tokenURI(1)).to.be.revertedWithCustomError(
      loyaltyProgram,
      "ERC721NonexistentToken",
    );

    await loyaltyProgram.mint(user1.address);
    expect(await loyaltyProgram.tokenURI(1)).to.equal(loyaltyProgram_uri);
  });

  it("should be possible to get the Membership given a specific token ID", async () => {
    const { subscriptions, loyaltyProgram, user1, user2, admin } = await loadFixture(deployFixture);

    await expect(loyaltyProgram.tokenURI(1)).to.be.revertedWithCustomError(
      loyaltyProgram,
      "ERC721NonexistentToken",
    );

    await subscriptions.instance.subscribe(plan.basic, false, { value: pricePerPlan.basic });

    await loyaltyProgram.connect(admin).mint(user1.address);
    await loyaltyProgram.connect(admin).mint(user2.address);

    const answer1 = await loyaltyProgram.getMembershipPerTokenID(1);
    expect(answer1.owner).to.equal(user1.address);

    const answer2 = await loyaltyProgram.getMembershipPerTokenID(2);
    expect(answer2.owner).to.equal(user2.address);
  });

  it("shouldn't be possible to use the admin mode without using the LoyaltyContractFactory", async () => {
    const { storage, redeemableFactory, user1 } = await loadFixture(deployFixture);

    const LoyaltyProgram = await ethers.getContractFactory("LoyaltyProgram");
    await expect(
      LoyaltyProgram.connect(user1).deploy(
        loyaltyProgram_name,
        loyaltyProgram_symbol,
        loyaltyProgram_uri,
        false,
        user1.address,
        loyaltyProgram_amounts,
        storage.address,
        [redeemableFactory.address, redeemableFactory.address, redeemableFactory.address],
      ),
    ).to.be.revertedWithCustomError(LoyaltyProgram, "Adminable__UserNotRegistered");
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    MEMBER UPDATE
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should initialise a new member correctly", async () => {
    const { loyaltyProgram, owner, user1 } = await loadFixture(deployFixture);

    const levelBefore = await loyaltyProgram.getMemberLevel(user1.address);
    expect(levelBefore).to.equal(0);

    await loyaltyProgram.mint(user1.address);

    const levelAfter = await loyaltyProgram.getMemberLevel(user1.address);
    expect(levelAfter).to.equal(1);
  });

  it("should update a new member correctly", async () => {
    const { loyaltyProgram, owner, user1 } = await loadFixture(deployFixture);

    await loyaltyProgram.mint(user1.address);

    const levelAfter = await loyaltyProgram.getMemberLevel(user1.address);
    expect(levelAfter).to.equal(1);

    // revert if not owner or admin
    await expect(
      loyaltyProgram.connect(user1).updateMember(user1.address, 50),
    ).to.be.revertedWithCustomError(loyaltyProgram, "Adminable__NotAuthorized");

    // revert if amount is 0
    await expect(loyaltyProgram.updateMember(user1.address, 0)).to.be.revertedWithCustomError(
      loyaltyProgram,
      "LoyaltyProgram_AmountVolumeIsZero",
    );

    // Update the member after purchase (without tier increase)
    await loyaltyProgram.updateMember(user1.address, 50);

    const userBefore = await loyaltyProgram.getMembershipPerAddress(user1.address);
    expect(userBefore.level).to.equal(1);
    expect(userBefore.buyVolume).to.equal(1);
    expect(userBefore.amountVolume).to.equal(50);

    // Update the member again and make sure his tier increased
    const receipt = await loyaltyProgram.updateMember(user1.address, 221);
    await expect(receipt).to.emit(loyaltyProgram, "LevelUpdated").withArgs(user1.address, 2);

    const userAfter = await loyaltyProgram.getMembershipPerAddress(user1.address);
    expect(userAfter.level).to.equal(2);
    expect(userAfter.buyVolume).to.equal(2);
    expect(userAfter.amountVolume).to.equal(50 + 221);

    const newlevel = await loyaltyProgram.getMemberLevel(user1.address);
    expect(newlevel).to.equal(2);
  });

  it("should automatically onboard new users during updates", async () => {
    const { loyaltyProgram, owner, user1 } = await loadFixture(deployFixture);

    const initialLevel = await loyaltyProgram.getMemberLevel(user1.address);
    expect(initialLevel).to.equal(0);
    expect(await loyaltyProgram.totalSupply()).to.equal(1);

    await loyaltyProgram.updateMember(user1.address, 98);

    const newLevel = await loyaltyProgram.getMemberLevel(user1.address);

    const userAfter = await loyaltyProgram.getMembershipPerAddress(user1.address);
    expect(userAfter.level).to.equal(1);
    expect(userAfter.buyVolume).to.equal(1);
    expect(userAfter.amountVolume).to.equal(98);

    expect(newLevel).to.equal(1);

    expect(await loyaltyProgram.totalSupply()).to.equal(2); // New NFT emitted
  });

  it("shouldn't update the level in already max level", async () => {
    const { loyaltyProgram, owner, user1 } = await loadFixture(deployFixture);

    const initialLevel = await loyaltyProgram.getMemberLevel(user1.address);
    expect(initialLevel).to.equal(0);

    // Update to level III
    await loyaltyProgram.updateMember(user1.address, 530);
    const midLevel = await loyaltyProgram.getMemberLevel(user1.address);
    expect(midLevel).to.equal(3);

    // Update to max level
    await loyaltyProgram.updateMember(user1.address, 10_849);
    const maxLevel = await loyaltyProgram.getMemberLevel(user1.address);
    expect(maxLevel).to.equal(5);

    // Shouldn't update the level anymore
    await loyaltyProgram.updateMember(user1.address, 100_000);
    const checkLevel = await loyaltyProgram.getMemberLevel(user1.address);
    expect(checkLevel).to.equal(5);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    PROMOTIONS
    ///////////////////////////////////////////////////////////////////////////////*/

  it("shouldn't be possible to add a promotion directly without using a factory", async () => {
    const { loyaltyProgram, redeemableFactory } = await loadFixture(deployFixture);

    // Check initial state
    const initialPromos = await loyaltyProgram.getAllPromotions();
    expect(initialPromos.length).to.equal(0);

    // Try to create a new promo directly
    const startDate = Math.floor(Date.now() / 1000).toString();
    const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();
    await expect(
      loyaltyProgram.addPromotion(
        redeemableFactory.address,
        promoType.discountVouchers,
        startDate,
        expirationDate,
      ),
    ).to.be.revertedWithCustomError(loyaltyProgram, "LoyaltyProgram__AuthorizedFactoryOnly");
  });

  it("should be possible to add a promotion", async () => {
    const { loyaltyProgram, owner, redeemableFactory } = await loadFixture(deployFixture);

    // Check initial state
    const initialPromos = await loyaltyProgram.getAllPromotions();
    expect(initialPromos.length).to.equal(0);

    const loyaltyProgramAddress = await loyaltyProgram.getAddress();

    // Create a new promo via the factory
    const startDate = Math.floor(Date.now() / 1000).toString();
    const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();
    const receipt = await redeemableFactory.instance.createNewPromotion(
      "ipfs://uri",
      startDate,
      expirationDate,
      loyaltyProgramAddress,
      promoType.freeProducts, // 1
    );
    await expect(receipt)
      .to.emit(redeemableFactory.instance, "NewPromotionCreated")
      .withArgs(owner.address, anyValue);

    // Check the new state  (1 promo)
    const newPromos = await loyaltyProgram.getAllPromotions();
    expect(newPromos.length).to.equal(1);

    const getPromoType = await loyaltyProgram.getPromotionType(newPromos[0].promotionAddress);
    expect(getPromoType).to.equal(1); // DiscountVouchers
  });

  it("should be possible to get all promotion per type & status & paging", async () => {
    const { loyaltyProgram, redeemableFactory, subscriptions } = await loadFixture(deployFixture);

    // Subscribe the owner to the basic plan
    await subscriptions.instance.subscribe(plan.pro, false, { value: pricePerPlan.pro });

    const loyaltyProgramAddress = await loyaltyProgram.getAddress();

    // Create a few promos via the factory
    const createFewPromos = async () => {
      const startDate = Math.floor(Date.now() / 1000).toString();
      const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();
      await redeemableFactory.instance.createNewPromotion(
        "ipfs://uri",
        startDate,
        expirationDate,
        loyaltyProgramAddress,
        promoType.discountVouchers, // 0
      );
    };

    for (let i = 0; i < 6; i++) {
      await createFewPromos();
    }

    // Check the new state  (1 promo)
    const allPromos = await loyaltyProgram.getAllPromotions();
    expect(allPromos.length).to.equal(6);

    // Get all promos per type: 6 Vouchers & 0 FreeProduct
    const vouchers = await loyaltyProgram.getAllPromotionsPerType(0);
    expect(vouchers.length).to.equal(6);
    const freeProducts = await loyaltyProgram.getAllPromotionsPerType(1);
    expect(freeProducts.length).to.equal(0);

    // Now, get all promos per status: 6 Active & 0 Expired
    const actives = await loyaltyProgram.getAllPromotionsPerStatus(true);
    expect(actives.length).to.equal(6);

    const inactives = await loyaltyProgram.getAllPromotionsPerStatus(false);
    expect(inactives.length).to.equal(0);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                        URIs
    ///////////////////////////////////////////////////////////////////////////////*/
  it("should set a new URIs and return it correctly", async () => {
    const { adminRegistry, loyaltyProgram, owner, user1, admin } = await loadFixture(deployFixture);

    expect(await loyaltyProgram.tokenURI(0)).to.equal(loyaltyProgram_uri);

    // revert if not owner or admin
    await expect(
      loyaltyProgram.connect(user1).setBaseURI("ipfs://new_uri/"),
    ).to.be.revertedWithCustomError(loyaltyProgram, "Adminable__NotAuthorized");

    await loyaltyProgram.setBaseURI("ipfs://new_uri/");
    expect(await loyaltyProgram.tokenURI(0)).to.equal("ipfs://new_uri/");

    await expect(loyaltyProgram.tokenURI(4)).to.be.revertedWithCustomError(
      loyaltyProgram,
      "ERC721NonexistentToken",
    );
  });
});
