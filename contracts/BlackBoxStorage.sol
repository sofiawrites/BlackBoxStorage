// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract BlackBoxStorage is ZamaEthereumConfig {
    struct FileRecord {
        string fileName;
        bytes encryptedIpfsHash;
        eaddress encryptedAddressA;
        uint64 createdAt;
    }

    mapping(address => FileRecord[]) private _files;

    event FileAdded(address indexed owner, uint256 indexed index, string fileName);

    error EmptyFileName();
    error EmptyEncryptedIpfsHash();
    error InvalidIndex();

    function addFile(
        string calldata fileName,
        bytes calldata encryptedIpfsHash,
        externalEaddress encryptedAddressA,
        bytes calldata inputProof
    ) external returns (uint256 index) {
        if (bytes(fileName).length == 0) revert EmptyFileName();
        if (encryptedIpfsHash.length == 0) revert EmptyEncryptedIpfsHash();

        eaddress addressA = FHE.fromExternal(encryptedAddressA, inputProof);

        index = _files[msg.sender].length;
        _files[msg.sender].push(
            FileRecord({
                fileName: fileName,
                encryptedIpfsHash: encryptedIpfsHash,
                encryptedAddressA: addressA,
                createdAt: uint64(block.timestamp)
            })
        );

        FileRecord storage record = _files[msg.sender][index];
        FHE.allowThis(record.encryptedAddressA);
        FHE.allow(record.encryptedAddressA, msg.sender);

        emit FileAdded(msg.sender, index, fileName);
    }

    function getFileCount(address owner) external view returns (uint256) {
        return _files[owner].length;
    }

    function getFile(
        address owner,
        uint256 index
    )
        external
        view
        returns (string memory fileName, bytes memory encryptedIpfsHash, eaddress encryptedAddressA, uint64 createdAt)
    {
        if (index >= _files[owner].length) revert InvalidIndex();
        FileRecord storage record = _files[owner][index];
        return (record.fileName, record.encryptedIpfsHash, record.encryptedAddressA, record.createdAt);
    }
}

