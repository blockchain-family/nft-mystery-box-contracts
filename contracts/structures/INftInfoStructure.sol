pragma ton-solidity >=0.57.1;

interface INftInfoStructure {

    struct NftInfo {
        string name;
        string description;
        string previewUrl;
        string ipfsUrl;
        string param1;
        string param2;
    }
}