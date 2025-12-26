export const DEFAULT_CONTRACT_ADDRESS = '0xfcC9275bD14E7e5e799986abfFd5e36f3F277396';

export const BLACKBOX_STORAGE_ABI = [
  {
    "inputs": [],
    "name": "EmptyEncryptedIpfsHash",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EmptyFileName",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidIndex",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZamaProtocolUnsupported",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "index", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "fileName", "type": "string" }
    ],
    "name": "FileAdded",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "fileName", "type": "string" },
      { "internalType": "bytes", "name": "encryptedIpfsHash", "type": "bytes" },
      { "internalType": "externalEaddress", "name": "encryptedAddressA", "type": "bytes32" },
      { "internalType": "bytes", "name": "inputProof", "type": "bytes" }
    ],
    "name": "addFile",
    "outputs": [{ "internalType": "uint256", "name": "index", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "confidentialProtocolId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "uint256", "name": "index", "type": "uint256" }
    ],
    "name": "getFile",
    "outputs": [
      { "internalType": "string", "name": "fileName", "type": "string" },
      { "internalType": "bytes", "name": "encryptedIpfsHash", "type": "bytes" },
      { "internalType": "eaddress", "name": "encryptedAddressA", "type": "bytes32" },
      { "internalType": "uint64", "name": "createdAt", "type": "uint64" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
    "name": "getFileCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
