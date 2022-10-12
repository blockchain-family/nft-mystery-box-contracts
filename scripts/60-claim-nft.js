const prompts = require('prompts');
const BigNumber = require('bignumber.js');
const fs = require('fs')

const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

async function main() {

    const [keyPair] = await locklift.keys.getKeyPairs();
    const Account = await locklift.factory.getAccount("Wallet");
    migration.load(Account, 'AccountDeployed');

    const Market = await locklift.factory.getContract("Market");
    migration.load(Market, 'Market');

    let soldNfts =  await Market.call({ method: 'soldNfts', params: {}});

    let keys = Object.keys(soldNfts);

        for (let i = 0; i < keys.length; i ++) {
            await AccountOwner.runTarget({
                contract: Market,
                method: 'claimNftsFor',
                params: {
                    user: keys[i]
                },
                keyPair: keyPair,
                value: locklift.utils.convertCrystal(250, 'nano')
            }); 
        }
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });