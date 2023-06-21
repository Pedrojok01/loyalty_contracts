import { formatNumber } from "./helpers/utils";
import { PromiseOrValue } from "../typechain-types/common";
import { BigNumberish, utils } from "ethers";

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
    value: 500,
  },
  medium: {
    id: 1,
    value: 5000,
  },
  big: {
    id: 2,
    value: 25_000,
  },
  huge: {
    id: 3,
    value: 100_000,
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
  basic: utils.parseEther("0.05"),
  pro: utils.parseEther("0.1"),
  enterprise: utils.parseEther("0.5"),
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
export const subscriptions_name = "Meed Program Owner";
export const subscriptions_symbol = "MPO";
export const subscriptions_uris: [
  PromiseOrValue<string>,
  PromiseOrValue<string>,
  PromiseOrValue<string>,
  PromiseOrValue<string>
] = ["0", "1", "2", "3"];

// For MeedProgram NFTs
export const meedProgram_name = "Meed Program";
export const meedProgram_symbol = "MP";
export const meedProgram_uri: PromiseOrValue<string> = "ipfs://Qm.../";
export const meedProgram_amounts: [
  PromiseOrValue<BigNumberish>,
  PromiseOrValue<BigNumberish>,
  PromiseOrValue<BigNumberish>,
  PromiseOrValue<BigNumberish>
] = [100, 500, 1000, 10_000];

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
