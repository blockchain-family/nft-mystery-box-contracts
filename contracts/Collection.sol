pragma ton-solidity =0.57.1;

pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;

import "./modules/TIP4_3/TIP4_3Collection.sol";
import "./modules/TIP4_2/TIP4_2Collection.sol";
import "./modules/access/MultiOwner.sol";
import "./Nft.sol";
import './libraries/Gas.sol';
import './errors/Errors.sol';
import "./interfaces/ICollection.sol";

contract Collection is TIP4_3Collection, TIP4_2Collection, MultiOwner, ICollection {

	uint64 static nonce_;

	/// _remainOnNft - the number of EVERs that will remain after the entire mint
	/// process is completed on the Nft contract
	uint128 _remainOnNft;
	uint256 _totalMinted;

	constructor(
		TvmCell codeNft,
		TvmCell codeIndex,
		TvmCell codeIndexBasis,
		address owner,
		address[] managers,
		uint128 remainOnNft,
        string json
	)
		public
		MultiOwner(owner, managers)
		TIP4_1Collection(codeNft)
		TIP4_2Collection(json)
		TIP4_3Collection(codeIndex, codeIndexBasis)
	{
		tvm.accept();
		tvm.rawReserve(Gas.INITIAL_BALANCE, 0);
		_remainOnNft = remainOnNft;
	}

	function mintNft(NftInfo _nftInfo, address _owner, uint32 _nftId) public override virtual anyOwner {
		require(
			msg.value > _remainOnNft + Gas.MINT_VALUE,
			109
		);
		string json = "{\"type\": \"Broxus NFT\", \"id\":" + format("{}", _nftId) + 
						",\"name\":" + _nftInfo.name + 
						", \"description\":" + _nftInfo.description + 
						",\"preview\": { \"source\":" + _nftInfo.previewUrl + 
						", \"mimetype\": \"image/png\" }, \"files\": [ { \"source\":" + _nftInfo.ipfsUrl + 
						", \"mimetype\": \"image/png\" }],\"params\": [\"p1\":" + _nftInfo.param1 + 
						",\"p2\":" + _nftInfo.param2 + 
						"],\"external_url\": \"https://everscale.network\"}";


		tvm.rawReserve(Gas.INITIAL_BALANCE, 0);
		_mintNft(_owner, json, 0, 128);
	}

	function totalMinted() external view responsible returns (uint256 count) {
		return {value: 0, flag: 64, bounce: false} (_totalMinted);
	}

	function _mintNft(address owner, string json, uint128 value, uint16 flag) internal virtual {

		uint256 id = uint256(_totalMinted);
		_totalMinted++;
		_totalSupply++;

		TvmCell codeNft = _buildNftCode(address(this));
		TvmCell stateNft = _buildNftState(codeNft, id);
		address nftAddr = new Nft{stateInit: stateNft, value: value, flag: flag}(
			owner,
			msg.sender,
			_remainOnNft,
			json,
			_indexDeployValue,
			_indexDestroyValue,
			_codeIndex
		);

		emit NftCreated(id, nftAddr, owner, msg.sender, msg.sender);
	}

	function setRemainOnNft(uint128 remainOnNft) external virtual onlyOwner {
		_remainOnNft = remainOnNft;
	}

	function _buildNftState(TvmCell code, uint256 id)
		internal
		pure
		virtual
		override (TIP4_2Collection, TIP4_3Collection)
		returns (TvmCell)
	{
		return tvm.buildStateInit({contr: Nft, varInit: {_id: id}, code: code});
	}

	function resolveIndexCodeHash(address collection, address owner) public view returns (uint256 hash) {
		TvmCell code = _buildIndexCode(collection, owner);
		return tvm.hash(code);
	}

}
