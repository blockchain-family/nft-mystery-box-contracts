const prompts = require('prompts');
const BigNumber = require('bignumber.js');
const fs = require('fs')

const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

function isValidTonAddress(address) {
    return /^(?:-1|0):[0-9a-fA-F]{64}$/.test(address);
} 

function getRandomNonce() {
    return Math.random() * 64000 | 0;
}

async function main() {
    const [keyPair] = await locklift.keys.getKeyPairs();

    // deploy account
    const Account = await locklift.factory.getAccount("Wallet");

    await locklift.giver.deployContract({
      contract: Account,
      constructorParams: {},
      initParams: {
        _randomNonce: getRandomNonce(),
      },
      keyPair,
    }, locklift.utils.convertCrystal(10, 'nano'));
  
    Account.setKeyPair(keyPair);

    migration.store(Account, 'Account');
    console.log('Account deployed', Account.address);

    // add config.json params
    const jsonData = JSON.parse(fs.readFileSync("config.json", 'utf8'));

    // deploy collection
    const Collection = await locklift.factory.getContract("Collection");
    const Nft = await locklift.factory.getContract("Nft");
    const Index = await locklift.factory.getContract("Index", 'precompiled');
    const IndexBasis = await locklift.factory.getContract("IndexBasis", 'precompiled');
  
    await locklift.giver.deployContract({
      contract: Collection,
      constructorParams: {
        codeNft: Nft.code,
        codeIndex: Index.code,
        codeIndexBasis: IndexBasis.code,
        owner: Account.address,
        managers: [],
        remainOnNft: locklift.utils.convertCrystal(0.3, 'nano'),
        json: JSON.stringify(jsonData.collectionJson),
      },
      initParams: {
        nonce_: getRandomNonce()
      },
      keyPair: Account.keyPair,
    }, locklift.utils.convertCrystal(4, 'nano'));

    // deploy market
    const Market = await locklift.factory.getContract("Market");

    const response = await prompts([
        {
            type: 'text',
            name: 'tokenRoot',
            message: 'Enter tokenRoot address',
            validate: value => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address',
            initial:  "0:a519f99bb5d6d51ef958ed24d337ad75a1c770885dcd42d51d6663f9fcdacfb2"
        },
        {
            type: 'number',
            name: 'startDate',
            message: 'Enter start date',
            initial: new BigNumber(new Date().getTime()).div(1000).dp(0)
        },
        {
            type: 'number',
            name: 'revealDate',
            message: 'Enter reveal date',
            initial: new BigNumber(new Date().getTime()).div(1000).plus(60).dp(0)
        }
    ]);


    // uint16 _totalCount,
    // uint32 _startDate,
    // uint32 _revealDate,
    // address _owner,
    // uint16 _nftPerHand,
    // address _collection,
    // string _provenanceHash,
    // address _tokenRoot,
    // mapping (uint16 => uint128) _priceRule

    let paramsTmp = {
        _totalCount: jsonData.totalCount,
        _startDate: response.startDate,
        _revealDate: response.revealDate,
        _owner: Account.address,
        _nftPerHand: jsonData.nftPerHand,
        _collection: Collection.address,
        _provenanceHash: jsonData.provenanceHash,
        _tokenRoot: response.tokenRoot,
        _priceRule: jsonData.priceRule,
    };

    console.log(paramsTmp);

    await locklift.giver.deployContract({
        contract: Market,
        constructorParams: paramsTmp,
        initParams: {
            nonce_: getRandomNonce(),
        },
        keyPair,
    }, locklift.utils.convertCrystal(5, 'nano'));
    console.log("Market deployed");

    // make the Market contract the manager of the Collection contract
    await Account.runTarget({
        contract: Collection,
        method: 'addManager',
        params: {
            newManager: Market.address
        },
        keyPair,
        value: locklift.utils.convertCrystal(1, 'nano')
    });
    console.log('Add manager to Collection: ' + Market.address);


    // load nft info data
    const nftInfoJson = JSON.parse(fs.readFileSync("nftInfoData.json", 'utf8'));

    const INCREMENT = 20;
    for (let i = 0; i < nftInfoJson.length; i += INCREMENT) {

        let elements = {};
        nftInfoJson.slice(i, i + INCREMENT).forEach((nftData,id) => {
            elements["" + (id + i)] = nftData;
        });

        await Account.runTarget({
            contract: Market,
            method: 'loadNftData',
            params: {
                _nftData: elements
            },
            keyPair,
            value: locklift.utils.convertCrystal(1, 'nano')
        })
    
    }

    // transfer ownership
    const response2 = await prompts([
        {
            type: 'text',
            name: 'newOwner',
            message: 'Transfer ownership to',
            validate: value => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'
        }
    ]);

    await Account.runTarget({
        contract: Collection,
        method: 'transferOwnership',
        params: {
            newOwner: response2.newOwner
        },
        keyPair,
        value: locklift.utils.convertCrystal(1, 'nano')
    })
        console.log('Transfer ownership Collection to: ' + response2.newOwner);


    await Account.runTarget({
        contract: Market,
        method: 'transferOwnership',
        params: {
            newOwner: response2.newOwner
        },
        keyPair,
        value: locklift.utils.convertCrystal(1, 'nano')
    })
    console.log('Transfer ownership Market to: ' + response2.newOwner);

}


main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });