import { formatNumber } from "./utils";
import { BigNumberish, ethers } from "ethers";

export const plan = {
  free: 0,
  basic: 1,
  pro: 2,
  enterprise: 3,
};

export const creditsPerPlan = {
  free: 100,
  basic: 2500,
  pro: 10000,
  enterprise: 50000,
};

export const topUpFormula = {
  small: {
    id: 0,
    credits: 500,
    price: ethers.parseEther("0.02"),
  },
  medium: {
    id: 1,
    credits: 5000,
    price: ethers.parseEther("0.15"),
  },
  big: {
    id: 2,
    credits: 25_000,
    price: ethers.parseEther("0.5"),
  },
  huge: {
    id: 3,
    credits: 100_000,
    price: ethers.parseEther("1.5"),
  },
};

export const planDuration = {
  monthly: false,
  yearly: true,
};

export const promoType = {
  discountVouchers: 0,
  freeProducts: 1,
  vipPass: 2,
  badges: 3,
  stamps: 4,
  paninis: 5,
  eventTickets: 6,
  packs: 7,
};

export const voucher_type = {
  freebies: 0,
  fiatDiscount: 1,
  percentDiscount: 2,
};

export const pricePerPlan = {
  basic: ethers.parseEther("0.05"),
  pro: ethers.parseEther("0.1"),
  enterprise: ethers.parseEther("0.5"),
};

export const TIER_TRACKER = {
  purchase_times: true,
  total_amount: false,
};

export const duration = {
  month: 30 * 24 * 3600,
  year: 365 * 24 * 3600,
};

export const public_mint_price = formatNumber(0.1);

// For Promotions Factories
export const subscriptionAddress = "";

// For Subscriptions NFTs
export const subscriptions_name = "Loyalty Program Owner";
export const subscriptions_symbol = "MPO";
export const subscriptions_uris: [string, string, string, string] = ["0", "1", "2", "3"];

// For LoyaltyProgram NFTs
export const loyaltyProgram_name = "Loyalty Program";
export const loyaltyProgram_symbol = "MP";
export const loyaltyProgram_uri: string = "ipfs://Qm.../";
export const loyaltyProgram_amounts: [BigNumberish, BigNumberish, BigNumberish, BigNumberish] = [
  100n,
  500n,
  1000n,
  10_000n,
];

export const auto_rewards = [
  {
    promotion: "",
    tokenId: 0,
    levelRequired: 1,
    amountRequired: 100,
  },
  {
    promotion: "",
    tokenId: 1,
    levelRequired: 2,
    amountRequired: 200,
  },
  {
    promotion: "",
    tokenId: 2,
    levelRequired: 3,
    amountRequired: 300,
  },
  {
    promotion: "",
    tokenId: 4,
    levelRequired: 4,
    amountRequired: 400,
  },
  {
    promotion: "",
    tokenId: 4,
    levelRequired: 5,
    amountRequired: 500,
  },
];
