pragma ton-solidity >=0.57.1;

import "../structures/INftInfoStructure.sol";

interface ICollection is INftInfoStructure{
    function mintNft(NftInfo _nftInfo, address _owner, uint32 _nftId) external;
}