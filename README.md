<div align="center">
<img src="./meed_logo.png"  width="100px" />
<br><br>

<h1><strong>Meed Loyalty - Smart Contracts</strong></h1>

[![Stargazers](https://img.shields.io/github/stars/superultra-io/Meed_smartContracts)](https://github.com/superultra-io/Meed_smartContracts/stargazers)
[![Issues](https://img.shields.io/github/issues/superultra-io/Meed_smartContracts)](https://github.com/superultra-io/Meed_smartContracts/issues)
[![MIT License](https://img.shields.io/github/license/superultra-io/Meed_smartContracts)](https://github.com/superultra-io/Meed_smartContracts/blob/main/License)

</div>

## Description

Initial Smart Contracts draft associated with the Meed Loyalty project. Not to be used for production (yet!).

## Compile:

Make sure to uncomment the following line in `hardhat.config.js`:

```js
solidity: {
    settings: {
        viaIR: true,
    },
  },
```

then run:

```shell
yarn compile
```

## Test:

```shell
yarn test
```

## Slither-analyzer:

```shell
yarn slither
```

## Coverage:

Make sure to comment the following line in `hardhat.config.js`:

```js
solidity: {
    settings: {
       // viaIR: true,
    },
  },
```

then run:

```shell
yarn cover
```

## Deploy:

```shell
yarn deploy
```

## Left To Add:

- [x] Credits features
- [ ] Limit number of promotions per tier (override exisiting promo)
- [ ] Limit airdrop size per tier
- [ ] Add interface support for Subscriptions
- [ ] Add URI per vouchers in Redeemable?
- [ ] Finish Non-Expirable & Collectibles promotions
- [ ] Add Marketing / Referral / Partnerships features (array/mapping of promo/program?)
