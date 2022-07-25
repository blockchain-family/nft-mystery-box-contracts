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

    migration.store(Collection, 'Collection');
    console.log('Collection deployed', Collection.address);

    // deploy market
    const Market = await locklift.factory.getContract("Market");
    const response = await prompts([
        {
            type: 'text',
            name: 'tokenRoot',
            message: 'Enter tokenRoot address',
            validate: value => isValidTonAddress(value) || value === '' ? true : 'Invalid Everscale address'
        },
        {
            type: 'number',
            name: 'startDate',
            message: 'Enter start date',
            initial: new BigNumber(new Date().getTime()).div(1000).plus(30).dp(0) // start 30 second after deploy
        },
        {
            type: 'number',
            name: 'revealDate',
            message: 'Enter reveal date',
            initial: new BigNumber(new Date().getTime()).div(1000).plus(40).dp(0) // reveal 40 second after now
        }
    ]);

    await locklift.giver.deployContract({
        contract: Market,
        constructorParams: {
            _totalCount: jsonData.totalCount,
            _startDate: response.startDate,
            _revealDate: response.revealDate,
            _owner: Account.address,
            _managers: [],
            _nftPerHand: jsonData.nftPerHand,
            _collection: Collection.address,
            _provenanceHash: jsonData.provenanceHash,
            _tokenRoot: response.tokenRoot,
            _priceRule: jsonData.priceRule,
        },
        initParams: {
            nonce_: getRandomNonce(),
        },
        keyPair,
    }, locklift.utils.convertCrystal(5, 'nano'));

    migration.store(Market, 'Market');
    console.log('Market deployed', Collection.address);

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

    await Account.runTarget({
        contract: Market,
        method: 'addManager',
        params: {
            newManager: Account.address
        },
        keyPair,
        value: locklift.utils.convertCrystal(1, 'nano')
    });
    console.log('Add manager to Market: ' + Account.address);

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