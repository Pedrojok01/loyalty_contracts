<div align="center">

<h1><strong>Loyalty - Smart Contracts</strong></h1>

[![Stargazers](https://img.shields.io/github/stars/Pedrojok01/loyalty_contracts)](https://github.com/Pedrojok01/loyalty_contracts/stargazers)
[![Issues](https://img.shields.io/github/issues/Pedrojok01/loyalty_contracts)](https://github.com/Pedrojok01/loyalty_contracts/issues)
[![MIT License](https://img.shields.io/github/license/Pedrojok01/loyalty_contracts)](https://github.com/Pedrojok01/loyalty_contracts/blob/main/License)

</div>

## Description

Initial Smart Contracts draft associated with the Loyalty project. Not to be used for production (yet!).

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
