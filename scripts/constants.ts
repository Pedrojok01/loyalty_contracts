/* Variables to edit before deployment:
 ***************************************/

import { PromiseOrValue } from "../typechain-types/common";

// For Factories
export const subscriptionAddress = "0xa92EA6d6b6276a72700DdB1C50b246C2eDbdFa06"; // v1 on mumbai - temp - not verified

export const redeemableFactoryAddress = "0xC8eC4369C237B0A3dDAa57F4f446DFdA63CB4ea9"; // v1 on mumbai - temp - not verified
export const expirableFactoryAddress = "0x853ccb4d55935a62714d2569742DCE4891FfbF57"; // v1 on mumbai - temp - not verified
export const collectibleFactoryAddress = "";
export const bundlesFactoryAddress = "";

// For Subscriptions NFTs
export const subscriptions_name = "Meed Program Owner";
export const subscriptions_symbol = "MPO";
export const subscriptions_uris: [PromiseOrValue<string>, PromiseOrValue<string>, PromiseOrValue<string>] = [
  "",
  "",
  "",
];
