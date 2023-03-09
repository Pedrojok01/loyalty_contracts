// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {IRedeemable} from "../interfaces/IRedeemable.sol";
import {IExpirable} from "../interfaces/IExpirable.sol";
import {IBundles} from "../interfaces/IBundles.sol";

/**
 * @title PromotionsInterfaces
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev Stores all kinds of Promotions interfaces;
 *
 * * Include with:
 *  `PromotionsInterfaces.IVouchers example = PromotionsInterfaces.getVouchersInterface();`
 */

library PromotionsInterfaces {
    /**
     * @dev Returns the IRedeemable interface
     */
    function getIRedeemableInterface(address _promotion) internal pure returns (IRedeemable) {
        return IRedeemable(_promotion);
    }

    /**
     * @dev Returns the IExpirable interface
     */
    function getIExpirableInterface(address _promotion) internal pure returns (IExpirable) {
        return IExpirable(_promotion);
    }

    /**
     * @dev Returns the IBundles interface
     */
    function getIBundlesInterface(address _promotion) internal pure returns (IBundles) {
        return IBundles(_promotion);
    }
}
