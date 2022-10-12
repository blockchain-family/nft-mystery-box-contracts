pragma ton-solidity >=0.57.1;

pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;


contract test2 {
    uint64 static nonce_;
    uint32 public rand;

    constructor() public {
        tvm.accept();
        tvm.rawReserve(1 ever, 0);
    }

    function random() public {
        rnd.shuffle();
        rand = rnd.next(50);
    }

}