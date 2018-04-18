pragma solidity 0.4.19;


/**
 * @title Dutch auction of DGTX tokens. Sale of 100 000 000 DGTX.
 * @author SmartDec
 */
pragma solidity 0.4.19;

contract ContractBidder {
    
    function () public payable {}

    function bid(address toBid) public {
        toBid.transfer(this.balance);
    }

}