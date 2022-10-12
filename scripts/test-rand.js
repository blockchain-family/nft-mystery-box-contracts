const {Migration} = require(process.cwd() + '/scripts/migration')
const migration = new Migration();

function getRandomNonce() {
    return Math.random() * 64000 | 0;
}

async function main() {

    const keyPairs = await locklift.keys.getKeyPairs();

    // deploy account
    const Account = await locklift.factory.getAccount("Wallet");

    await locklift.giver.deployContract({
      contract: Account,
      constructorParams: {},
      initParams: {
        _randomNonce: getRandomNonce(),
      },
      keyPair: keyPairs[0],
    }, locklift.utils.convertCrystal(20, 'nano'));
  
    Account.setKeyPair(keyPairs[0]);

    migration.store(Account, 'Account');
    console.log('Account deployed', Account.address);

    const Test = await locklift.factory.getAccount("testrand2");

    async function sleep(ms) {
        ms = ms === undefined ? 1000 : ms;
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    await locklift.giver.deployContract({
        contract: Test,
        constructorParams: {},
        initParams: {
            nonce_: getRandomNonce(),
        },
        keyPair: keyPairs[0],
      }, locklift.utils.convertCrystal(5, 'nano'));

    console.log('Test deployed', Test.address);

    for (let i = 0; i < 10; i ++) {
        await sleep(5000); 
        await Account.runTarget({
            contract: Test,
            method: 'random', 
            params: {},
            value: locklift.utils.convertCrystal(0.01, 'nano'),
            keyPair: keyPairs[0]
        });

        r = (await Test.call({ method: 'rand', params: {}}))
        console.log("Random number", r.toString())
    }
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });