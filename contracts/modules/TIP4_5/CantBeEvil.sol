pragma ton-solidity >=0.57.1;

import "./ICantBeEvil.sol";
import "../TIP6/TIP6.sol";

    enum LicenseVersion {
    CBE_CC0,
    CBE_ECR,
    CBE_NECR,
    CBE_NECR_HS,
    CBE_PR,
    CBE_PR_HS
}

contract CantBeEvil is ICantBeEvil, TIP6 {
    string internal constant _BASE_LICENSE_URI = "ar://_D9kN1WrNWbCq55BSAGRbTB4bS3v8QAPTYmBThSbX3A/";
    LicenseVersion public licenseVersion; // return string

    constructor(LicenseVersion _licenseVersion) public {
        licenseVersion = _licenseVersion;

        _supportedInterfaces[ bytes4(tvm.functionId(ITIP6.supportsInterface)) ] = true;
        _supportedInterfaces[
            bytes4(tvm.functionId(ICantBeEvil.getLicenseURI)) ^
            bytes4(tvm.functionId(ICantBeEvil.getLicenseName))
        ] = true;
    }

    function getLicenseURI() public view override returns (string) {
        return format("{}{}", _BASE_LICENSE_URI, uint(licenseVersion));
    }

    function getLicenseName() public view override returns (string) {
        return _getLicenseVersionKeyByValue(licenseVersion);
    }

    function _getLicenseVersionKeyByValue(LicenseVersion _licenseVersion) internal pure returns (string) {
        require(uint8(_licenseVersion) <= 6);
        if (LicenseVersion.CBE_CC0 == _licenseVersion) return "CBE_CC0";
        if (LicenseVersion.CBE_ECR == _licenseVersion) return "CBE_ECR";
        if (LicenseVersion.CBE_NECR == _licenseVersion) return "CBE_NECR";
        if (LicenseVersion.CBE_NECR_HS == _licenseVersion) return "CBE_NECR_HS";
        if (LicenseVersion.CBE_PR == _licenseVersion) return "CBE_PR";
        else return "CBE_PR_HS";
    }
}