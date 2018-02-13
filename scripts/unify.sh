#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function unify() {
	grep -v "^[pragma|import]" $DIR/$1 >> Unified.sol
}

echo "pragma solidity ^0.4.18;" > Unified.sol

unify ../node_modules/zeppelin-solidity/contracts/math/Math.sol
unify ../node_modules/zeppelin-solidity/contracts/math/SafeMath.sol
unify ../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol
unify ../node_modules/zeppelin-solidity/contracts/ownership/CanReclaimToken.sol
unify ../node_modules/zeppelin-solidity/contracts/ownership/Claimable.sol
unify ../node_modules/zeppelin-solidity/contracts/ownership/HasNoContracts.sol
unify ../node_modules/zeppelin-solidity/contracts/ownership/HasNoTokens.sol
unify ../node_modules/zeppelin-solidity/contracts/token/ERC20Basic.sol
unify ../node_modules/zeppelin-solidity/contracts/token/ERC20.sol
unify ../node_modules/zeppelin-solidity/contracts/token/BasicToken.sol
unify ../node_modules/zeppelin-solidity/contracts/token/StandardToken.sol
unify ../node_modules/zeppelin-solidity/contracts/token/MintableToken.sol
unify ../node_modules/zeppelin-solidity/contracts/token/SafeERC20.sol

unify ../contracts/VITToken.sol
unify ../contracts/VITTokenSale.sol
