pragma ton-solidity >=0.57.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./structures/INftInfoStructure.sol";
import './libraries/Gas.sol';
import './errors/Errors.sol';

contract NewMarket is 
    INftInfoStructure {

    address[] managers_;

    address owner_;

    uint64 static nonce_;

    uint16 public nftPerHand;
    uint16 public totalCount;
    uint16 public soldCount;
    uint16 public mintCount;
    address public collection;

    uint32 public startDate;
    uint32 public revealDate;

    uint128 public totalRaised;
    uint128 public totalWithdraw;

    string public provenanceHash;
    optional(uint32) public startIndex;
    address public tokenRoot;
    address public tokenWallet;

    enum SaleStatus {
            Upcoming,
            Active,
            SoldOut,
            Completed
    }

    mapping (uint32 => NftInfo) nftData_;
    mapping (uint16 => uint128) public priceRule;
    mapping (address => uint16[]) public soldNfts;
    mapping (address => bool) public claimNft;

    uint16 public soldCountDiscount;
    uint16 public soldCountAirdrop;
    uint128 public discountPrice;

    mapping (address => uint16) public airDrop;
    mapping (address => uint16) public whiteList;

    constructor() public {revert();}

    function nftData() external view returns (mapping (uint32 => NftInfo)) {
        return nftData_;
    }

    function state() public view returns(SaleStatus) {
        uint16 commonSoldCount =  commonSoldCount();
        if (now < startDate) {
            return SaleStatus.Upcoming;
        } else if (startIndex.hasValue()) {
            return  SaleStatus.Completed;
        } else if (now >= revealDate || commonSoldCount == totalCount) {
            return SaleStatus.SoldOut;
        } else {
            return SaleStatus.Active;
        }
    }

    function commonSoldCount() public view returns (uint16) {
        return (soldCount + soldCountDiscount + soldCountAirdrop);
    }

    function onCodeUpgrade(TvmCell data) private {
        tvm.resetStorage();
        (
            owner_,
            managers_,
            nftPerHand,
            totalCount,
            soldCount,
            mintCount,
            collection,
            startDate,
            revealDate,
            totalRaised,
            totalWithdraw,
            provenanceHash,
            startIndex,
            tokenRoot,
            tokenWallet,
            nftData_,
            priceRule,
            soldNfts,
            claimNft,
            soldCountDiscount,
            airDrop,
            whiteList,
            soldCountAirdrop,
            discountPrice

        ) = abi.decode(data, (
            address,
            address[],
            uint16,
            uint16,
            uint16,
            uint16,
            address,
            uint32,
            uint32,
            uint128,
            uint128,
            string,
            optional(uint32),
            address,
            address,
            mapping (uint32 => NftInfo),
            mapping (uint16 => uint128),
            mapping (address => uint16[]),
            mapping (address => bool),
            uint16,
            mapping (address => uint16),
            mapping (address => uint16),
            uint16,
            uint128
        ));
        owner_.transfer({ value: 0, flag: 128 });
    }

    function bla() public returns (string) {
        return "blablabla";
    }

}