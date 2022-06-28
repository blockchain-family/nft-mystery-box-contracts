pragma ton-solidity >= 0.57.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./OwnableInternal.sol";
import "@broxus/contracts/contracts/_ErrorCodes.sol";

abstract contract MultiOwner is OwnableInternal {
    address[] private managers_;

    event ManagerAdded(address newManager);
    event ManagersReset();

    constructor (address _owner, address[] _managers) 
        public 
		OwnableInternal(_owner)
    {
        managers_ = _managers;
    }

    modifier anyOwner() {
        require(isAnyOwner(), _ErrorCodes.NOT_OWNER);
        _;
    }

    function addManager(address newManager) external onlyOwner {
        require(newManager.value != 0, _ErrorCodes.ZERO_OWNER);
        managers_.push(newManager);
        emit ManagerAdded(newManager);
    }

    function resetManagers() external onlyOwner {
        managers_ = new address[](0);
        emit ManagersReset();
    }

    function managers() public view virtual returns (address[]) {
        return managers_;
    }

    function isAnyOwner() internal returns(bool) {
        if (msg.sender == owner()) {
            return true;
        }
        for (uint i = 0; i < managers_.length; i++) {
            if(managers_[i] == msg.sender)
            {
                return true;
            }
        }
        return false;
    }
}