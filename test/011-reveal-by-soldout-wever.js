const logger = require('mocha-logger');
const {expect} = require('chai');
const fs = require('fs');
const prompts = require('prompts');
const BigNumber = require('bignumber.js');

const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();
const logTx = (tx) => logger.success(`Transaction: ${tx.transaction.id}`);

async function sleep(ms) {
    ms = ms === undefined ? 1000 : ms;
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomNonce() {
    return Math.random() * 64000 | 0;
}

const TOKEN_CONTRACTS_PATH = 'node_modules/tip3/build';
const EMPTY_TVM_CELL = 'te6ccgEBAQEAAgAAAA==';

let keyPairs;
let userTokenWallet;
let user2TokenWallet;
let marketTokenWallet;
let ownerTokenWallet;
let Market;
let AccountOwner;
let AccountUser;
let AccountUser2;
let TokenRoot;
let Collection;
let jsonData;
let nftInfoData;
let airDrop;
let whiteList;
let startDate;
let revealDate;


async function getMarketParams() {

    let params = {
        nftPerHand:  (await Market.call({ method: 'nftPerHand', params: {}})).toNumber(),
        totalCount: (await Market.call({ method: 'totalCount', params: {}})).toNumber(),
        soldCount:  (await Market.call({ method: 'soldCount', params: {}})).toNumber(),
        mintCount:  (await Market.call({ method: 'mintCount', params: {}})).toNumber(),
        collection:  await Market.call({ method: 'collection', params: {}}),
        startDate:  (await Market.call({ method: 'startDate', params: {}})).toNumber(),
        revealDate: (await Market.call({ method: 'revealDate', params: {}})).toNumber(),
        totalRaised:  new BigNumber((await Market.call({ method: 'totalRaised', params: {}})).toString()).shiftedBy(-9).toNumber(),
        totalWithdraw: new BigNumber((await Market.call({ method: 'totalWithdraw', params: {}})).toString()).shiftedBy(-9).toNumber(),
        provenanceHash:  await Market.call({ method: 'provenanceHash', params: {}}),
        startIndex:  await Market.call({ method: 'startIndex', params: {}})== null ? await Market.call({ method: 'startIndex', params: {}}) : await Market.call({ method: 'startIndex', params: {}}),
        tokenRoot:  await Market.call({ method: 'tokenRoot', params: {}}),
        tokenWallet:  await Market.call({ method: 'tokenWallet', params: {}}),
        nftData:  await Market.call({ method: 'nftData', params: {}}),
        priceRule:  await Market.call({ method: 'priceRule', params: {}}),
        soldNfts:  await Market.call({ method: 'soldNfts', params: {}}),
        claimNft:  await Market.call({ method: 'claimNft', params: {}}),
        state:  (await Market.call({ method: 'state', params: {}})).toNumber(),
        airDrop: await Market.call({ method: 'airDrop', params: {}}),
        whiteList: await Market.call({ method: 'whiteList', params: {}}),
        soldCountDiscount:(await Market.call({ method: 'soldCountDiscount', params: {}})).toNumber(),
        soldCountAirdrop: (await Market.call({ method: 'soldCountAirdrop', params: {}})).toNumber(),
        commonSoldCount: (await Market.call({ method: 'commonSoldCount', params: {}})).toNumber(),
        discountPrice:  new BigNumber((await Market.call({ method: 'discountPrice', params: {}})).toString()).shiftedBy(-9).toNumber(),
    };
    return params;
};

async function  getEverBalanceFor(user) {
    let balance = 0;
    await locklift.ton.getBalance(user.address).then(e => balance = e.toString()).catch(e => { /* ignored */ });
    return new BigNumber(balance).shiftedBy(-9).toNumber();
}

async function getBalanceFor(wallet) {
    let balance = 0;
    await wallet.call({method: 'balance', params: {}}).then(n => {
        balance = new BigNumber(n).shiftedBy(-9).toNumber();
    }).catch(e => {/*ignored*/});
    return balance;
};

describe("Market contract reveal by soldCount", async function() {
    this.timeout(10000000);
    before("Deploy contracts", async function() {

        keyPairs = await locklift.keys.getKeyPairs();
        
        // deploy account for owner
        AccountOwner = await locklift.factory.getAccount("Wallet");
    
        await locklift.giver.deployContract({
            contract: AccountOwner,
            constructorParams: {},
            initParams: {
                _randomNonce: getRandomNonce(),
            },
            keyPair: keyPairs[0],
        }, locklift.utils.convertCrystal(1300, 'nano'));
        
        AccountOwner.setKeyPair(keyPairs[0]);

        migration.store(AccountOwner, 'Owner account');
        logger.success('Owner account deployed', AccountOwner.address);

        // deploy account for users
        AccountUser = await locklift.factory.getAccount("Wallet");
    
        await locklift.giver.deployContract({
            contract: AccountUser,
            constructorParams: {},
            initParams: {
                _randomNonce: getRandomNonce(),
            },
            keyPair: keyPairs[1],
        }, locklift.utils.convertCrystal(1150, 'nano'));
        
        AccountUser.setKeyPair(keyPairs[1]);

        migration.store(AccountUser, 'User account');
        logger.success('User account deployed', AccountUser.address);
        
        // deploy account for users2
        AccountUser2 = await locklift.factory.getAccount("Wallet");
    
        await locklift.giver.deployContract({
            contract: AccountUser2,
            constructorParams: {},
            initParams: {
                _randomNonce: getRandomNonce(),
            },
            keyPair: keyPairs[2],
        }, locklift.utils.convertCrystal(1000, 'nano'));
        
        AccountUser2.setKeyPair(keyPairs[2]);

        migration.store(AccountUser2, 'User2 account');
        logger.success('User2 account deployed', AccountUser2.address);

        TokenRoot = await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH);
        migration.load(TokenRoot, 'WEVERRoot');
        console.log(TokenRoot.address);

        // load json data
        jsonData = JSON.parse(fs.readFileSync("config.json", 'utf8'));
        nftInfoData = JSON.parse(fs.readFileSync("nftInfoData.json", 'utf8'));
        airDrop = JSON.parse(fs.readFileSync("airdrop.json", 'utf8'));
        whiteList = JSON.parse(fs.readFileSync("whitelist.json", 'utf8'));
        whiteList[AccountUser2.address.toString()] = "1"

        // deploy collection
        Collection = await locklift.factory.getContract("Collection");
        const Nft = await locklift.factory.getContract("Nft");
        const Index = await locklift.factory.getContract("Index", 'precompiled');
        const IndexBasis = await locklift.factory.getContract("IndexBasis", 'precompiled');
    
        await locklift.giver.deployContract({
        contract: Collection,
        constructorParams: {
            codeNft: Nft.code,
            codeIndex: Index.code,
            codeIndexBasis: IndexBasis.code,
            owner: AccountOwner.address,
            managers: [],
            remainOnNft: locklift.utils.convertCrystal(0.3, 'nano'),
            json: JSON.stringify(jsonData.collectionJson),
        },
        initParams: {
            nonce_: getRandomNonce()
        },
        keyPair: keyPairs[0],
        }, locklift.utils.convertCrystal(4, 'nano'));

        migration.store(Collection, 'Collection');
        logger.success('Collection contract deployed', Collection.address);

        // deploy market
        Market = await locklift.factory.getContract("Market");
        startDate = new BigNumber(new Date().getTime()).div(1000).plus(120).dp(0); // start 30 second after deploy
        revealDate = new BigNumber(new Date().getTime()).div(1000).plus(340).dp(0); // reveal 2 hour after now
        
        await locklift.giver.deployContract({
            contract: Market,
            constructorParams: {
                _totalCount: jsonData.totalCount,
                _startDate: startDate,
                _revealDate: revealDate,
                _owner: AccountOwner.address,
                _managers: [],
                _nftPerHand: jsonData.nftPerHand,
                _collection: Collection.address,
                _provenanceHash: jsonData.provenanceHash,
                _tokenRoot: TokenRoot.address,
                _priceRule: jsonData.priceRule,
                _airDrop: airDrop,
                _whiteList: whiteList,
                _discountPrice: jsonData.discountPrice
            },
            initParams: {
                nonce_: getRandomNonce(),
            },
            keyPair: keyPairs[0],
        }, locklift.utils.convertCrystal(5, 'nano'));

        migration.store(Market, 'Market');
        logger.success('Market contract deployed', Market.address);

        // get address token wallet Market
        const marketTokenAddress = await TokenRoot.call({
            method: 'walletOf', 
            params: {
              walletOwner: Market.address
            }
        });
        marketTokenWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        marketTokenWallet.setAddress(marketTokenAddress);

        //get address token wallet owner
        const ownerTokenAddress = await TokenRoot.call({
            method: 'walletOf', 
            params: {
              walletOwner: AccountOwner.address
            }
        });
        ownerTokenWallet  = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        ownerTokenWallet.setAddress(ownerTokenAddress);

        const weverVault = await locklift.factory.getContract('TestWeverVault');
        migration.load(weverVault, 'WEVERVault');

        // wrap ever for user
        tx = await AccountUser.run({
            method: 'sendTransaction',
            params: {
                dest: weverVault.address,
                value: locklift.utils.convertCrystal(1001, 'nano'),
                bounce: false,
                flags: 1,
                payload: EMPTY_TVM_CELL
            },
            keyPair: keyPairs[1]
        });

        // logTx(tx);

        //get address token wallet user
        const userTokenAddress = await TokenRoot.call({
            method: 'walletOf', params: {
                walletOwner: AccountUser.address
            }
        });
        userTokenWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        userTokenWallet.setAddress(userTokenAddress);

        // wrap ever for user2
        tx = await AccountUser2.run({
            method: 'sendTransaction',
            params: {
                dest: weverVault.address,
                value: locklift.utils.convertCrystal(631, 'nano'),
                bounce: false,
                flags: 1,
                payload: EMPTY_TVM_CELL
            },
            keyPair: keyPairs[2]
        });

        // logTx(tx);

        //get address token wallet user2
        const user2TokenAddress = await TokenRoot.call({
            method: 'walletOf',
            params: {
              walletOwner: AccountUser2.address
            }
        });

        user2TokenWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        user2TokenWallet.setAddress(user2TokenAddress);

        // add managers for Collection and Market
        await AccountOwner.runTarget({
            contract: Collection,
            method: 'addManager',
            params: {
                newManager: Market.address
            },
            keyPair: keyPairs[0],
            value: locklift.utils.convertCrystal(1, 'nano')
        });
        logger.success('Add manager to Collection: ' + Market.address);

        await AccountOwner.runTarget({
            contract: Market,
            method: 'addManager',
            params: {
                newManager: AccountOwner.address
            },
            keyPair: keyPairs[0],
            value: locklift.utils.convertCrystal(1, 'nano')
        });
        logger.success('Add manager to Market: ' + AccountOwner.address);

    });

    it("Check deployed Market parameters", async function() {

        let marketParams  = await getMarketParams();
        console.log('Params: ', marketParams);

        expect(marketParams.nftPerHand).to.be.equal(jsonData.nftPerHand, 'Wrong nftPerHand');
        expect(marketParams.totalCount).to.be.equal(jsonData.totalCount, 'Wrong totalCount');
        expect(marketParams.soldCount).to.be.equal(0, 'Wrong soldCount');
        expect(marketParams.mintCount).to.be.equal(0, 'Wrong mintCount');
        expect(marketParams.startDate).to.be.equal(startDate.toNumber(), 'Wrong startDate');
        expect(marketParams.revealDate).to.be.equal(revealDate.toNumber(), 'Wrong revealDate');
        expect(marketParams.totalRaised).to.be.equal(0, 'Wrong totalRaised');
        expect(marketParams.totalWithdraw).to.be.equal(0, 'Wrong totalWithdraw');
        expect(marketParams.provenanceHash).to.be.equal(jsonData.provenanceHash, 'Wrong provenanceHash');
        expect(marketParams.startIndex).to.be.null;
        expect(marketParams.tokenRoot).to.be.equal(TokenRoot.address, 'Wrong tokenRoot');
        expect(marketParams.tokenWallet).to.be.equal(marketTokenWallet.address, 'Wrong tokenWallet');
        expect(marketParams.nftData).to.eql({}, 'Wrong nftData');
        expect(marketParams.priceRule).to.include.key("0");
        expect(marketParams.priceRule).to.deep.equal(jsonData.priceRule, 'Wrong priceRule');
        expect(marketParams.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ]
                              }, 'Wrong soldNfts');
        expect(marketParams.claimNft).to.eql({}, 'Wrong claimNft');
        expect(marketParams.state).to.be.equal(0, 'Wrong state');
        expect(marketParams.airDrop).to.eql(airDrop, 'Wrong airDrop');
        expect(marketParams.whiteList).to.eql(whiteList, 'Wrong whiteList');
        expect(marketParams.soldCountDiscount).to.be.equal(0, 'Wrong soldCountDiscount');
        expect(marketParams.soldCountAirdrop).to.be.equal(
            Object.values(airDrop).reduce((a, c) => Number(a) + Number(c), 0), 'Wrong soldCountAirdrop');
        expect(marketParams.commonSoldCount).to.be.equal(4, 'Wrong soldCount');
        expect(marketParams.discountPrice).to.be.equal(7, 'Wrong soldCount');

        console.log('Wever balance user', await getBalanceFor(userTokenWallet));
        console.log('Wever balance user2', await getBalanceFor(user2TokenWallet));
        console.log('Wever balance Market', await getBalanceFor(marketTokenWallet));
        // console.log('ownerTokenWallet', await getBalanceFor(ownerTokenWallet));
        console.log('Ever balance user2', await getEverBalanceFor(AccountUser2));
        console.log('Ever balance user', await getEverBalanceFor(AccountUser));
    });

    it('Check deployed Collection params', async function () {
        let jsonCollection = JSON.parse(await Collection.call({ method: 'getJson', params: {}}));
        expect(jsonCollection).to.eql(jsonData.collectionJson, 'Wrong jsonCollection');
        let totalSupply = (await Collection.call({ method: 'totalSupply', params: {}})).toNumber();
        let totalMinted = (await Collection.call({ method: 'totalMinted', params: {}})).toNumber();
        expect(totalSupply).to.equal(totalMinted, 'Wrong totalSupply');
        expect(totalMinted).to.equal(0, 'Wrong totalMinted');
    });

    it("Check correct load nftData to Market", async function() {
        const INCREMENT = 20;
        for (let i = 0; i < nftInfoData.length; i += INCREMENT) {
    
            let elements = {};
            nftInfoData.slice(i, i + INCREMENT).forEach((nftData,id) => {
                elements["" + (id + i)] = nftData;
            });
    
            await AccountOwner.runTarget({
                contract: Market,
                method: 'loadNftData',
                params: {
                    _nftData: elements
                },
                keyPair: keyPairs[0],
                value: locklift.utils.convertCrystal(1, 'nano')
            });
        }
        
        let marketParams  = await getMarketParams();
        expect(Object.getOwnPropertyNames(marketParams.nftData).length).to.be.equal(nftInfoData.length, 'Wrong length nftData');
        expect(Object.getOwnPropertyNames(marketParams.nftData).length).to.be.equal(marketParams.totalCount, 'Wrong length nftData');
    });

    it("Check buy before start date with discount user2", async function() {
        let marketParams  = await getMarketParams();

        expect(marketParams.state).to.be.equal(0, 'Wrong status');
        expect(marketParams.soldCount).to.be.equal(0, 'Wrong soldCount');
        expect(marketParams.totalRaised).to.be.equal(0, 'Wrong totalRaised');
        expect(marketParams.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ]
                              }, 'Wrong soldNfts');
        expect(marketParams.soldCountDiscount).to.be.equal(0, 'Wrong soldCountDiscount');
        expect(marketParams.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParams.commonSoldCount).to.be.equal(4, 'Wrong soldCount');
        expect(await getEverBalanceFor(AccountUser2)).to.be.within(369, 370, 'Wrong balance user2');
        expect(await getBalanceFor(user2TokenWallet)).to.be.equal(630, 'Wrong user2 balance');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(0, 'Wrong market balance');

        console.log(await getEverBalanceFor(AccountUser2));

        const payload = await Market.call({ method: 'buildPayload', params: { id: 100, toNftNumber:  9, user: AccountUser2.address}});
    
        const tx = await AccountUser2.runTarget({
            contract: user2TokenWallet,
            method: 'transfer',
            params: {
                amount: new BigNumber(40).shiftedBy(9).toString(),
                recipient: Market.address,
                deployWalletValue: 0,
                remainingGasTo: AccountUser2.address,
                payload: payload,
                notify: true
            },
            keyPair: keyPairs[2],
            value: locklift.utils.convertCrystal(4, 'nano')
        });

        logTx(tx);
        console.log(await getEverBalanceFor(AccountUser2));
        let marketParamsAfter  = await getMarketParams();
      
        expect(marketParamsAfter.soldCount).to.be.equal(0, 'Wrong soldCount');
        expect(marketParamsAfter.totalRaised).to.be.equal(0, 'Wrong totalRaised');
        // expect(await getBalanceFor(userTokenWallet)).to.be.equal(1000, 'Wrong user balance');
        expect(await getBalanceFor(user2TokenWallet)).to.be.equal(590, 'Wrong user2 balance');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(0, 'Wrong market balance');
        expect(marketParamsAfter.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ]
                              }, 'Wrong soldNfts');
        expect(marketParamsAfter.soldCountDiscount).to.be.equal(0, 'Wrong soldCountDiscount');
        expect(marketParamsAfter.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParamsAfter.commonSoldCount).to.be.equal(4, 'Wrong commonSoldCount');
        expect(await getEverBalanceFor(AccountUser2)).to.be.closeTo(409, 0.6,'Wrong balance user2');
        expect(await getEverBalanceFor(AccountUser2)).to.be.within(409, 410, 'Wrong balance user2');
    });

    it("Check buy user ", async function() {
        await sleep(120000); //waiting for start date

        let marketParams  = await getMarketParams();

        expect(marketParams.state).to.be.equal(1, 'Wrong status');
        expect(marketParams.soldCount).to.be.equal(0, 'Wrong soldCount');
        expect(marketParams.totalRaised).to.be.equal(0, 'Wrong totalRaised');
        expect(marketParams.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ]
                              }, 'Wrong soldNfts');
        expect(marketParams.soldCountDiscount).to.be.equal(0, 'Wrong soldCountDiscount');
        expect(marketParams.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParams.commonSoldCount).to.be.equal(4, 'Wrong soldCount');
        expect(await getBalanceFor(userTokenWallet)).to.be.equal(1000, 'Wrong user balance');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(0, 'Wrong market balance');
        expect(await getEverBalanceFor(AccountUser)).to.be.closeTo(150, 0.5,'Wrong balance user');
        expect(await getEverBalanceFor(AccountUser)).to.be.within(149, 150, 'Wrong balance user');

        console.log(await getEverBalanceFor(AccountUser));

        const payload = await Market.call({ method: 'buildPayload', params: { id: 101, toNftNumber:  10, user: AccountUser.address}});

        let tx = await AccountUser.runTarget({
            contract: userTokenWallet,
            method: 'transfer',
            params: {
                amount: new BigNumber(40).shiftedBy(9).toString(),
                recipient: Market.address,
                deployWalletValue: 0,
                remainingGasTo: AccountUser.address,
                payload: payload,
                notify: true
            },
            keyPair: keyPairs[1],
            value: locklift.utils.convertCrystal(6, 'nano')
        });

        logTx(tx);
        console.log(await getEverBalanceFor(AccountUser));
        let marketParamsAfter  = await getMarketParams();

        expect(marketParamsAfter.soldCount).to.be.equal(4, 'Wrong soldCount');
        expect(marketParamsAfter.totalRaised).to.be.equal(40, 'Wrong totalRaised');
        expect(await getBalanceFor(userTokenWallet)).to.be.equal(960, 'Wrong user balance ');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(40, 'Wrong market balance ');
        expect(marketParamsAfter.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
             [AccountUser.address]: [ '4', '5', '6', '7' ]
          }, 'Wrong soldNfts');
        expect(marketParamsAfter.soldCountDiscount).to.be.equal(0, 'Wrong soldCountDiscount');
        expect(marketParamsAfter.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParamsAfter.commonSoldCount).to.be.equal(8, 'Wrong soldCount');
        expect(await getEverBalanceFor(AccountUser)).to.be.closeTo(150,0.5,'Wrong balance user');
        expect(await getEverBalanceFor(AccountUser)).to.be.within(149, 150, 'Wrong balance user');
    });

    it("Check buy user2 with discount (1 discount, 5 by general price)", async function() {
        let marketParams  = await getMarketParams();

        expect(marketParams.state).to.be.equal(1, 'Wrong status');
        expect(marketParams.totalRaised).to.be.equal(40, 'Wrong totalRaised');
        expect(marketParams.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
             [AccountUser.address]: [ '4', '5', '6', '7' ]
          }, 'Wrong soldNfts');
        expect(marketParams.soldCount).to.be.equal(4, 'Wrong soldCount');
        expect(marketParams.soldCountDiscount).to.be.equal(0, 'Wrong soldCountDiscount');
        expect(marketParams.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParams.commonSoldCount).to.be.equal(8, 'Wrong soldCount');
        expect(marketParams.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
        expect(await getBalanceFor(user2TokenWallet)).to.be.equal(590, 'Wrong user balance');
        expect(await getEverBalanceFor(AccountUser2)).to.be.closeTo(409, 0.6,'Wrong balance user2');
        expect(await getEverBalanceFor(AccountUser2)).to.be.within(409, 410, 'Wrong balance user2');
        expect(marketParams.discountPrice).to.be.equal(7, 'Wrong countDiscount');
        expect((await Market.call({ method: 'discountOf', params: {user: AccountUser2.address}})).toNumber()).to.be.equal(1, 'Wrong countDiscount');

        const payload = await Market.call({ method: 'buildPayload', params: { id: 200, toNftNumber:  10, user: AccountUser2.address}});

        await AccountUser2.runTarget({
            contract: user2TokenWallet,
            method: 'transfer',
            params: {
                amount: new BigNumber(57).shiftedBy(9).toString(),
                recipient: Market.address,
                deployWalletValue: 0,
                remainingGasTo: AccountUser2.address,
                payload: payload,
                notify: true
            },
            keyPair: keyPairs[2],
            value: locklift.utils.convertCrystal(6, 'nano')
        });
        console.log(await getEverBalanceFor(AccountUser2))
        let marketParamsAfter  = await getMarketParams();
        expect((await Market.call({ method: 'discountOf', params: {user: AccountUser2.address}})).toNumber()).to.be.equal(0, 'Wrong countDiscount');
        expect(marketParamsAfter.soldCount).to.be.equal(9, 'Wrong soldCount');
        expect(marketParamsAfter.soldCountDiscount).to.be.equal(1, 'Wrong soldCountDiscount');
        expect(marketParamsAfter.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParamsAfter.commonSoldCount).to.be.equal(14, 'Wrong soldCount');
        expect(marketParamsAfter.totalRaised).to.be.equal(97, 'Wrong totalRaised');
        expect(await getBalanceFor(user2TokenWallet)).to.be.equal(533, 'Wrong user balance');
        expect(await getEverBalanceFor(AccountUser2)).to.be.closeTo(409, 0.5,'Wrong balance user2');
        expect(await getEverBalanceFor(AccountUser2)).to.be.within(409, 410, 'Wrong balance user2');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(97, 'Wrong market balance ');
        expect(marketParamsAfter.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
        expect(marketParamsAfter.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
            [AccountUser.address]: [ '4', '5', '6', '7' ],
            [AccountUser2.address]: [ '8', '9', '10', '11' ,'12', '13']
          }, 'Wrong soldNfts');
    });

    it("Check buy on the border for user", async function() {
        let marketParams  = await getMarketParams();

        expect(marketParams.state).to.be.equal(1, 'Wrong status');
        expect(marketParams.soldCount).to.be.equal(9, 'Wrong soldCount');
        expect(marketParams.soldCountDiscount).to.be.equal(1, 'Wrong soldCountDiscount');
        expect(marketParams.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParams.commonSoldCount).to.be.equal(14, 'Wrong soldCount');
        expect(marketParams.totalRaised).to.be.equal(97, 'Wrong totalRaised');
        expect(marketParams.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
            [AccountUser.address]: [ '4', '5', '6', '7' ],
            [AccountUser2.address]: [ '8', '9', '10', '11' ,'12', '13']
          }, 'Wrong soldNfts');
        expect(await getBalanceFor(userTokenWallet)).to.be.equal(960, 'Wrong user balance ');
        expect(await getEverBalanceFor(AccountUser)).to.be.closeTo(150,0.5,'Wrong balance user');
        expect(await getEverBalanceFor(AccountUser)).to.be.within(149, 150, 'Wrong balance user');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(97, 'Wrong market balance');
        expect(marketParams.totalRaised).to.be.equal(await  getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');

        const payload = await Market.call({ method: 'buildPayload', params: { id: 200, toNftNumber:  20, user: AccountUser.address}});

        await AccountUser.runTarget({
            contract: userTokenWallet,
            method: 'transfer',
            params: {
                amount: new BigNumber(30).shiftedBy(9).toString(),
                recipient: Market.address,
                deployWalletValue: 0,
                remainingGasTo: AccountUser.address,
                payload: payload,
                notify: true
            },
            keyPair: keyPairs[1],
            value: locklift.utils.convertCrystal(6, 'nano')
        });

        let marketParamsAfter  = await getMarketParams();
        expect((await Market.call({ method: 'discountOf', params: {user: AccountUser2.address}})).toNumber()).to.be.equal(0, 'Wrong countDiscount');
        expect(marketParamsAfter.soldCount).to.be.equal(11, 'Wrong soldCount');
        expect(marketParamsAfter.soldCountDiscount).to.be.equal(1, 'Wrong soldCountDiscount');
        expect(marketParamsAfter.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParamsAfter.commonSoldCount).to.be.equal(16, 'Wrong soldCount');
        expect(marketParamsAfter.totalRaised).to.be.equal(127, 'Wrong totalRaised');
        expect(marketParamsAfter.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
        expect(await getBalanceFor(userTokenWallet)).to.be.equal(930, 'Wrong user balance ');
        expect(await getEverBalanceFor(AccountUser)).to.be.closeTo(150,0.5,'Wrong balance user');
        expect(await getEverBalanceFor(AccountUser)).to.be.within(149, 150, 'Wrong balance user');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(127, 'Wrong market balance ');
        expect(marketParamsAfter.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
            [AccountUser.address]: [ '4', '5', '6', '7' , '14', '15'],
            [AccountUser2.address]: [ '8', '9', '10', '11' ,'12', '13']
          }, 'Wrong soldNfts');
    });

    it("Check try buy more than nft per hand for user2", async function() {
        let marketParams  = await getMarketParams();

        expect(marketParams.state).to.be.equal(1, 'Wrong status');
        expect(marketParams.soldCount).to.be.equal(11, 'Wrong soldCount');
        expect(marketParams.soldCountDiscount).to.be.equal(1, 'Wrong soldCountDiscount');
        expect(marketParams.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParams.commonSoldCount).to.be.equal(16, 'Wrong soldCount');
        expect(marketParams.totalRaised).to.be.equal(127, 'Wrong totalRaised');
        expect(marketParams.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
            [AccountUser.address]: [ '4', '5', '6', '7' , '14', '15'],
            [AccountUser2.address]: [ '8', '9', '10', '11' ,'12', '13']
          }, 'Wrong soldNfts');
        expect(await getBalanceFor(user2TokenWallet)).to.be.equal(533, 'Wrong user balance');
        expect(await getEverBalanceFor(AccountUser2)).to.be.closeTo(409, 0.5,'Wrong balance user2');
        expect(await getEverBalanceFor(AccountUser2)).to.be.within(409, 410, 'Wrong balance user2');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(127, 'Wrong market balance');
        expect(marketParams.totalRaised).to.be.equal(await  getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');

        const payload = await Market.call({ method: 'buildPayload', params: { id: 300, toNftNumber:  30, user: AccountUser2.address}});

        const tx = await AccountUser2.runTarget({
            contract: user2TokenWallet,
            method: 'transfer',
            params: {
                amount: new BigNumber(520).shiftedBy(9).toString(),
                recipient: Market.address,
                deployWalletValue: 0,
                remainingGasTo: AccountUser2.address,
                payload: payload,
                notify: true
            },
            keyPair: keyPairs[2],
            value: locklift.utils.convertCrystal(6, 'nano')
        });

        // console.log(tx);
        let marketParamsAfter  = await getMarketParams();
        expect((await Market.call({ method: 'discountOf', params: {user: AccountUser2.address}})).toNumber()).to.be.equal(0, 'Wrong countDiscount');
        expect(marketParamsAfter.soldCount).to.be.equal(marketParams.soldCount + 19, 'Wrong soldCount');
        expect(marketParamsAfter.soldCountDiscount).to.be.equal(marketParams.soldCountDiscount, 'Wrong soldCountDiscount');
        expect(marketParamsAfter.soldCountAirdrop).to.be.equal(marketParams.soldCountAirdrop, 'Wrong soldCountAirdrop');
        expect(marketParamsAfter.commonSoldCount).to.be.equal(marketParams.commonSoldCount + 19, 'Wrong soldCount');
        expect(marketParamsAfter.totalRaised).to.be.equal(marketParams.totalRaised + 480, 'Wrong totalRaised');
        expect(marketParamsAfter.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
        expect(await getBalanceFor(user2TokenWallet)).to.be.equal(13, 'Wrong user balance');
        expect(await getEverBalanceFor(AccountUser2)).to.be.closeTo(449, 0.5,'Wrong balance user2');
        expect(await getEverBalanceFor(AccountUser2)).to.be.within(449, 450, 'Wrong balance user2');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(127 + 480, 'Wrong market balance ');
        expect(marketParamsAfter.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
            [AccountUser.address]: [ '4', '5', '6', '7' , '14', '15'],
            [AccountUser2.address]: [ '8', '9', '10', '11' ,'12', '13', '16', '17', '18' ,'19', '20', '21', '22', '23' ,
                '24' ,'25', '26', '27', '28', '29', '30', '31', '32', '33', '34']
          }, 'Wrong soldNfts');
    });

    it("Check of purchase at the wrong price (less than necessary)", async function() {
        let marketParams  = await getMarketParams();

        expect(marketParams.soldCount).to.be.equal(30, 'Wrong soldCount');
        expect(marketParams.soldCountDiscount).to.be.equal(1, 'Wrong soldCountDiscount');
        expect(marketParams.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParams.commonSoldCount).to.be.equal(35, 'Wrong soldCount');
        expect(marketParams.totalRaised).to.be.equal(607, 'Wrong totalRaised');
        expect(await getBalanceFor(userTokenWallet)).to.be.equal(930, 'Wrong user balance ');
        expect(await getEverBalanceFor(AccountUser)).to.be.closeTo(150, 0.5,'Wrong balance user');
        expect(await getEverBalanceFor(AccountUser)).to.be.within(149, 150, 'Wrong balance user');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(607, 'Wrong market balance ');
        expect(marketParams.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
        expect(marketParams.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
            [AccountUser.address]: [ '4', '5', '6', '7' , '14', '15'],
            [AccountUser2.address]: [ '8', '9', '10', '11' ,'12', '13', '16', '17', '18' ,'19', '20', '21', '22', '23' ,
                '24' ,'25', '26', '27', '28', '29', '30', '31', '32', '33', '34']
          }, 'Wrong soldNfts');

        expect(marketParams.state).to.be.equal(1, 'Wrong status');

        const payload = await Market.call({ method: 'buildPayload', params: { id: 400, toNftNumber:  40, user: AccountUser.address}});

        await AccountUser.runTarget({
            contract: userTokenWallet,
            method: 'transfer',
            params: {
                amount: new BigNumber(39).shiftedBy(9).toString(),
                recipient: Market.address,
                deployWalletValue: 0,
                remainingGasTo: AccountUser.address,
                payload: payload,
                notify: true
            },
            keyPair: keyPairs[1],
            value: locklift.utils.convertCrystal(6, 'nano')
        });

        let marketParamsAfter  = await getMarketParams();
        console.log(await getEverBalanceFor(AccountUser));
        console.log(await getBalanceFor(userTokenWallet));
        expect(marketParamsAfter.soldCount).to.be.equal(marketParams.soldCount, 'Wrong soldCount');
        expect(marketParamsAfter.soldCountDiscount).to.be.equal(marketParams.soldCountDiscount, 'Wrong soldCountDiscount');
        expect(marketParamsAfter.soldCountAirdrop).to.be.equal(marketParams.soldCountAirdrop, 'Wrong soldCountAirdrop');
        expect(marketParamsAfter.commonSoldCount).to.be.equal(marketParams.commonSoldCount, 'Wrong soldCount');
        expect(marketParamsAfter.totalRaised).to.be.equal(607, 'Wrong totalRaised');
        expect(await getBalanceFor(userTokenWallet)).to.be.equal(891, 'Wrong user balance ');
        expect(await getEverBalanceFor(AccountUser)).to.be.closeTo(188,0.5,'Wrong balance user');
        expect(await getEverBalanceFor(AccountUser)).to.be.within(188, 189, 'Wrong balance user');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(607, 'Wrong market balance ');
        expect(marketParamsAfter.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
        expect(marketParamsAfter.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
            [AccountUser.address]: [ '4', '5', '6', '7' , '14', '15'],
            [AccountUser2.address]: [ '8', '9', '10', '11' ,'12', '13', '16', '17', '18' ,'19', '20', '21', '22', '23' ,
                '24' ,'25', '26', '27', '28', '29', '30', '31', '32', '33', '34']
          }, 'Wrong soldNfts');
    });

    it("Buying the rest for user", async function() {
        let marketParams  = await getMarketParams();

        expect(marketParams.soldCount).to.be.equal(30, 'Wrong soldCount');
        expect(marketParams.soldCountDiscount).to.be.equal(1, 'Wrong soldCountDiscount');
        expect(marketParams.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParams.commonSoldCount).to.be.equal(35, 'Wrong soldCount');
        expect(marketParams.totalRaised).to.be.equal(607, 'Wrong totalRaised');
        expect(await getBalanceFor(userTokenWallet)).to.be.equal(891, 'Wrong user balance ');
        expect(await getEverBalanceFor(AccountUser)).to.be.closeTo(188, 0.5,'Wrong balance user');
        expect(await getEverBalanceFor(AccountUser)).to.be.within(188, 189, 'Wrong balance user');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(607, 'Wrong market balance ');
        expect(marketParams.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
        expect(marketParams.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
            [AccountUser.address]: [ '4', '5', '6', '7' , '14', '15'],
            [AccountUser2.address]: [ '8', '9', '10', '11' ,'12', '13', '16', '17', '18' ,'19', '20', '21', '22', '23' ,
                '24' ,'25', '26', '27', '28', '29', '30', '31', '32', '33', '34']
          }, 'Wrong soldNfts');

        expect(marketParams.state).to.be.equal(1, 'Wrong status');

        const payload = await Market.call({ method: 'buildPayload', params: { id: 500, toNftNumber:  50, user: AccountUser.address}});

        await AccountUser.runTarget({
            contract: userTokenWallet,
            method: 'transfer',
            params: {
                amount: new BigNumber(800).shiftedBy(9).toString(),
                recipient: Market.address,
                deployWalletValue: 0,
                remainingGasTo: AccountUser.address,
                payload: payload,
                notify: true
            },
            keyPair: keyPairs[1],
            value: locklift.utils.convertCrystal(6, 'nano')
        });

        let marketParamsAfter  = await getMarketParams();
        expect(marketParamsAfter.soldCount).to.be.equal(marketParams.soldCount + 15, 'Wrong soldCount');
        expect(marketParamsAfter.soldCountDiscount).to.be.equal(marketParams.soldCountDiscount, 'Wrong soldCountDiscount');
        expect(marketParamsAfter.soldCountAirdrop).to.be.equal(marketParams.soldCountAirdrop, 'Wrong soldCountAirdrop');
        expect(marketParamsAfter.commonSoldCount).to.be.equal(marketParams.commonSoldCount + 15, 'Wrong soldCount');
        expect(marketParamsAfter.totalRaised).to.be.equal(1257, 'Wrong totalRaised');
        expect(await getBalanceFor(userTokenWallet)).to.be.equal(91, 'Wrong user balance ');
        expect(await getEverBalanceFor(AccountUser)).to.be.closeTo(338, 0.5,'Wrong balance user');
        expect(await getEverBalanceFor(AccountUser)).to.be.within(338, 339, 'Wrong balance user');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(1257, 'Wrong market balance ');
        expect(marketParamsAfter.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
        expect(marketParamsAfter.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
            [AccountUser.address]: [ '4', '5', '6', '7' , '14', '15', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49'],
            [AccountUser2.address]: [ '8', '9', '10', '11' ,'12', '13', '16', '17', '18' ,'19', '20', '21', '22', '23' ,
                '24' ,'25', '26', '27', '28', '29', '30', '31', '32', '33', '34']
          }, 'Wrong soldNfts');
    });

    it("Check change status when all extended", async function() {

        let marketParams  = await getMarketParams();
        expect(marketParams.commonSoldCount).to.be.equal(marketParams.totalCount, 'Wrong totalCount');
        expect(marketParams.state).to.be.equal(2, 'Wrong state');
        expect(marketParams.startIndex).to.be.null;

        await AccountOwner.runTarget({
            contract: Market,
            method: 'reveal',
            params: {},
            keyPair: keyPairs[0],
            value: locklift.utils.convertCrystal(3, 'nano')
        });

        let marketParamsAfter  = await getMarketParams();

        console.log("startIndex",marketParamsAfter.startIndex);
        expect(marketParamsAfter.state).to.be.equal(3, 'Wrong state');
        expect(marketParamsAfter.startIndex).to.be.not.null;
    });

    it("Check claim by the user", async function() {
        let marketParams  = await getMarketParams();
        expect(marketParams.state).to.be.equal(3, 'Wrong state');
        expect(marketParams.startIndex).to.be.not.null;
        expect(marketParams.mintCount).to.be.equal(0, 'Wrong mintCount');
        expect(marketParams.claimNft).to.eql({}, 'Wrong claimNft');

        let nftsUser = await Market.call({ method: 'nftsOf', params: {_user: AccountUser.address}});

        await AccountUser.runTarget({
            contract: Market,
            method: 'claimNfts',
            params: {},
            keyPair: keyPairs[1],
            value: locklift.utils.convertCrystal(90, 'nano')
        });

        let marketParamsAfter  = await getMarketParams();
        expect(marketParamsAfter.mintCount).to.be.equal(nftsUser.length, 'Wrong soldCount');
        expect(marketParamsAfter.claimNft).to.eql({[AccountUser.address]: true}, 'Wrong claimNft');

        console.log("nftsUser",nftsUser[0].toNumber());
        console.log("startIndex", Number(marketParams.startIndex));

        let newId = (nftsUser[0].toNumber() + Number(marketParams.startIndex)) % marketParams.totalCount;
        let address_nft = await Collection.call({ method: 'nftAddress', params: {id: newId}});
        const Nft = await locklift.factory.getContract("Nft");
        Nft.setAddress(address_nft);

        console.log("newId", newId)
        console.log("address_nft", address_nft);

        let jsonNft = JSON.parse(await Nft.call({ method: 'getJson', params: {}}));
        expect(jsonNft.id).to.be.equal(newId, 'Wrong id nft');

        let infoNft  =  await Nft.call({ method: 'getInfo', params: {}});
        expect(infoNft.owner).to.be.equal(AccountUser.address, 'Wrong owner nft');
        expect(infoNft.manager).to.be.equal(AccountUser.address, 'Wrong manager nft');
        expect(infoNft.id.toNumber()).to.be.equal(newId, 'Wrong id nft');
        expect(infoNft.collection).to.be.equal(Collection.address, 'Wrong collection');

        let totalSupply = await Collection.call({ method: 'totalSupply', params: {}});
        let totalMinted = await Collection.call({ method: 'totalMinted', params: {}});
        expect(totalSupply.toNumber()).to.be.equal(totalMinted.toNumber(), 'Wrong totalSupply');
        expect(totalMinted.toNumber()).to.be.equal(nftsUser.length, 'Wrong totalMinted');
    });

    it("Check claim by the owner", async function() {
        let marketParams  = await getMarketParams();
        expect(marketParams.state).to.be.equal(3, 'Wrong state');
        expect(marketParams.startIndex).to.be.not.null;
        expect(marketParams.mintCount).to.be.equal(21, 'Wrong mintCount');
        expect(marketParams.claimNft).to.eql({[AccountUser.address]: true}, 'Wrong claimNft');

        let keys = Object.keys(marketParams.soldNfts);

        for (let i = 0; i < keys.length; i ++) {
            await AccountOwner.runTarget({
                contract: Market,
                method: 'claimNftsFor',
                params: {
                    user: keys[i]
                },
                keyPair: keyPairs[0],
                value: locklift.utils.convertCrystal(250, 'nano')
            });
        }

        let marketParamsAfter  = await getMarketParams();

        expect(marketParamsAfter.mintCount).to.be.equal(50, 'Wrong soldCount');
        expect(marketParamsAfter.claimNft).to.eql({
            [AccountUser.address]: true,
            [AccountUser2.address]: true,
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': true,
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': true
        }, 'Wrong claimNft');

        let totalSupply = (await Collection.call({ method: 'totalSupply', params: {}})).toNumber();
        let totalMinted = (await Collection.call({ method: 'totalMinted', params: {}})).toNumber();
        expect(totalSupply).to.be.equal(totalMinted, 'Wrong totalSupply');
        expect(totalMinted).to.be.equal(marketParamsAfter.commonSoldCount, 'Wrong totalMinted');

        console.log(totalMinted);
        let address_nft_start = await Collection.call({ method: 'nftAddress', params: {id: 0}});
        const Nft_start = await locklift.factory.getContract("Nft");
        Nft_start.setAddress(address_nft_start);
        let jsonNft_start = JSON.parse(await Nft_start.call({ method: 'getJson', params: {}}));

        let address_nft = await Collection.call({ method: 'nftAddress', params: {id: 49}});
        const Nft = await locklift.factory.getContract("Nft");
        Nft.setAddress(address_nft);
        let jsonNft = JSON.parse(await Nft.call({ method: 'getJson', params: {}}));
    });

    it("Check withdraw", async function() {
        let marketParams  = await getMarketParams();
        expect(marketParams.state).to.be.equal(3, 'Wrong state');
        expect(marketParams.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised');
        expect(marketParams.totalRaised).to.be.equal(1257, 'Wrong totalRaised');
        expect(marketParams.totalWithdraw).to.be.equal(0, 'Wrong totalWithdraw');
        expect(await getBalanceFor(ownerTokenWallet)).to.be.equal(0, 'Wrong ownerTokenWallet');

        await AccountOwner.runTarget({
            contract: Market,
            method: 'withdraw',
            params: {
                amount: new BigNumber(1257).shiftedBy(9).toString(),
                recipient: AccountOwner.address,
            },
            keyPair: keyPairs[0],
            value: locklift.utils.convertCrystal(5, 'nano')
        });

        let marketParamsAfter  = await getMarketParams();

        expect(marketParamsAfter.totalRaised).to.be.equal(1257, 'Wrong totalRaised');
        expect(marketParamsAfter.totalWithdraw).to.be.equal(1257, 'Wrong totalWithdraw');
        expect(await getBalanceFor(ownerTokenWallet)).to.be.equal(1257, 'Wrong owner balance');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(0, 'Wrong market balance');
    });
    it('Check nft license', async function () {
        // nfts_user = await Market.call({ method: 'nftsOf', params: {AccountUser}});
       let address_nft = await Collection.call({ method: 'nftAddress', params: {id: 0}});
       const Nft = await locklift.factory.getContract("Nft");
       Nft.setAddress(address_nft);

       let license = await Nft.call({ method: 'getLicenseName', params: {}});
       expect(license).to.be.equal("CBE_ECR", 'Wrong license');
    });
    it('Check support interface ', async function () {
        let address_nft = await Collection.call({ method: 'nftAddress', params: {id: 0}});
        const Nft = await locklift.factory.getContract("Nft");
        Nft.setAddress(address_nft);

        let interfaceID = parseInt('0x1E4848D4', 16);
        let isSuppInt = await Nft.call({ method: 'supportsInterface', params: {interfaceID: interfaceID}});
        expect(isSuppInt).to.be.equal(true, 'Wrong supportsInterface');
    });
});