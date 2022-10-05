npx locklift build --config locklift.config.js
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/0-reset-migration.js
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/20-wton-setup.js
npx locklift run --config locklift.config.js --disable-build --network local --script scripts/59-hardcode-addresses.js
locklift build --config locklift.config.js
npx locklift run --config locklift.config.js --disable-build --network local --tests test/011-reveal-by-soldout-wever.js
npx locklift run --config locklift.config.js --disable-build --network local --tests test/22-reveal-by-date-wever.js
