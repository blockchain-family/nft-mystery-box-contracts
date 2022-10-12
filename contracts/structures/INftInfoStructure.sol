pragma ton-solidity >=0.57.1;

interface INftInfoStructure {

    struct Attributes {
        string trait_type;
        string  value;
    }

    struct NftInfo {
        string name;
        string description;
        string previewUrl;
        string ipfsUrl;
        Attributes[] attributes;
        string externalUrl;
    }
}