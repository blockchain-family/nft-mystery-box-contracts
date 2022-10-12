
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

    let n;
    const Test = await locklift.factory.getAccount("testrand");

    await locklift.giver.deployContract({
        contract: Test,
        constructorParams: {},
        initParams: {
            nonce_: getRandomNonce(),
        },
        keyPair: keyPairs[0],
      }, locklift.utils.convertCrystal(5, 'nano'));


      n = (await Test.call({ method: 'random', params: {}}))
      console.log("Random number",n)

    
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });