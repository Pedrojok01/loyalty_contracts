import { BigNumber, utils } from "ethers";

export const formatNumber = (num: number): BigNumber => {
  return utils.parseUnits(num.toString(), 18);
};

export const parseNumber = (num: BigNumber): number => {
  return Number(num) / 10 ** 18;
};

export const compareTimestamp = (value1: number, value2: number) => {
  const contractTimestamp = BigNumber.from(value1);
  const testTimestamp = BigNumber.from(value2);

  const threshold = 120; // Set your threshold in seconds

  if (Math.abs(Number(contractTimestamp.sub(testTimestamp))) <= threshold) {
    return true;
  } else return false;
};

export function bytes16ToString(bytes: string): string {
  let string = "";
  for (let i = 0; i < bytes.length; i += 2) {
    let byte = parseInt(bytes.slice(i, i + 2), 16);
    string += String.fromCharCode(byte);
  }
  return string.trimStart().replace(/\0/g, "");
}
