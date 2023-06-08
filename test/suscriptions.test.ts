require("@nomicfoundation/hardhat-chai-matchers");
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Subscriptions } from "../typechain-types";
import {
  pricePerPlan,
  subscriptions_name,
  subscriptions_symbol,
  subscriptions_uris,
  duration,
  plan,
  planDuration,
} from "./constant";
import { compareTimestamp, formatNumber } from "./helpers/utils";

const tokenId = 1;

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

    return { subscriptions, owner, user1, user2, user3 };
  }

  it("should initialise the contract correctly", async () => {
    const { subscriptions, owner } = await loadFixture(deployFixture);

    expect(await subscriptions.owner()).to.equal(owner.address);
    expect(await subscriptions.name()).to.equal(subscriptions_name);
    expect(await subscriptions.symbol()).to.equal(subscriptions_symbol);
    expect(await subscriptions.totalSupply()).to.equal(0);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    SUBSCRIBE
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should not be able to susbribe if wrong price or already member", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    // revert if wrong price for a month
    await expect(
      subscriptions.connect(user1).subscribe(plan.basic, planDuration.monthly, {
        from: user1.address,
        value: pricePerPlan.pro,
      })
    ).to.be.revertedWithCustomError(subscriptions, "Subscriptions__IncorrectPrice");

    // revert if wrong price for a year
    const toPayForAYear = await subscriptions.calculateSubscriptionPrice(
      plan.basic,
      planDuration.monthly
    );
    await expect(
      subscriptions.connect(user1).subscribe(plan.enterprise, planDuration.yearly, {
        from: user1.address,
        value: toPayForAYear,
      })
    ).to.be.revertedWithCustomError(subscriptions, "Subscriptions__IncorrectPrice");

    const toPayForAMonth = await subscriptions.calculateSubscriptionPrice(
      plan.basic,
      planDuration.monthly
    );
    await subscriptions
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: toPayForAMonth });

    // revert since already subscribed
    await expect(
      subscriptions.connect(user1).subscribe(plan.basic, planDuration.monthly, {
        from: user1.address,
        value: pricePerPlan.basic,
      })
    ).to.be.revertedWithCustomError(subscriptions, "Subscriptions__UserAlreadyOwnsSubscription");
  });

  it("should be possible to susbscibe for a year with the correct amount", async () => {
    const { subscriptions, user1, user2, user3 } = await loadFixture(deployFixture);

    const basicForAYear = await subscriptions.calculateSubscriptionPrice(
      plan.basic,
      planDuration.yearly
    );
    const proForAYear = await subscriptions.calculateSubscriptionPrice(
      plan.pro,
      planDuration.yearly
    );
    const enterpriseForAYear = await subscriptions.calculateSubscriptionPrice(
      plan.enterprise,
      planDuration.yearly
    );

    const receipt = await subscriptions
      .connect(user1)
      .subscribe(plan.basic, planDuration.yearly, { value: basicForAYear });
    await expect(receipt)
      .to.emit(subscriptions, "SubscribedOrExtended")
      .withArgs(user1.address, 1, anyValue);

    // try empty function for coverage
    expect(await subscriptions.cancelSubscription(tokenId)).to.equal(false);

    const receipt2 = await subscriptions
      .connect(user2)
      .subscribe(plan.pro, planDuration.yearly, { value: proForAYear });
    await expect(receipt2)
      .to.emit(subscriptions, "SubscribedOrExtended")
      .withArgs(user2.address, 2, anyValue);

    const receipt3 = await subscriptions
      .connect(user3)
      .subscribe(plan.enterprise, planDuration.yearly, { value: enterpriseForAYear });
    await expect(receipt3)
      .to.emit(subscriptions, "SubscribedOrExtended")
      .withArgs(user3.address, 3, anyValue);
  });

  it("should set the correct expiration time when subscribing", async () => {
    const { subscriptions, user1, user2 } = await loadFixture(deployFixture);

    await subscriptions
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });
    const month = Math.floor(Date.now() / 1000 + duration.month);
    const expirationOneMonth = await subscriptions.expiresAt(1); // tokenId = 1

    expect(compareTimestamp(Number(expirationOneMonth), month)).to.equal(true);

    const toPayForAYear = await subscriptions.calculateSubscriptionPrice(
      plan.pro,
      planDuration.yearly
    );
    await subscriptions
      .connect(user2)
      .subscribe(plan.pro, planDuration.yearly, { value: toPayForAYear });
    const expirationOneYear = await subscriptions.expiresAt(2); // tokenId = 2
    const year = Math.floor(Date.now() / 1000 + duration.year);

    expect(compareTimestamp(Number(expirationOneYear), year)).to.equal(true);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    CHANGE SUBSCRIPTION PLAN
    ///////////////////////////////////////////////////////////////////////////////*/

  it("shouldn't be possible to changeSubscriptionPlan without being an ongoing subscriber", async () => {
    const { subscriptions, user1, user2 } = await loadFixture(deployFixture);

    await subscriptions
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId, plan.enterprise);

    // revert since user isn't a subscriber
    await expect(
      subscriptions
        .connect(user2)
        .changeSubscriptionPlan(tokenId, plan.enterprise, { value: toPayMore.toString() })
    ).to.be.revertedWithCustomError(subscriptions, "Subscriptions__SubscriptionExpired");

    await subscriptions
      .connect(user2)
      .subscribe(plan.pro, planDuration.monthly, { value: pricePerPlan.pro });

    // revert since user do not own this subscription
    await expect(
      subscriptions
        .connect(user2)
        .changeSubscriptionPlan(tokenId, plan.enterprise, { value: toPayMore.toString() })
    ).to.be.revertedWithCustomError(subscriptions, "Subscriptions__TokenNotOwned");

    // revert since user can't downgrade subscription
    await expect(
      subscriptions
        .connect(user2)
        .changeSubscriptionPlan(2, plan.basic, { value: toPayMore.toString() })
    ).to.be.revertedWithCustomError(subscriptions, "Subscriptions__CannotDowngradeTier");

    await time.increase(duration.month * 2);

    const [remaining, toPay] = await subscriptions.getRemainingTimeAndPrice(
      tokenId,
      plan.enterprise
    );
    expect(remaining).to.equal(0);
    expect(toPay).to.equal(0);

    await expect(
      subscriptions
        .connect(user1)
        .changeSubscriptionPlan(1, plan.enterprise, { value: toPayMore.toString() })
    ).to.be.revertedWithCustomError(subscriptions, "Subscriptions__SubscriptionExpired");
  });

  it("should be possible to changeSubscriptionPlan", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    // Get the price for BASIC plan for a year:
    const toPay = await subscriptions.calculateSubscriptionPrice(plan.basic, planDuration.yearly);
    expect(toPay).to.equal(pricePerPlan.basic.mul(10));
    // Then subscribe:
    await subscriptions.connect(user1).subscribe(plan.basic, planDuration.yearly, { value: toPay });

    // Moves forward 3 months, then upgrade to ENTERPRISE plan:
    await time.increase(duration.month * 3);
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId, plan.enterprise);
    // 4.125 ETH needed to upgrade to enterprise for the 9 months left
    expect(toPayMore.toString()).to.equal("4125000000000000000");

    // revert if wrong price
    await expect(
      subscriptions
        .connect(user1)
        .changeSubscriptionPlan(tokenId, plan.enterprise, { value: toPayMore.sub(85000) })
    ).to.be.revertedWithCustomError(subscriptions, "Subscriptions__IncorrectPrice");

    const receipt = await subscriptions
      .connect(user1)
      .changeSubscriptionPlan(1, plan.enterprise, { value: toPayMore.toString() });
    await expect(receipt)
      .to.emit(subscriptions, "SubscriptionUpgraded")
      .withArgs(user1.address, tokenId, anyValue, toPayMore);
  });

  it("shouldn't be possible to renewSubscription without already being a subscriber", async () => {
    const { subscriptions, user1, user2 } = await loadFixture(deployFixture);

    await expect(
      subscriptions.connect(user1).renewSubscription(tokenId, plan.pro, planDuration.yearly, {
        value: pricePerPlan.pro.mul(10),
      })
    ).to.be.revertedWith("ERC721: invalid token ID");

    await subscriptions
      .connect(user1)
      .subscribe(plan.pro, planDuration.yearly, { value: pricePerPlan.pro.mul(10) });

    await expect(
      subscriptions.connect(user2).renewSubscription(tokenId, plan.pro, planDuration.yearly, {
        value: pricePerPlan.pro.mul(10),
      })
    ).to.be.revertedWithCustomError(subscriptions, "Subscriptions__TokenNotOwned");
  });

  it("Make sur calculated price is correct in weird upgrade scenario", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    await subscriptions
      .connect(user1)
      .subscribe(plan.basic, planDuration.yearly, { value: pricePerPlan.basic.mul(10) });
    await subscriptions.connect(user1).renewSubscription(tokenId, plan.basic, planDuration.yearly, {
      value: pricePerPlan.basic.mul(10),
    });
    await subscriptions
      .connect(user1)
      .renewSubscription(tokenId, plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    // Try cheating:
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId, plan.enterprise);
    // The price is slighlty different because it is now calculated per day
    expect(toPayMore.toString()).to.equal("11400000000000000000");
    await subscriptions
      .connect(user1)
      .changeSubscriptionPlan(tokenId, plan.enterprise, { value: toPayMore });
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    RENEW SUBSCRIPTION
    ///////////////////////////////////////////////////////////////////////////////*/

  it("shouldn't be possible to renewSubscription if subscription ongoing with different plan", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    await subscriptions
      .connect(user1)
      .subscribe(plan.pro, planDuration.yearly, { value: pricePerPlan.pro.mul(10) });

    // Move forward 6 months before renewal
    await time.increase(duration.month * 6);

    await expect(
      subscriptions
        .connect(user1)
        .renewSubscription(tokenId, plan.enterprise, planDuration.yearly, {
          value: pricePerPlan.enterprise.mul(10),
        })
    ).to.be.revertedWithCustomError(subscriptions, "Subscriptions__UpgradePlanBeforeRenewal");

    // Move forward again 10 more months (subscription is now expired)
    await time.increase(duration.month * 10);

    const receipt = await subscriptions
      .connect(user1)
      .renewSubscription(tokenId, plan.enterprise, planDuration.yearly, {
        value: pricePerPlan.enterprise.mul(10),
      });
    await expect(receipt)
      .to.emit(subscriptions, "SubscribedOrExtended")
      .withArgs(user1.address, 1, anyValue);
  });

  it("should be possible to renewSubscription for a year and add time accordingly", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    await subscriptions
      .connect(user1)
      .subscribe(plan.pro, planDuration.yearly, { value: pricePerPlan.pro.mul(10) });
    // Move forward 10 months before renewal
    await time.increase(duration.month * 10);

    expect(await subscriptions.isRenewable(1)).to.equal(true);
    expect(await subscriptions.isRenewable(2)).to.equal(false);
    const initialExpiration = await subscriptions.expiresAt(1); // tokenId = 1

    const receipt = await subscriptions
      .connect(user1)
      .renewSubscription(tokenId, plan.pro, planDuration.yearly, {
        value: pricePerPlan.pro.mul(10),
      });
    await expect(receipt)
      .to.emit(subscriptions, "SubscribedOrExtended")
      .withArgs(user1.address, 1, anyValue);

    const user = await subscriptions.getSubscriber(user1.address);
    const newExpiration = Math.floor(Number(initialExpiration) + duration.year);

    expect(compareTimestamp(Number(user.expiration), newExpiration)).to.equal(true);

    // Move forward 30 months before renewal
    await time.increase(duration.month * 30);

    const receipt2 = await subscriptions
      .connect(user1)
      .renewSubscription(tokenId, plan.pro, planDuration.yearly, {
        value: pricePerPlan.pro.mul(10),
      });
    await expect(receipt2)
      .to.emit(subscriptions, "SubscribedOrExtended")
      .withArgs(user1.address, 1, anyValue);

    // New expiration should be 40 months from now + 1 year + now
    const newTime = Math.floor(Date.now() / 1000 + duration.year + duration.month * 40);
    const expiration = await subscriptions.expiresAt(1); // tokenId = 1

    expect(compareTimestamp(Number(expiration), newTime)).to.equal(true);

    // Move forward 20 months before renewal
    await time.increase(duration.month * 20);

    const receipt3 = await subscriptions
      .connect(user1)
      .renewSubscription(tokenId, plan.enterprise, planDuration.monthly, {
        value: pricePerPlan.enterprise,
      });
    await expect(receipt3)
      .to.emit(subscriptions, "SubscribedOrExtended")
      .withArgs(user1.address, 1, anyValue);
  });

  it("should be possible to renewSubscription for a month and add time accordingly", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    await subscriptions
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });
    // Move forward 15 days before renewal
    await time.increase(duration.month / 2);

    const initialExpiration = await subscriptions.expiresAt(1); // 1 month + 1 year (13 months)

    const receipt = await subscriptions
      .connect(user1)
      .renewSubscription(tokenId, plan.basic, planDuration.yearly, {
        value: pricePerPlan.basic.mul(10),
      });
    await expect(receipt)
      .to.emit(subscriptions, "SubscribedOrExtended")
      .withArgs(user1.address, 1, anyValue);

    const user = await subscriptions.getSubscriber(user1.address);

    const newExpiration = Math.floor(Number(initialExpiration) + duration.year);
    expect(Number(user.expiration)).to.be.closeTo(newExpiration, 60);
    expect(compareTimestamp(Number(user.expiration), newExpiration)).to.equal(true);

    // Move forward 20 months before renewal
    await time.increase(duration.month * 20);

    const receipt2 = await subscriptions
      .connect(user1)
      .renewSubscription(tokenId, plan.enterprise, planDuration.yearly, {
        value: pricePerPlan.enterprise.mul(10),
      });
    await expect(receipt2)
      .to.emit(subscriptions, "SubscribedOrExtended")
      .withArgs(user1.address, 1, anyValue);

    // New expiration should be 40 months from now + 1 year + now
    const newTime = Math.floor(Date.now() / 1000 + duration.year + duration.month * 20.5);
    const expiration = await subscriptions.expiresAt(1); // tokenId = 1

    expect(Number(expiration)).to.be.closeTo(newTime, 100);
    expect(compareTimestamp(Number(expiration), newTime)).to.equal(true);

    const receipt3 = await subscriptions
      .connect(user1)
      .renewSubscription(tokenId, plan.enterprise, planDuration.monthly, {
        value: pricePerPlan.enterprise,
      });
    await expect(receipt3)
      .to.emit(subscriptions, "SubscribedOrExtended")
      .withArgs(user1.address, 1, anyValue);

    const newTime2 = Math.floor(Date.now() / 1000 + duration.year + duration.month * 21.5);
    const expiration2 = await subscriptions.expiresAt(1); // tokenId = 1
    expect(compareTimestamp(Number(expiration2), newTime2)).to.equal(true);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    WITHDRAW ETH
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to withdraw ETH if owner only", async () => {
    const { subscriptions, owner, user1, user2, user3 } = await loadFixture(deployFixture);

    await subscriptions
      .connect(user1)
      .subscribe(plan.basic, planDuration.yearly, { value: pricePerPlan.basic.mul(10) });
    await subscriptions
      .connect(user2)
      .subscribe(plan.pro, planDuration.monthly, { value: pricePerPlan.pro });
    await subscriptions
      .connect(user3)
      .subscribe(plan.enterprise, planDuration.yearly, { value: pricePerPlan.enterprise.mul(10) });

    // const balance = await subscriptions.getBalance();
    const contractBalanceBefore = await ethers.provider.getBalance(subscriptions.address);
    expect(Number(contractBalanceBefore)).to.equal(
      Number(pricePerPlan.basic.add(pricePerPlan.enterprise).mul(10).add(pricePerPlan.pro))
    );

    await expect(subscriptions.connect(user1).withdrawEther(user1.address)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    await expect(
      subscriptions.withdrawEther(ethers.constants.AddressZero)
    ).to.be.revertedWithCustomError(subscriptions, "Subscriptions__WithdrawToAddressZero");

    const balanceOwnerBefore = await ethers.provider.getBalance(owner.address);

    await subscriptions.withdrawEther(owner.address);

    const contractBalanceAfter = await ethers.provider.getBalance(subscriptions.address);
    expect(Number(contractBalanceAfter)).to.equal(0);

    const balanceOwnerAfter = await ethers.provider.getBalance(owner.address);
    expect((Number(balanceOwnerAfter) / 10 ** 18).toFixed(2)).to.equal(
      (Number(balanceOwnerBefore.add(contractBalanceBefore)) / 10 ** 18).toFixed(2)
    );
  });

  it("should be possible to edit all price plan individually", async () => {
    const { subscriptions, owner, user1 } = await loadFixture(deployFixture);

    await expect(
      subscriptions.connect(user1).editPlanPrice(plan.basic, formatNumber(1))
    ).to.be.revertedWith("Ownable: caller is not the owner");

    const receipt = await subscriptions.editPlanPrice(plan.basic, formatNumber(1));
    await expect(receipt)
      .to.emit(subscriptions, "PriceUpdated")
      .withArgs(plan.basic, formatNumber(1));
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    DYNAMIC URIs
    ///////////////////////////////////////////////////////////////////////////////*/
  it("should mint an NFT with the correct URI based on chose plan", async () => {
    const { subscriptions, user1, user2, user3 } = await loadFixture(deployFixture);

    // Mint 3 NFTs with different plans
    const toPay = await subscriptions.calculateSubscriptionPrice(plan.basic, planDuration.monthly);
    expect(
      await subscriptions.calculateSubscriptionPrice(plan.basic, planDuration.monthly)
    ).to.equal(pricePerPlan.basic);
    await subscriptions
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: toPay });

    await subscriptions
      .connect(user2)
      .subscribe(plan.pro, planDuration.monthly, { value: pricePerPlan.pro });
    await subscriptions
      .connect(user3)
      .subscribe(plan.enterprise, planDuration.monthly, { value: pricePerPlan.enterprise });

    const total = await subscriptions.totalSupply();
    expect(total).to.equal(3);

    expect(await subscriptions.tokenURI(1)).to.equal(subscriptions_uris[0]);
    expect(await subscriptions.tokenURI(2)).to.equal(subscriptions_uris[1]);
    expect(await subscriptions.tokenURI(3)).to.equal(subscriptions_uris[2]);

    await expect(subscriptions.tokenURI(4)).to.be.revertedWithCustomError(
      subscriptions,
      "Subscriptions__NoSubscriptionFound"
    );
  });
});
