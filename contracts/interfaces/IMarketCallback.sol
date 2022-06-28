pragma ton-solidity >=0.57.1;

interface IMarketCallback {
    function onCancel(uint32 id) external;
    function onSuccess(uint32 id, uint16 from, uint16 to) external;
}