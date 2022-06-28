pragma ton-solidity >=0.57.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./interfaces/ICollection.sol";
import "./interfaces/IMarketCallback.sol";

import './libraries/Gas.sol';
import './errors/Errors.sol';

import "./structures/INftInfoStructure.sol";
import "./modules/access/OwnableInternal.sol";
import "@broxus/credit-processor/contracts/interfaces/structures/ICreditEventDataStructure.sol";
import "@broxus/credit-processor/contracts/interfaces/IReceiveTONsFromBridgeCallback.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";

contract Market is OwnableInternal, INftInfoStructure, ICreditEventDataStructure, IReceiveTONsFromBridgeCallback{


    uint64 static nonce_;

    uint16 public nftPerHand;
    uint16 public totalCount;
    uint16 public soldCount;
    uint16 public mintCount;
    address collection;

    uint32 public startTime;
    uint32 public revealDate;

    uint128 public totalRaised;
    uint128 public totalWithdraw;

    string public provenanceHash;
    optional(uint32) startIndex;


    enum SaleStatus {
            Upcoming,
            Active,
            Completed
    }

    mapping (uint32 => NftInfo) nftData_;
    mapping (uint16 => uint128) public priceRule;
    mapping (address => uint16[]) public soldNfts;
    mapping (address => bool) public claimNft;

    constructor(
        uint16 _totalCount,
        uint32 _startTime,
        uint32 _revealDate,
        address _owner,
        uint16 _nftPerHand,
        address _collection,
        string _provenanceHash,
        mapping (uint16 => uint128) _priceRule
    ) 
        public
        OwnableInternal(_owner)
    {
        tvm.accept();
        totalCount = _totalCount;
        startTime = _startTime;
        revealDate = _revealDate;
        nftPerHand = _nftPerHand;
        priceRule = _priceRule;
        require(priceRule.exists(0), 101);
        collection = _collection;
        provenanceHash = _provenanceHash;
        _reserve();
        msg.sender.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });
    }

    modifier onlyState(SaleStatus requiredState) {
        require(requiredState == state(), 102);
        _;
    }

    function loadNftData(mapping (uint32 => NftInfo) _nftData) external onlyOwner onlyState(SaleStatus.Upcoming) {
        for ((uint32 key, NftInfo value) : _nftData) {
            require(key <= totalCount, 103);
            nftData_[key] = value;         
        }
    }

    function state() public view returns(SaleStatus) {
        if (now < startTime) {
            return SaleStatus.Upcoming;
        } else if (!startIndex.hasValue() || (now < revealDate && soldCount < totalCount)) {
            return  SaleStatus.Active;
        } else {
            return SaleStatus.Completed;
        }
    }

    function nftData() external view  onlyState(SaleStatus.Completed) returns (mapping (uint32 => NftInfo)) {
        return nftData_;
    }


    function nftsOf(address _user) public returns (uint16[]) {
        return soldNfts.exists(_user) ? soldNfts.at(_user) : new uint16[](0);
    }

    function _reserve() private {
        tvm.rawReserve(totalRaised - totalWithdraw + Gas.INITIAL_BALANCE, 0);
    }

    function buy(uint32 id, uint128 amount, uint16 toNftNumber, address user) external {
        _buy(id, amount, toNftNumber, user);
    }

    function _buy(uint32 id, uint128 amount, uint16 toNftNumber, address user) private {
        if (state() == SaleStatus.Active && msg.value >= amount + Gas.BUY_VALUE) {
            uint16[] currUserNfts = nftsOf(user);
            uint256 currUserNftsCount = currUserNfts.length;
            uint16 currSoldCount = soldCount;
            uint128 currAmount = amount;
            
            for (uint16 i = soldCount; i <= toNftNumber; i++) {
                (,uint128 price) = priceRule.prevOrEq(currSoldCount).get();
                if (currAmount >= price && currUserNftsCount < nftPerHand && currSoldCount < totalCount) {
                    currAmount -= price;
                    currUserNftsCount++;
                    currUserNfts.push(i);
                    currSoldCount++;
                } else {
                    break;
                }
            }
            if (soldCount != currSoldCount) {
                IMarketCallback(user).onSuccess{ 
                    value: Gas.CALLBACK_VALUE, flag: MsgFlag.SENDER_PAYS_FEES, bounce: false 
                }(id, soldCount, currSoldCount - 1);

                soldNfts[user] = currUserNfts;
                soldCount = currSoldCount;
                totalRaised += (amount - currAmount);
            } else {
                IMarketCallback(user).onCancel{ value: Gas.CALLBACK_VALUE, flag: MsgFlag.SENDER_PAYS_FEES, bounce: false }(id);
            }
        } else {
            IMarketCallback(user).onCancel{ value: Gas.CALLBACK_VALUE, flag: MsgFlag.SENDER_PAYS_FEES, bounce: false }(id);
        }

        _reserve();
        user.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });
    }

    function onReceiveTONsFromBridgeCallback(CreditEventData _data) external override {
        TvmSlice l3Slice = _data.layer3.toSlice();
        if (l3Slice.bits() == 176) {
            (uint32 id, uint128 amount, uint16 toNftNumber) = l3Slice.decode(uint32, uint128, uint16);
            _buy(id, amount, toNftNumber, _data.user);
        } else {
            _reserve();
            _data.user.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });
        }
    }

    receive() external  {
        if (msg.value > Gas.BUY_VALUE) {
            _buy(0, msg.value - Gas.BUY_VALUE, totalCount, msg.sender);
        } else {
            _reserve();
            msg.sender.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });
        }
    }

    // function getCurrentPrice() returns (uint128) onlyState(SaleStatus.Active) {
    //     optional(uint16, uint128) prevPriceRule = priceRule.prevOrEq(soldCount);
    //     (int16 prevKey, uint128 prevValue) = prevPriceRule.get();
    //     return prevValue;
    // }


    function reveal() public onlyState(SaleStatus.Active) {
        require(now >= revealDate || soldCount == totalCount, 104);
        startIndex.set(uint32(rnd.next(totalCount)));
        _reserve();
        msg.sender.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });
    }

    function withdraw(uint128 amount, address recipient) external onlyOwner onlyState(SaleStatus.Completed){
        require(recipient.value != 0, 105);
        require(totalWithdraw + amount <= totalRaised, 106);
        totalWithdraw += amount;
        _reserve();
        recipient.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false });
    }

    function _claimNfts(address user) private {
        uint16[] currUserNfts = nftsOf(user);
        uint256 currUserNftsCount = currUserNfts.length;
        require (currUserNftsCount > 0, 107); 
        require (!claimNft.exists(user), 110); 
        require(msg.value >= currUserNftsCount * Gas.CLAIM_VALUE + Gas.CLAIM_ADDITIONAL_GAS, 109);
        
        for (uint32 userNft : currUserNfts) {
            uint32 newIdNft = (userNft + startIndex.get()) % totalCount;
            mintCount++;
            ICollection(collection).mintNft{ value: Gas.CLAIM_VALUE, flag: 0, bounce: false }(nftData_.at(userNft), user, newIdNft);
        }

        claimNft[user] = true;
        _reserve();
        msg.sender.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });  
    }

    function claimNfts() external onlyState(SaleStatus.Completed) {
        _claimNfts(msg.sender);          
    }

    function claimNftsFor(address user) external onlyOwner onlyState(SaleStatus.Completed) {
        _claimNfts(user);
    }

}

