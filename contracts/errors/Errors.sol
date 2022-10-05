pragma ton-solidity >=0.57.1;

library Errors {
    uint8 constant WRONG_PRICE_RULES            = 101;
    uint8 constant WRONG_STATUS                 = 102;
    uint8 constant WRONG_LOAD_DATA              = 103;
    uint8 constant OPENING_TIME_NOT_YET         = 104;
    uint8 constant WRONG_RECIPIENT              = 105;
    uint8 constant WRONG_AMOUNT                 = 106;
    uint8 constant USER_HAS_NO_NFTS             = 107;
    uint8 constant ALREADY_CLAIMED              = 108;
    uint8 constant LOW_GAS                      = 109;
    uint8 constant NOT_TOKEN_ROOT               = 110;
    uint8 constant NOT_WEVER_ROOT               = 111;
}