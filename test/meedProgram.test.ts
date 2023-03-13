require("@nomicfoundation/hardhat-chai-matchers");
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { MeedProgram, RedeemableFactory, Subscriptions } from "../typechain-types";
import {
  pricePerPlan,
  meedProgram_name,
  meedProgram_symbol,
  meedProgram_uri,
  duration,
  meedProgram_amounts,
  subscriptions_name,
  subscriptions_symbol,
  subscriptions_uris,
} from "./constant";
import { compareTimestamp, formatNumber } from "./helpers/utils";
import { PromiseOrValue } from "../typechain-types/common";
import { Overrides } from "ethers";

describe("Susbcriptions Contract", function () {
  async function deployFixture() {
    const [owner, user1, user2, user3, admin] = await ethers.getSigners();

    const Subscriptions = await ethers.getContractFactory("Subscriptions");
    const subscriptions: Subscriptions = await Subscriptions.deploy(
      subscriptions_name,
      subscriptions_symbol,
      subscriptions_uris
    );
    await subscriptions.deployed();

    const RedeemableFactory = await ethers.getContractFactory("RedeemableFactory");
    const redeemableFactory: RedeemableFactory = await RedeemableFactory.deploy(subscriptions.address);
    await redeemableFactory.deployed();

    const MeedProgram = await ethers.getContractFactory("MeedProgram");
    const meedProgram: MeedProgram = await MeedProgram.deploy(
      meedProgram_name,
      meedProgram_symbol,
      meedProgram_uri,
      false,
      owner.address,
      meedProgram_amounts,
      [redeemableFactory.address, redeemableFactory.address, redeemableFactory.address]
    );
    await meedProgram.deployed();

    return { meedProgram, redeemableFactory, owner, user1, user2, user3, admin };
  }

  it("should initialise the contract correctly", async () => {
    const { meedProgram, owner } = await loadFixture(deployFixture);

    expect(await meedProgram.owner()).to.equal(owner.address);
    expect(await meedProgram.name()).to.equal(meedProgram_name);
    expect(await meedProgram.symbol()).to.equal(meedProgram_symbol);
    expect(await meedProgram.totalSupply()).to.equal(1); // first for owner
    expect(await meedProgram.tokenURI(0)).to.equal(meedProgram_uri);

    const tiers = await meedProgram.tierStructure();
    expect(tiers.silver).to.equal(meedProgram_amounts[0]);
    expect(tiers.gold).to.equal(meedProgram_amounts[1]);
    expect(tiers.platinum).to.equal(meedProgram_amounts[2]);
    expect(tiers.diamond).to.equal(meedProgram_amounts[3]);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    MINTING
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to become member from the program", async () => {
    const { meedProgram, owner, user1, user2 } = await loadFixture(deployFixture);

    expect(await meedProgram.isMember(user1.address)).to.equal(false);
    expect(await meedProgram.isMember(user2.address)).to.equal(false);

    // revert if not owner or admin
    await expect(meedProgram.connect(user1).mint(user1.address)).to.be.revertedWithCustomError(
      meedProgram,
      "Adminable__NotAuthorized"
    );

    await meedProgram.connect(owner).mint(user1.address);
    await meedProgram.connect(owner).mint(user2.address);

    expect(await meedProgram.tokenURI(1)).to.equal(meedProgram_uri);
    expect(await meedProgram.tokenURI(2)).to.equal(meedProgram_uri);

    // revert if already subscribed
    await expect(meedProgram.connect(owner).mint(user1.address)).to.be.revertedWithCustomError(
      meedProgram,
      "MeedProgram_AlreadyMember"
    );

    expect(await meedProgram.isMember(user1.address)).to.equal(true);
    expect(await meedProgram.isMember(user2.address)).to.equal(true);
  });

  it("should revert when trying to get URI of non-existant NFT", async () => {
    const { meedProgram, owner, user1 } = await loadFixture(deployFixture);

    await expect(meedProgram.tokenURI(1)).to.be.revertedWithCustomError(meedProgram, "MeedProgram_TokenDoesNotExist");

    await meedProgram.connect(owner).mint(user1.address);
    expect(await meedProgram.tokenURI(1)).to.equal(meedProgram_uri);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    MEMBER UPDATE
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should initialise a new member correctly", async () => {
    const { meedProgram, owner, user1 } = await loadFixture(deployFixture);

    const levelBefore = await meedProgram.getMemberLevel(user1.address);
    expect(levelBefore).to.equal(0);

    await meedProgram.connect(owner).mint(user1.address);

    const levelAfter = await meedProgram.getMemberLevel(user1.address);
    expect(levelAfter).to.equal(1);
  });

  it("should update a new member correctly", async () => {
    const { meedProgram, owner, user1 } = await loadFixture(deployFixture);

    await meedProgram.connect(owner).mint(user1.address);

    const levelAfter = await meedProgram.getMemberLevel(user1.address);
    expect(levelAfter).to.equal(1);

    // revert if not owner or admin
    await expect(meedProgram.connect(user1).updateMember(user1.address, 1, 50)).to.be.revertedWithCustomError(
      meedProgram,
      "Adminable__NotAuthorized"
    );

    // Update the member after purchase (without tier increase)
    await meedProgram.connect(owner).updateMember(user1.address, 1, 50);

    const userBefore = await meedProgram.membership(user1.address);
    expect(userBefore.level).to.equal(1);
    expect(userBefore.buyVolume).to.equal(1);
    expect(userBefore.amountVolume).to.equal(50);

    // Update the member again and make sure his tier increased
    const receipt = await meedProgram.connect(owner).updateMember(user1.address, 1, 221);
    await expect(receipt).to.emit(meedProgram, "LevelUpdated").withArgs(user1.address, 2);

    const userAfter = await meedProgram.membership(user1.address);
    expect(userAfter.level).to.equal(2);
    expect(userAfter.buyVolume).to.equal(2);
    expect(userAfter.amountVolume).to.equal(50 + 221);

    const newlevel = await meedProgram.getMemberLevel(user1.address);
    expect(newlevel).to.equal(2);
  });

  it("should automatically onboard new users during updates", async () => {
    const { meedProgram, owner, user1 } = await loadFixture(deployFixture);

    const initialLevel = await meedProgram.getMemberLevel(user1.address);
    expect(initialLevel).to.equal(0);
    expect(await meedProgram.totalSupply()).to.equal(1);

    await meedProgram.connect(owner).updateMember(user1.address, 1, 98);

    const newLevel = await meedProgram.getMemberLevel(user1.address);

    const userAfter = await meedProgram.membership(user1.address);
    expect(userAfter.level).to.equal(1);
    expect(userAfter.buyVolume).to.equal(1);
    expect(userAfter.amountVolume).to.equal(98);

    expect(newLevel).to.equal(1);

    expect(await meedProgram.totalSupply()).to.equal(2); // New NFT emitted
  });

  it("shouldn't update the level in already max level", async () => {
    const { meedProgram, owner, user1 } = await loadFixture(deployFixture);

    const initialLevel = await meedProgram.getMemberLevel(user1.address);
    expect(initialLevel).to.equal(0);

    // Update to level III
    await meedProgram.connect(owner).updateMember(user1.address, 1, 530);
    const midLevel = await meedProgram.getMemberLevel(user1.address);
    expect(midLevel).to.equal(3);

    // Update to max level
    await meedProgram.connect(owner).updateMember(user1.address, 1, 10_849);
    const maxLevel = await meedProgram.getMemberLevel(user1.address);
    expect(maxLevel).to.equal(5);

    // Shouldn't update the level anymore
    await meedProgram.connect(owner).updateMember(user1.address, 1, 100_000);
    const checkLevel = await meedProgram.getMemberLevel(user1.address);
    expect(checkLevel).to.equal(5);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    PROMOTIONS
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to add a promotion", async () => {
    const { meedProgram, owner, redeemableFactory } = await loadFixture(deployFixture);

    // Check initial state
    const initialPromos = await meedProgram.getAllPromotions();
    expect(initialPromos.length).to.equal(0);

    // Create a new promo via the factory
    const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();
    const receipt = await redeemableFactory.createNewPromotion("ipfs://uri", expirationDate, meedProgram.address, 0);
    await expect(receipt).to.emit(redeemableFactory, "NewPromotionCreated").withArgs(owner.address, anyValue);

    // Check the new state  (1 promo)
    const newPromos = await meedProgram.getAllPromotions();
    expect(newPromos.length).to.equal(1);
  });

  it("should be possible to add a promotion", async () => {
    const { meedProgram, owner, user1, admin, redeemableFactory } = await loadFixture(deployFixture);

    // Create a few promos via the factory
    const createFewPromos = async () => {
      const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();
      await redeemableFactory.createNewPromotion("ipfs://uri", expirationDate, meedProgram.address, 0);
    };

    for (let i = 0; i < 6; i++) {
      await createFewPromos();
    }

    // Check the new state  (1 promo)
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(6);

    // Get all promos per type: 6 Vouchers & 0 FreeProduct
    const vouchers = await meedProgram.getAllPromotionsPerType(0);
    expect(vouchers.length).to.equal(6);
    const freeProducts = await meedProgram.getAllPromotionsPerType(1);
    expect(freeProducts.length).to.equal(0);

    // Now, get all promos per status: 6 Active & 0 Expired
    const actives = await meedProgram.getAllPromotionsPerStatus(true);
    expect(actives.length).to.equal(6);

    const inactives = await meedProgram.getAllPromotionsPerStatus(false);
    expect(inactives.length).to.equal(0);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                        URIs
    ///////////////////////////////////////////////////////////////////////////////*/
  it("should set a new URIs and return it correctly", async () => {
    const { meedProgram, owner, user1 } = await loadFixture(deployFixture);

    expect(await meedProgram.tokenURI(0)).to.equal(meedProgram_uri);

    // revert if not owner or admin
    await expect(meedProgram.connect(user1).setBaseURI("ipfs://new_uri/")).to.be.revertedWithCustomError(
      meedProgram,
      "Adminable__NotAuthorized"
    );

    // Set new URI
    await meedProgram.connect(owner).setBaseURI("ipfs://new_uri/");
    expect(await meedProgram.tokenURI(0)).to.equal("ipfs://new_uri/");

    await expect(meedProgram.tokenURI(4)).to.be.revertedWithCustomError(meedProgram, "MeedProgram_TokenDoesNotExist");
  });
});
