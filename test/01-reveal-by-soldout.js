
const {expect} = require('chai');
const fs = require('fs');
const prompts = require('prompts');
const BigNumber = require('bignumber.js');

const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();


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
        countDiscount: (await Market.call({ method: 'discountOf', params: {user: AccountUser2.address}})).toNumber(),
    };
    return params;
};


async function getBalanceFor(wallet) {
    let balanceUser;
    await wallet.call({method: 'balance', params: {}}).then(n => {
        balanceUser = new BigNumber(n).shiftedBy(-9).toNumber();
    }).catch(e => {/*ignored*/});
    return balanceUser;
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
        }, locklift.utils.convertCrystal(300, 'nano'));
        
        AccountOwner.setKeyPair(keyPairs[0]);

        migration.store(AccountOwner, 'Owner account');
        console.log('Owner account deployed', AccountOwner.address);

        // deploy account for users
        AccountUser = await locklift.factory.getAccount("Wallet");
    
        await locklift.giver.deployContract({
            contract: AccountUser,
            constructorParams: {},
            initParams: {
                _randomNonce: getRandomNonce(),
            },
            keyPair: keyPairs[1],
        }, locklift.utils.convertCrystal(150, 'nano'));
        
        AccountUser.setKeyPair(keyPairs[1]);

        migration.store(AccountUser, 'User account');
        console.log('User account deployed', AccountUser.address);
        
        // deploy account for users2
        AccountUser2 = await locklift.factory.getAccount("Wallet");
    
        await locklift.giver.deployContract({
            contract: AccountUser2,
            constructorParams: {},
            initParams: {
                _randomNonce: getRandomNonce(),
            },
            keyPair: keyPairs[2],
        }, locklift.utils.convertCrystal(20, 'nano'));
        
        AccountUser2.setKeyPair(keyPairs[2]);

        migration.store(AccountUser2, 'User2 account');
        console.log('User2 account deployed', AccountUser2.address);

        // deploy token root
        TokenRoot = await locklift.factory.getContract('TokenRootUpgradeable', TOKEN_CONTRACTS_PATH);
        const TokenWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        const TokenWalletPlatform = await locklift.factory.getContract('TokenWalletPlatform', TOKEN_CONTRACTS_PATH);

        await locklift.giver.deployContract({
            contract: TokenRoot,
            constructorParams: {
                initialSupplyTo: AccountOwner.address,
                initialSupply: new BigNumber(100).shiftedBy(9).toFixed(),
                deployWalletValue: locklift.utils.convertCrystal(0.1, 'nano'),
                mintDisabled: 'false',
                burnByRootDisabled: 'true',
                burnPaused: 'false',
                remainingGasTo: locklift.utils.zeroAddress
            },
            initParams: {
                randomNonce_: getRandomNonce(),
                deployer_: locklift.utils.zeroAddress,
                name_: "USDT Tether",
                symbol_: "USDT",
                decimals_: 9,
                walletCode_: TokenWallet.code,
                rootOwner_: AccountOwner.address,
                platformCode_: TokenWalletPlatform.code
            },
            keyPair: keyPairs[0],
        }, locklift.utils.convertCrystal(3, 'nano'));

        migration.store(TokenRoot, 'TokenRoot');
        console.log('TokenRoot contract deployed and mint account owner 100 tokens', TokenRoot.address);

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
        console.log('Collection contract deployed', Collection.address);


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
                _whiteList: whiteList
            },
            initParams: {
                nonce_: getRandomNonce(),
            },
            keyPair: keyPairs[0],
        }, locklift.utils.convertCrystal(5, 'nano'));

        migration.store(Market, 'Market');
        console.log('Market contract deployed', Market.address);

        // get address token wallet for account users
        const userTokenAddress = await TokenRoot.call({
            method: 'walletOf', 
            params: {
              walletOwner: AccountUser.address
            }
        });

        userTokenWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        userTokenWallet.setAddress(userTokenAddress);

        const user2TokenAddress = await TokenRoot.call({
            method: 'walletOf', 
            params: {
              walletOwner: AccountUser2.address
            }
        });

        user2TokenWallet = await locklift.factory.getContract('TokenWalletUpgradeable', TOKEN_CONTRACTS_PATH);
        user2TokenWallet.setAddress(user2TokenAddress);


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

        // await AccountOwner.runTarget({
        //     contract: TokenRoot,
        //     method: 'mint',
        //     params: {
        //         amount: new BigNumber(10).shiftedBy(9).toString(),
        //         recipient: AccountOwner.address,
        //         deployWalletValue: locklift.utils.convertCrystal(0.1, 'nano'),
        //         remainingGasTo: AccountOwner.address,
        //         notify: false,
        //         payload: EMPTY_TVM_CELL
        //     },
        //     value: locklift.utils.convertCrystal(0.5, 'nano'),
        //     keyPair: keyPairs[0]
        // });
        // console.log(`Minted 10 Tokens to owner account : ${AccountOwner.address}`)

        // mint token for token wallet user
        await AccountOwner.runTarget({
            contract: TokenRoot,
            method: 'mint', 
            params: {
                amount: new BigNumber(1000).shiftedBy(9).toString(),
                recipient: AccountUser.address,
                deployWalletValue: locklift.utils.convertCrystal(0.1, 'nano'),
                remainingGasTo: AccountOwner.address,
                notify: false,
                payload: EMPTY_TVM_CELL
            },
            value: locklift.utils.convertCrystal(0.5, 'nano'),
            keyPair: keyPairs[0]
        });
        console.log(`Minted 1000 Tokens to user account : ${AccountUser.address}`);

        // mint token for token wallet user2
        await AccountOwner.runTarget({
            contract: TokenRoot,
            method: 'mint', 
            params: {
                amount: new BigNumber(1000).shiftedBy(9).toString(),
                recipient: AccountUser2.address,
                deployWalletValue: locklift.utils.convertCrystal(0.1, 'nano'),
                remainingGasTo: AccountOwner.address,
                notify: false,
                payload: EMPTY_TVM_CELL
            },
            value: locklift.utils.convertCrystal(0.5, 'nano'),
            keyPair: keyPairs[0]
        });
        console.log(`Minted 1000 Tokens to user2 account : ${AccountUser2.address}`)

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

        console.log('userTokenWallet', await getBalanceFor(userTokenWallet));
        console.log('user2TokenWallet', await getBalanceFor(user2TokenWallet));
        console.log('marketTokenWallet', await getBalanceFor(marketTokenWallet));
        console.log('ownerTokenWallet', await getBalanceFor(ownerTokenWallet));
        // expect(await getBalanceFor(userTokenWallet)).to.be.equal(1000, 'Wrong user balance');
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

    it("Check buy before start date", async function() {
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

        expect(await getBalanceFor(userTokenWallet)).to.be.equal(1000, 'Wrong user balance');
        expect(await getBalanceFor(user2TokenWallet)).to.be.equal(1000, 'Wrong user2 balance');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(0, 'Wrong market balance');

        payload = await Market.call({ method: 'buildPayload', params: { id: 100, toNftNumber:  9}});
    
        await AccountUser.runTarget({
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
            value: locklift.utils.convertCrystal(4, 'nano')
        });
        
        let marketParamsAfter  = await getMarketParams();

      
        expect(marketParamsAfter.soldCount).to.be.equal(0, 'Wrong soldCount');
        expect(marketParamsAfter.totalRaised).to.be.equal(0, 'Wrong totalRaised');
        expect(await getBalanceFor(userTokenWallet)).to.be.equal(1000, 'Wrong user balance');
        expect(await getBalanceFor(user2TokenWallet)).to.be.equal(1000, 'Wrong user2 balance');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(0, 'Wrong market balance');
        expect(marketParamsAfter.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ]
                              }, 'Wrong soldNfts');
        expect(marketParamsAfter.soldCountDiscount).to.be.equal(0, 'Wrong soldCountDiscount');
        expect(marketParamsAfter.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParamsAfter.commonSoldCount).to.be.equal(4, 'Wrong commonSoldCount');

    });

    it("Check buy", async function() {
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
        expect(await getBalanceFor(user2TokenWallet)).to.be.equal(1000, 'Wrong user2 balance');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(0, 'Wrong market balance');

        payload = await Market.call({ method: 'buildPayload', params: { id: 100, toNftNumber:  9}});

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

        // console.log(tx)
        
        let marketParamsAfter  = await getMarketParams();

        // console.log(marketParamsAfter.soldCount);
        // console.log(marketParamsAfter.totalRaised);
        // console.log(await getBalanceFor(userTokenWallet));
        // console.log(await getBalanceFor(marketTokenWallet));
        // console.log(marketParamsAfter.soldNfts);
        // console.log(marketParamsAfter.soldCountDiscount);
        // console.log(marketParamsAfter.soldCountAirdrop);
        // console.log(marketParamsAfter.commonSoldCount);
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
    });

    it("Check buy user2 with discount", async function() {
        let marketParams  = await getMarketParams();

        expect(marketParams.state).to.be.equal(1, 'Wrong status');
        expect(marketParams.soldCount).to.be.equal(4, 'Wrong soldCount');
        expect(marketParams.totalRaised).to.be.equal(40, 'Wrong totalRaised');
        expect(marketParams.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
             [AccountUser.address]: [ '4', '5', '6', '7' ]
          }, 'Wrong soldNfts');
        expect(marketParams.soldCountDiscount).to.be.equal(0, 'Wrong soldCountDiscount');
        expect(marketParams.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParams.commonSoldCount).to.be.equal(8, 'Wrong soldCount');
        expect(marketParams.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
        expect(await getBalanceFor(userTokenWallet)).to.be.equal(960, 'Wrong user balance');
        expect(await getBalanceFor(user2TokenWallet)).to.be.equal(1000, 'Wrong user balance');
        expect(marketParams.countDiscount).to.be.equal(1, 'Wrong countDiscount');

        // console.log('currPriceOf', (await Market.call({ method: 'currPriceOf', params: {user: AccountUser2.address }})).toNumber())

        payload = await Market.call({ method: 'buildPayload', params: { id: 200, toNftNumber:  19}});

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

        let marketParamsAfter  = await getMarketParams();
        // console.log('soldNfts', marketParamsAfter.soldNfts)
        // console.log('soldCountDiscount',marketParamsAfter.soldCountDiscount)
        // console.log("discount", (await Market.call({ method: 'discountOf', params: {user: AccountUser2.address}})).toNumber())
        // console.log('currPriceOf', (await Market.call({ method: 'currPriceOf', params: {user: AccountUser2.address }})).toNumber())
        // console.log("user2 balance ", (await getUser2Balance()).toString());
        // console.log("market balance ", (await getMarketBalance()).toString());
        // console.log("soldNfts",marketParamsAfter.soldNfts)
        // console.log("soldCount",marketParamsAfter.soldCount)
        // console.log("totalRaised",marketParamsAfter.totalRaised)
        expect(marketParamsAfter.countDiscount).to.be.equal(0, 'Wrong countDiscount');
        expect(marketParamsAfter.soldCount).to.be.equal(9, 'Wrong soldCount');
        expect(marketParamsAfter.soldCountDiscount).to.be.equal(1, 'Wrong soldCountDiscount');
        expect(marketParamsAfter.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        expect(marketParamsAfter.commonSoldCount).to.be.equal(14, 'Wrong soldCount');
        expect(marketParamsAfter.totalRaised).to.be.equal(97, 'Wrong totalRaised');
        expect(await getBalanceFor(userTokenWallet)).to.be.equal(960, 'Wrong user balance ');
        expect(await getBalanceFor(user2TokenWallet)).to.be.equal(943, 'Wrong user2 balance ');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(97, 'Wrong market balance ');
        expect(marketParamsAfter.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
        expect(marketParamsAfter.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
            [AccountUser.address]: [ '4', '5', '6', '7' ],
            [AccountUser2.address]: [ '8', '9', '10', '11' ,'12', '13']
          }, 'Wrong soldNfts');
    });

    it("Check try buy more than nft per hand for user2", async function() {
        let marketParams  = await getMarketParams();

        expect(marketParams.state).to.be.equal(1, 'Wrong status');
        expect(marketParams.soldCount).to.be.equal(9, 'Wrong soldCount');
        expect(marketParams.totalRaised).to.be.equal(97, 'Wrong totalRaised');
        expect(marketParams.soldNfts).to.eql({
            '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
            '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
            [AccountUser.address]: [ '4', '5', '6', '7' ],
            [AccountUser2.address]: [ '8', '9', '10', '11' ,'12', '13']
          }, 'Wrong soldNfts');
        expect(await getBalanceFor(userTokenWallet)).to.be.equal(960, 'Wrong user balance ');
        expect(await getBalanceFor(user2TokenWallet)).to.be.equal(943, 'Wrong user2 balance');
        expect(await getBalanceFor(marketTokenWallet)).to.be.equal(97, 'Wrong market balance');
        expect(marketParams.totalRaised).to.be.equal(await  getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
        expect(marketParams.countDiscount).to.be.equal(0, 'Wrong countDiscount');
        console.log('countDiscount',marketParams.countDiscount);
        console.log('currPriceOf', (await Market.call({ method: 'currPriceOf', params: {user: AccountUser2.address }})).toNumber())
        payload = await Market.call({ method: 'buildPayload', params: { id: 200, toNftNumber:  9}});

        await AccountUser2.runTarget({
            contract: userTokenWallet,
            method: 'transfer',
            params: {
                amount: new BigNumber(10).shiftedBy(9).toString(),
                recipient: Market.address,
                deployWalletValue: 0,
                remainingGasTo: AccountUser2.address,
                payload: payload,
                notify: true
            },
            keyPair: keyPairs[2],
            value: locklift.utils.convertCrystal(6, 'nano')
        });

        let marketParamsAfter  = await getMarketParams();
        console.log('soldNfts', marketParamsAfter.soldNfts)
        console.log(await getBalanceFor(user2TokenWallet));
        console.log(marketParamsAfter.soldCount);
        console.log(marketParamsAfter.totalRaised);

        // expect(marketParamsAfter.countDiscount).to.be.equal(0, 'Wrong countDiscount');
        // expect(marketParamsAfter.soldCount).to.be.equal(28, 'Wrong soldCount');
        // expect(marketParamsAfter.soldCountDiscount).to.be.equal(1, 'Wrong soldCountDiscount');
        // expect(marketParamsAfter.soldCountAirdrop).to.be.equal(4, 'Wrong soldCountAirdrop');
        // expect(marketParamsAfter.commonSoldCount).to.be.equal(33, 'Wrong soldCount');
        // expect(marketParamsAfter.totalRaised).to.be.equal(347, 'Wrong totalRaised');
        // expect(marketParamsAfter.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
        // expect(await getBalanceFor(userTokenWallet)).to.be.equal(960, 'Wrong user balance ');
        // expect(await getBalanceFor(user2TokenWallet)).to.be.equal(493, 'Wrong user2 balance ');
        // expect(await getBalanceFor(marketTokenWallet)).to.be.equal(347, 'Wrong market balance ');
        // expect(marketParamsAfter.soldNfts).to.eql({
        //     '0:9527f7dfb02a618163b2597b0695bdf09c2837a2c2a2df1ceb553b4027817d88': [ '0' ],
        //     '0:f8fb1ccafeada3358521495f8a0a98ce8181815c178d09f3ae28a34346a26fdb': [ '1', '2', '3' ],
        //     [AccountUser.address]: [ '4', '5', '6', '7' ],
        //     [AccountUser2.address]: [ '8', '9', '10', '11' ,'12', '13', '14', '15', '16','17', '18', '19', '20' ,'21', '22',
        //         '23', '24','25', '26', '27', '28' ,'29', '30', '31', '32']
        //   }, 'Wrong soldNfts');
    });

    // it("Check of purchase at the wrong price (less than necessary)", async function() {
    //     let marketParams  = await getMarketParams();
    //
    //     expect(marketParams.soldCount).to.be.equal(11, 'Wrong soldCount');
    //     expect(marketParams.totalRaised).to.be.equal(120, 'Wrong totalRaised');
    //     expect(await getBalanceFor(userTokenWallet)).to.be.equal(960, 'Wrong user balance ');
    //     expect(await getBalanceFor(user2TokenWallet)).to.be.equal(920, 'Wrong user2 balance ');
    //     expect(await getBalanceFor(marketTokenWallet)).to.be.equal(120, 'Wrong market balance ');
    //     expect(marketParams.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
    //     expect(marketParams.soldNfts).to.eql({
    //         [AccountUser.address]: [ '0', '1', '2', '3' ],
    //         [AccountUser2.address]: [ '4', '5', '6', '7' ,'8', '9','10']
    //       }, 'Wrong soldNfts');
    //
    //     expect(marketParams.state).to.be.equal(1, 'Wrong status');
    //
    //     payload = await Market.call({ method: 'buildPayload', params: { id: 100, toNftNumber:  19}});
    //
    //     await AccountUser.runTarget({
    //         contract: userTokenWallet,
    //         method: 'transfer',
    //         params: {
    //             amount: new BigNumber(10).shiftedBy(9).toString(),
    //             recipient: Market.address,
    //             deployWalletValue: 0,
    //             remainingGasTo: AccountUser.address,
    //             payload: payload,
    //             notify: true
    //         },
    //         keyPair: keyPairs[1],
    //         value: locklift.utils.convertCrystal(6, 'nano')
    //     });
    //
    //
    //     let marketParamsAfter  = await getMarketParams();
    //
    //     console.log(marketParamsAfter.soldCount);
    //     console.log(marketParamsAfter.totalRaised);
    //     console.log(marketParamsAfter.soldNfts);
    //
    //     expect(marketParamsAfter.soldCount).to.be.equal(11, 'Wrong soldCount');
    //     expect(marketParamsAfter.totalRaised).to.be.equal(120, 'Wrong totalRaised');
    //     expect(await getBalanceFor(userTokenWallet)).to.be.equal(960, 'Wrong user balance ');
    //     expect(await getBalanceFor(user2TokenWallet)).to.be.equal(920, 'Wrong user2 balance ');
    //     expect(await getBalanceFor(marketTokenWallet)).to.be.equal(120, 'Wrong market balance ');
    //     expect(marketParamsAfter.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
    //     expect(marketParamsAfter.soldNfts).to.eql({
    //         [AccountUser.address]: [ '0', '1', '2', '3'],
    //         [AccountUser2.address]: [ '4', '5', '6', '7' ,'8', '9','10']
    //       }, 'Wrong soldNfts');
    // });
    //
    // it("Purchase over time for user", async function() {
    //     let marketParams  = await getMarketParams();
    //
    //     expect(marketParams.state).to.be.equal(1, 'Wrong status');
    //     expect(marketParams.soldCount).to.be.equal(11, 'Wrong soldCount');
    //     expect(marketParams.totalRaised).to.be.equal(120, 'Wrong totalRaised');
    //     expect(await getBalanceFor(userTokenWallet)).to.be.equal(960, 'Wrong user balance ');
    //     expect(await getBalanceFor(user2TokenWallet)).to.be.equal(920, 'Wrong user2 balance ');
    //     expect(await getBalanceFor(marketTokenWallet)).to.be.equal(120, 'Wrong market balance ');
    //     expect(marketParams.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
    //     expect(marketParams.soldNfts).to.eql({
    //         [AccountUser.address]: [ '0', '1', '2', '3' ],
    //         [AccountUser2.address]: [ '4', '5', '6', '7' ,'8', '9','10']
    //         }, 'Wrong soldNfts');
    //
    //     payload = await Market.call({ method: 'buildPayload', params: { id: 100, toNftNumber:  19}});
    //
    //     await AccountUser.runTarget({
    //         contract: userTokenWallet,
    //         method: 'transfer',
    //         params: {
    //             amount: new BigNumber(60).shiftedBy(9).toString(),
    //             recipient: Market.address,
    //             deployWalletValue: 0,
    //             remainingGasTo: AccountUser.address,
    //             payload: payload,
    //             notify: true
    //         },
    //         keyPair: keyPairs[1],
    //         value: locklift.utils.convertCrystal(6, 'nano')
    //     });
    //
    //
    //     let marketParamsAfter  = await getMarketParams();
    //
    //     expect(marketParamsAfter.soldCount).to.be.equal(14, 'Wrong soldCount');
    //     expect(marketParamsAfter.totalRaised).to.be.equal(180, 'Wrong totalRaised');
    //     expect(await getBalanceFor(userTokenWallet)).to.be.equal(900, 'Wrong user balance ');
    //     expect(await getBalanceFor(user2TokenWallet)).to.be.equal(920, 'Wrong user2 balance ');
    //     expect(await getBalanceFor(marketTokenWallet)).to.be.equal(180, 'Wrong market balance ');
    //     expect(marketParamsAfter.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised or market balance');
    //     expect(marketParamsAfter.soldNfts).to.eql({
    //         [AccountUser.address]: [ '0', '1', '2', '3', '11', '12', '13'],
    //         [AccountUser2.address]: [ '4', '5', '6', '7' ,'8', '9','10']
    //         }, 'Wrong soldNfts');
    // });
    //
    // it("Check change status when all extended", async function() {
    //
    //     let marketParams  = await getMarketParams();
    //     expect(marketParams.soldCount).to.be.equal(marketParams.totalCount, 'Wrong totalCount');
    //     expect(marketParams.state).to.be.equal(2, 'Wrong state');
    //     expect(marketParams.startIndex).to.be.null;
    //
    //     await AccountOwner.runTarget({
    //         contract: Market,
    //         method: 'reveal',
    //         params: {},
    //         keyPair: keyPairs[0],
    //         value: locklift.utils.convertCrystal(3, 'nano')
    //     });
    //
    //     let marketParamsAfter  = await getMarketParams();
    //
    //     console.log("startIndex",marketParamsAfter.startIndex);
    //     expect(marketParamsAfter.state).to.be.equal(3, 'Wrong state');
    //     expect(marketParamsAfter.startIndex).to.be.not.null;
    // });
    //
    // it("Check claim by the user", async function() {
    //     let marketParams  = await getMarketParams();
    //     expect(marketParams.state).to.be.equal(3, 'Wrong state');
    //     expect(marketParams.startIndex).to.be.not.null;
    //     expect(marketParams.mintCount).to.be.equal(0, 'Wrong mintCount');
    //     expect(marketParams.claimNft).to.eql({}, 'Wrong claimNft');
    //
    //
    //     await AccountUser.runTarget({
    //         contract: Market,
    //         method: 'claimNfts',
    //         params: {},
    //         keyPair: keyPairs[1],
    //         value: locklift.utils.convertCrystal(100, 'nano')
    //     });
    //
    //     let marketParamsAfter  = await getMarketParams();
    //
    //     expect(marketParamsAfter.mintCount).to.be.equal(7, 'Wrong soldCount');
    //     expect(marketParamsAfter.claimNft).to.eql({[AccountUser.address]: true}, 'Wrong claimNft');
    //
    // });
    //
    // it("Check claim by the owner", async function() {
    //     let marketParams  = await getMarketParams();
    //     expect(marketParams.state).to.be.equal(3, 'Wrong state');
    //     expect(marketParams.startIndex).to.be.not.null;
    //     expect(marketParams.mintCount).to.be.equal(7, 'Wrong mintCount');
    //     expect(marketParams.claimNft).to.eql({[AccountUser.address]: true}, 'Wrong claimNft');
    //
    //
    //     let keys = Object.keys(marketParams.soldNfts);
    //
    //     for (let i = 0; i < keys.length; i ++) {
    //         await AccountOwner.runTarget({
    //             contract: Market,
    //             method: 'claimNftsFor',
    //             params: {
    //                 user: keys[i]
    //             },
    //             keyPair: keyPairs[0],
    //             value: locklift.utils.convertCrystal(250, 'nano')
    //         });
    //     }
    //
    //     let marketParamsAfter  = await getMarketParams();
    //
    //     expect(marketParamsAfter.mintCount).to.be.equal(14, 'Wrong soldCount');
    //     expect(marketParamsAfter.claimNft).to.eql({[AccountUser.address]: true, [AccountUser2.address]: true}, 'Wrong claimNft');
    //
    // });
    //
    // it("Check withdraw", async function() {
    //     let marketParams  = await getMarketParams();
    //     expect(marketParams.state).to.be.equal(3, 'Wrong state');
    //     expect(marketParams.totalRaised).to.be.equal(await getBalanceFor(marketTokenWallet), 'Wrong totalRaised');
    //     expect(marketParams.totalRaised).to.be.equal(180, 'Wrong totalRaised');
    //     expect(marketParams.totalWithdraw).to.be.equal(0, 'Wrong totalWithdraw');
    //     expect(await getBalanceFor(ownerTokenWallet)).to.be.equal(110, 'Wrong ownerTokenWallet');
    //
    //     await AccountOwner.runTarget({
    //         contract: Market,
    //         method: 'withdraw',
    //         params: {
    //             amount: new BigNumber(180).shiftedBy(9).toString(),
    //             recipient: AccountOwner.address,
    //         },
    //         keyPair: keyPairs[0],
    //         value: locklift.utils.convertCrystal(5, 'nano')
    //     });
    //
    //     let marketParamsAfter  = await getMarketParams();
    //
    //     console.log(marketParamsAfter.totalWithdraw);
    //     expect(marketParamsAfter.totalRaised).to.be.equal(180, 'Wrong totalRaised');
    //     expect(marketParamsAfter.totalWithdraw).to.be.equal(180, 'Wrong totalWithdraw');
    //     expect(await getBalanceFor(ownerTokenWallet)).to.be.equal(290, 'Wrong owner balance');
    //     expect(await getBalanceFor(marketTokenWallet)).to.be.equal(0, 'Wrong market balance');
    // });


});