pragma ton-solidity >=0.57.1;

import '../TIP6/ITIP6.sol';

interface ICantBeEvil is ITIP6{
    function getLicenseURI() external view returns (string);
    function getLicenseName() external view returns (string);
}