// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ChainProof {
    struct Proof {
        address owner;
        uint256 timestamp;
    }

    // A file's SHA-256 digest is used directly as the bytes32 key.
    mapping(bytes32 => Proof) private proofs;

    event ProofRegistered(
        bytes32 indexed fileHash,
        address indexed owner,
        uint256 timestamp
    );

    function registerProof(bytes32 fileHash) external {
        require(proofs[fileHash].timestamp == 0, "Proof already exists");

        proofs[fileHash] = Proof(msg.sender, block.timestamp);
        emit ProofRegistered(fileHash, msg.sender, block.timestamp);
    }

    function getProof(bytes32 fileHash)
        external
        view
        returns (address owner, uint256 timestamp, bool exists)
    {
        Proof memory proof = proofs[fileHash];
        return (proof.owner, proof.timestamp, proof.timestamp != 0);
    }
}
