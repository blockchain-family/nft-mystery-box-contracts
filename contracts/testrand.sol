pragma ton-solidity >=0.57.1;

pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;


contract test {
    uint64 static nonce_;
    constructor() public {
        tvm.accept();
        tvm.rawReserve(1 ever, 0);
    }

    function random() public returns (uint32 n, uint32 m) {
        uint32 n;
        uint32 m;

        rnd.shuffle();
        n = rnd.next(50);

        rnd.shuffle();
        m = rnd.next(50);

        return (n,m);
    }

}