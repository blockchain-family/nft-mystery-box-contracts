const fs = require('fs');
const {Migration, BRIDGE_CONTRACTS_PATH, EMPTY_TVM_CELL,
    getRandomNonce, TOKEN_CONTRACTS_PATH, WEVER_CONTRACTS_PATH, Constants} = require(process.cwd()+'/scripts/utils');
const BigNumber = require('bignumber.js');
BigNumber.config({EXPONENTIAL_AT: 257});
const migration = new Migration();


async function main() {
    console.log(`59-hardcode-addresses.js`);
    const WrappedTONVault = await locklift.factory.getContract('TestWeverVault');
    migration.load(WrappedTONVault, 'WEVERVault');
    const WEVERRoot = await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH);
    migration.load(WEVERRoot, 'WEVERRoot');

    const content = '' +
`pragma ton-solidity >= 0.57.0;

abstract contract Addresses {
    address constant WEVER_VAULT = address.makeAddrStd(0, 0x${WrappedTONVault.address.substr(2).toLowerCase()});
    address constant WEVER_ROOT = address.makeAddrStd(0, 0x${WEVERRoot.address.substr(2).toLowerCase()});
}`

    console.log('Replace Addresses.sol with');
    console.log(content);
    fs.writeFileSync('./contracts/Addresses.sol', content);
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });