pragma solidity 0.4.19;

import "../../contracts/Auction.sol";


/**
 * @title Dutch auction of DGTX tokens. Sale of 100 000 000 DGTX.
 * @author SmartDec
 */
contract AuctionMaxUnlimited is Auction {

    uint public constant ADDRESS_MAX_BID_IN_CENTS = 10000000 * DOLLAR_DECIMALS_MULTIPLIER; // 10 000 000 USD
    /**
     * @notice Constructor for contract. Sets token and beneficiary addresses.
     * @dev Also requests oracle for new ethToCents (starts updating cycle)
     * @param _token token address - supposed to be DGTX address
     * @param _beneficiary recipient of received ethers
     */
    function AuctionMaxUnlimited(address _token, address _beneficiary) public payable Auction(_token, _beneficiary) {}

}