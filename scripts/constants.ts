/* Variables to edit before deployment:
 ***************************************/

import { PromiseOrValue } from "../typechain-types/common";

export const ADMIN_ADDRESS = "0xf0eeaab7153ff42849acb0e817efee09fb078c1b";

// For Factories
export const adminRegistryAddress = "0x93F13D995EF021bFa781252d127a4286e95E6aD7"; // v2 on mumbai - temp - not verified (07 juin 2023)
export const subscriptionAddress = "0x1874BDb18a2d27242B221f6e1269873406826FF0"; // v2 on mumbai - temp - not verified (07 juin 2023)

export const redeemableFactoryAddress = "0x05a14bD6d2fAb0E6Fa98832c8bF3C20770429322"; // v2 on mumbai - temp - not verified (07 juin 2023)
export const nonExpirableFactoryAddress = "0x45a63C7051854DBE47a119cc3523c951cEcB1C7D"; // v1 on mumbai - temp - not verified
export const collectibleFactoryAddress = "";
export const bundlesFactoryAddress = "";

// For Subscriptions NFTs
export const subscriptions_name = "Meed Program Owner";
export const subscriptions_symbol = "MPO";
export const subscriptions_uris: [
  PromiseOrValue<string>,
  PromiseOrValue<string>,
  PromiseOrValue<string>,
  PromiseOrValue<string>
] = ["", "", "", ""];
