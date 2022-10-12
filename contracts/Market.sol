pragma ton-solidity >=0.57.1;
pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./interfaces/ICollection.sol";
import "./interfaces/IMarketCallback.sol";

import './libraries/Gas.sol';
import './errors/Errors.sol';
import "./structures/INftInfoStructure.sol";
import "./modules/access/MultiOwner.sol";

import "@broxus/credit-processor/contracts/interfaces/structures/ICreditEventDataStructure.sol";
import "@broxus/credit-processor/contracts/interfaces/IReceiveTONsFromBridgeCallback.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol"; 
import "@broxus/credit-processor/contracts/libraries/EventDataDecoder.sol";

import "tip3/contracts/interfaces/ITokenWallet.sol";
import "tip3/contracts/interfaces/ITokenRoot.sol";
import "tip3/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "./Addresses-prod.sol";

contract Market is
    Addresses,
    MultiOwner, 
    INftInfoStructure, 
    ICreditEventDataStructure, 
    IReceiveTONsFromBridgeCallback, 
    IAcceptTokensTransferCallback 
{
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

    uint16 public soldCountDiscount;
    uint16 public soldCountAirdrop;
    uint128 public discountPrice;

    mapping (uint32 => NftInfo) nftData_;
    mapping (uint16 => uint128) public priceRule;
    mapping (address => uint16[]) public soldNfts;
    mapping (address => bool) public claimNft;
    mapping (address => uint16) public airDrop;
    mapping (address => uint16) public whiteList;

    constructor(
        uint16 _totalCount,
        uint32 _startDate,
        uint32 _revealDate,
        address _owner,
		address[] _managers,
        uint16 _nftPerHand,
        address _collection,
        string _provenanceHash,
        address _tokenRoot,
        uint128 _discountPrice,
        mapping (uint16 => uint128) _priceRule,
        mapping (address => uint16) _airDrop,
        mapping (address => uint16) _whiteList
    ) 
        public
        MultiOwner(_owner, _managers)
    {
        tvm.accept();
        totalCount = _totalCount;
        startDate = _startDate;
        revealDate = _revealDate;
        nftPerHand = _nftPerHand;
        tokenRoot = _tokenRoot;
        priceRule = _priceRule;
        require(priceRule.exists(0), Errors.WRONG_PRICE_RULES);
        collection = _collection;
        provenanceHash = _provenanceHash;
        airDrop = _airDrop;
        whiteList = _whiteList;
        discountPrice = _discountPrice;

        for ((address key, uint16 value) : airDrop) {
            uint16 curSoldCountAirdrop = soldCountAirdrop;
            uint16[] currUserNfts = nftsOf(key);
            uint256 currUserNftsCount = currUserNfts.length;
            for (uint16 i = 0; i < value; i++) {
                if (currUserNftsCount < nftPerHand && curSoldCountAirdrop < totalCount) {
                    currUserNfts.push(curSoldCountAirdrop);
                    curSoldCountAirdrop++;
                    currUserNftsCount++;
                } else {
                    break;
                }
            }
            soldNfts[key] = currUserNfts;
            soldCountAirdrop = curSoldCountAirdrop;
        }

        ITokenRoot(tokenRoot).deployWallet {
            value: Gas.DEPLOY_EMPTY_WALLET_VALUE,
            flag: MsgFlag.SENDER_PAYS_FEES,
            callback: Market.onTokenWallet
        }(
            address(this),
            Gas.DEPLOY_EMPTY_WALLET_GRAMS
        );

        _reserve();
        msg.sender.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });
    }

    modifier onlyState(SaleStatus requiredState) {
        require(requiredState == state(), Errors.WRONG_STATUS);
        _;
    }

    function loadNftData(mapping (uint32 => NftInfo) _nftData) external anyOwner onlyState(SaleStatus.Upcoming) {
        for ((uint32 key, NftInfo value) : _nftData) {
            require(key <= totalCount, Errors.WRONG_LOAD_DATA);
            nftData_[key] = value;         
        }
        _reserve();
        msg.sender.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });
    }

    function onTokenWallet(address _tokenWallet) external {
        require(msg.sender.value != 0 && msg.sender == tokenRoot, Errors.NOT_TOKEN_ROOT);
        tokenWallet = _tokenWallet;
        tokenWallet.transfer(0, false, MsgFlag.REMAINING_GAS + MsgFlag.IGNORE_ERRORS);
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

    function nftData() external view returns (mapping (uint32 => NftInfo)) {
        return nftData_;
    }

    function nftsOf(address _user) public returns (uint16[]) {
        return soldNfts.exists(_user) ? soldNfts.at(_user) : new uint16[](0);
    }

    function _reserve() private {
        tvm.rawReserve(Gas.INITIAL_BALANCE, 0);
    }

    function buildPayload(uint32 id, uint16 toNftNumber, address user) external pure returns(TvmCell) {
        TvmBuilder builder;
        builder.store(id);
        builder.store(toNftNumber);
        builder.store(user);
        return builder.toCell();
    }

    function onAcceptTokensTransfer(
        address /*tokenRoot*/,
        uint128 amount,
        address sender,
        address /*senderWallet*/,
        address remainingGasTo,
        TvmCell payload
    ) override external {
        require(msg.sender.value != 0 && msg.sender == tokenWallet);
        _reserve();

        uint32 id;
        address user;
        uint16 toNftNumber = totalCount;

        if (EventDataDecoder.isValid(payload)) {
            CreditEventData data = EventDataDecoder.decode(payload);
            user = data.user;
            (id, toNftNumber, user) = _decodePayload(data.layer3, sender);
        } else {
            (id, toNftNumber, user) = _decodePayload(payload, sender);
        }
        _buy(id, amount, toNftNumber, user, remainingGasTo);
    }

    function _decodePayload(TvmCell _payload, address sender) private returns (uint32, uint16, address) {

            uint32 id;
            address user = sender;
            uint16 toNftNumber = totalCount;

            TvmSlice payloadSlice = _payload.toSlice();

            if (payloadSlice.bits() >= 32) {
                id = payloadSlice.decode(uint32);
                if (payloadSlice.bits() >= 16) {
                    toNftNumber = payloadSlice.decode(uint16);
                    if (payloadSlice.bits() >= 267) {
                        user = payloadSlice.decode(address);
                    }
                }
            }
            return (id, toNftNumber, user);
    }

    function commonSoldCount() public view returns (uint16) {
        return (soldCount + soldCountDiscount + soldCountAirdrop);
    }

    function discountOf(address user) public returns (uint16) {
        optional(uint16) countDiscount = whiteList.fetch(user);
        return (countDiscount.hasValue())  ?  countDiscount.get() : 0;
    }

    function _refund(uint128 amount, address user, address remainingGasTo) private {
        TvmCell emptyPayload;
        if (tokenRoot == WEVER_ROOT) {
            ITokenWallet(msg.sender).transfer{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false }(
                amount,
                WEVER_VAULT,
                uint128(0),
                user,
                true,
                emptyPayload
            );
        } else {
            ITokenWallet(msg.sender).transfer{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false }(
                amount,
                user,
                Gas.DEPLOY_EMPTY_WALLET_GRAMS,
                remainingGasTo,
                true,
                emptyPayload
            );
        }
    }

    function _buy(uint32 id, uint128 amount, uint16 toNftNumber, address user, address remainingGasTo) private {
        if (state() == SaleStatus.Active && msg.value >= Gas.BUY_VALUE) {
            uint16[] currUserNfts = nftsOf(user);
            uint256 currUserNftsCount = currUserNfts.length;
            uint16 currSoldCount = soldCount;
            uint16 currSoldCountDiscount = soldCountDiscount;
            uint128 currAmount = amount;
            uint16 commonSoldCount = commonSoldCount();
            uint16 currCommonSoldCount = commonSoldCount;
            uint16 countDiscount = discountOf(user);
            uint16 currCountDiscount = countDiscount;

            while (currCountDiscount > 0 && currAmount >= discountPrice &&
                    currUserNftsCount < nftPerHand && currCommonSoldCount < totalCount) {
                        currAmount -= discountPrice;
                        currUserNftsCount++;
                        currUserNfts.push(currCommonSoldCount);
                        currSoldCountDiscount++;
                        currCommonSoldCount++;
                        currCountDiscount--;
            }

            if (currCountDiscount == 0) {
                delete whiteList[user];
            } else {
                whiteList[user] = currCountDiscount;
            }

            for (uint16 i = soldCount; i < toNftNumber; i++) {
                (,uint128 price) = priceRule.prevOrEq(currSoldCount).get();
                if (currAmount >= price && currUserNftsCount < nftPerHand && currCommonSoldCount < totalCount) {
                    currAmount -= price;
                    currUserNftsCount++;
                    currUserNfts.push(currCommonSoldCount);
                    currSoldCount++;
                    currCommonSoldCount++;
                } else {
                    break;
                }
            }
            if (commonSoldCount != currCommonSoldCount) {
                IMarketCallback(user).onSuccess{ 
                    value: Gas.CALLBACK_VALUE, flag: MsgFlag.SENDER_PAYS_FEES, bounce: false 
                }(id, commonSoldCount, currCommonSoldCount - 1);

                soldNfts[user] = currUserNfts;
                soldCount = currSoldCount;
                totalRaised += (amount - currAmount);
                soldCountDiscount = currSoldCountDiscount;

                if (currAmount > 0) {
                    _refund(currAmount, user, remainingGasTo);
                } else {
                    user.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });
                }
            } else {
                IMarketCallback(user).onCancel{ value: Gas.CALLBACK_VALUE + 1, flag: MsgFlag.SENDER_PAYS_FEES, bounce: false }(id);
                _refund(amount, user, remainingGasTo);
            }
        } else {
            IMarketCallback(user).onCancel{ value: Gas.CALLBACK_VALUE + 2, flag: MsgFlag.SENDER_PAYS_FEES, bounce: false }(id);
            _refund(amount, user, remainingGasTo);
        }
    }

    function onReceiveTONsFromBridgeCallback(CreditEventData _data) external override {
        _reserve();
        _data.user.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });
    }

    function onAcceptTokensBurn(
        uint128 amount,
        address /*walletOwner*/,
        address /*wallet*/,
        address user,
        TvmCell payload
    )  external {
        require(msg.sender.value != 0 && msg.sender == WEVER_ROOT, Errors.NOT_WEVER_ROOT);
        _reserve();

        uint64 id = 404;

        TvmSlice payloadSlice = payload.toSlice();
        if (payloadSlice.bits() >= 64) {
            id = payloadSlice.decode(uint64);
        }
        user.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });
   }

    function reveal() public onlyState(SaleStatus.SoldOut) {
        require(now >= revealDate || commonSoldCount() == totalCount, Errors.OPENING_TIME_NOT_YET);
        rnd.shuffle();
        startIndex.set(uint32(rnd.next(totalCount)));
        _reserve();
        msg.sender.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });
    }

    function withdraw(uint128 amount, address recipient) external onlyOwner onlyState(SaleStatus.Completed){
        require(recipient.value != 0, Errors.WRONG_RECIPIENT);
        require(totalWithdraw + amount <= totalRaised, Errors.WRONG_AMOUNT);
        require(msg.value >= Gas.WITHDRAW_VALUE, Errors.LOW_GAS);
        totalWithdraw += amount;
        _reserve();

        TvmCell emptyPayload;
        ITokenWallet(tokenWallet).transfer{ value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false }
            (amount, recipient, Gas.DEPLOY_EMPTY_WALLET_GRAMS, recipient, true, emptyPayload);
    }

    function _claimNfts(address user) private {
        uint16[] currUserNfts = nftsOf(user);
        uint256 currUserNftsCount = currUserNfts.length;
        require (currUserNftsCount > 0, Errors.USER_HAS_NO_NFTS); 
        require (!claimNft.exists(user), Errors.ALREADY_CLAIMED); 
        require(msg.value >= currUserNftsCount * Gas.CLAIM_VALUE + Gas.CLAIM_ADDITIONAL_GAS, Errors.LOW_GAS);
        
        for (uint32 userNft : currUserNfts) {
            uint32 newIdNft = (userNft + startIndex.get()) % totalCount;
            mintCount++;
            ICollection(collection).mintNft{ value: Gas.CLAIM_VALUE, flag: 1, bounce: false }(nftData_.at(newIdNft), user, newIdNft);
        }

        claimNft[user] = true;
        _reserve();
        msg.sender.transfer({ value: 0, flag: MsgFlag.ALL_NOT_RESERVED + MsgFlag.IGNORE_ERRORS, bounce: false });  
    }

    function claimNfts() external onlyState(SaleStatus.Completed) {
        _claimNfts(msg.sender);          
    }

    function claimNftsFor(address user) external anyOwner onlyState(SaleStatus.Completed) {
        _claimNfts(user);
    }

    function upgrade(TvmCell code) external onlyOwner {
        require(msg.value > Gas.UPGRADE_ACCOUNT_MIN_VALUE, Errors.LOW_GAS);
        _reserve();


        TvmCell data = abi.encode(
            owner(),
            managers(),
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
        );

        tvm.setcode(code);
        tvm.setCurrentCode(code);

        onCodeUpgrade(data);
    }

    function onCodeUpgrade(TvmCell data) private {
        
    }


}