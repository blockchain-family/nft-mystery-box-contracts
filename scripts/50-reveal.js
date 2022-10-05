
const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

async function main() {

    const [keyPair] = await locklift.keys.getKeyPairs();
    const Account = await locklift.factory.getAccount("Wallet");
    migration.load(Account, 'AccountDeployed');

    //texted to migration log
    const Market = await locklift.factory.getContract("Market");
    migration.load(Market, 'Market');

    await Account.runTarget({
        contract: Market,
        method: 'reveal',
        params: {},
        keyPair,
        value: locklift.utils.convertCrystal(1, 'nano')
    });
    console.log('Reveal started');
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });