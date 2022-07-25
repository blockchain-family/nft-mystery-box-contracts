pragma ton-solidity =0.57.1;

library Gas {
    uint128 constant INITIAL_BALANCE              = 1 ever;
    uint128 constant CLAIM_VALUE                  = 1 ever;
    uint128 constant CLAIM_ADDITIONAL_GAS         = 2 ever;
    uint128 constant MINT_VALUE                   = 2 ever;
    uint128 constant MINT_ADDITIONAL_GAS          = 2 ever;
    uint128 constant BUY_VALUE                    = 2 ever;
    uint128 constant CALLBACK_VALUE               = 0.01 ever;
    uint128 constant DEPLOY_EMPTY_WALLET_VALUE    = 0.5 ever;
    uint128 constant DEPLOY_EMPTY_WALLET_GRAMS    = 0.1 ever;
    uint128 constant WITHDRAW_VALUE               = 1 ever;
    uint128 constant UPGRADE_ACCOUNT_MIN_VALUE    = 5 ever;
}
