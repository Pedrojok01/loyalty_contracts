pragma solidity ^0.8.20;

import {Subscriptions} from "../contracts/subscriptions/Subscriptions.sol";

contract TestSubscriptions is Subscriptions {
  address echidna_caller = msg.sender;

  constructor() public Subscriptions("TEST", "TST", ["1", "2", "3"]) {}

  // function echidna_*() public returns (bool) {

  function echidna_constructor() public returns (bool) {
    return _baseURI.length == 3;
  }

  function echidna_getRemainingTimeAndPrice(
    address _user,
    uint256 _subscriptionId
  ) public returns (bool) {
    return getSubscription(_user, _subscriptionId);
  }
}

/*  Assertion example:
 function assert_no_free_token(uint desired_amount) public {
     require(desired_amount > 0);
     _valid)buy(desired)amount, 0);
     assert(false); // should not be reached
 }
*/
