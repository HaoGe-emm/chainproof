// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IChainProof {
    function getProof(bytes32 fileHash) external view returns (address owner, uint256 timestamp, bool exists);
}

/// @notice Append-only wallet-authorized associations, not copyright or authorship evidence.
contract ChainProofVersionRegistry {
    struct Work {
        address controller;
        uint64 createdAt;
        uint64 versionCount;
    }
    struct Version {
        bytes32 fileHash;
        uint64 previousVersionNumber;
        uint64 associatedAt;
    }

    IChainProof public immutable originalRegistry;
    uint256 public nextWorkId = 1;
    mapping(uint256 => Work) private works;
    mapping(uint256 => mapping(uint256 => Version)) private versions;
    mapping(uint256 => mapping(bytes32 => bool)) private linked;

    error InvalidOriginalRegistry();
    error OriginalRegistryUnavailable();
    error OriginalProofNotFound();
    error NotOriginalRegistrant();
    error WorkNotFound();
    error NotController();
    error HashAlreadyLinked();
    error UnexpectedPreviousVersion();
    error VersionOutOfRange();
    error IntegerLimit();

    event WorkCreated(uint256 indexed workId, address indexed controller, bytes32 fileHash, uint256 versionNumber, uint256 timestamp);
    event VersionAdded(uint256 indexed workId, address indexed controller, bytes32 indexed fileHash, uint256 versionNumber, uint256 previousVersionNumber, uint256 timestamp);

    constructor(address original) {
        if (original.code.length == 0) revert InvalidOriginalRegistry();
        // Shape/consistency probe; no interface probe can prove a malicious registry honest.
        try IChainProof(original).getProof(bytes32(0)) returns (address owner, uint256 timestamp, bool exists) {
            if (exists != (timestamp != 0) || (exists && owner == address(0))) revert InvalidOriginalRegistry();
        } catch { revert InvalidOriginalRegistry(); }
        originalRegistry = IChainProof(original);
    }

    function createWork(bytes32 initialFileHash) external returns (uint256 workId) {
        checkOriginal(initialFileHash);
        workId = nextWorkId++;
        uint64 timestamp = currentTime();
        works[workId] = Work(msg.sender, timestamp, 1);
        versions[workId][1] = Version(initialFileHash, 0, timestamp);
        linked[workId][initialFileHash] = true;
        emit WorkCreated(workId, msg.sender, initialFileHash, 1, timestamp);
        emit VersionAdded(workId, msg.sender, initialFileHash, 1, 0, timestamp);
    }

    function addVersion(uint256 workId, bytes32 fileHash, uint256 expectedPreviousVersionNumber) external {
        Work storage work = works[workId];
        if (work.controller == address(0)) revert WorkNotFound();
        if (work.controller != msg.sender) revert NotController();
        checkOriginal(fileHash);
        if (linked[workId][fileHash]) revert HashAlreadyLinked();
        if (expectedPreviousVersionNumber != work.versionCount) revert UnexpectedPreviousVersion();
        if (work.versionCount == type(uint64).max) revert IntegerLimit();
        uint64 number = work.versionCount + 1;
        uint64 timestamp = currentTime();
        versions[workId][number] = Version(fileHash, work.versionCount, timestamp);
        linked[workId][fileHash] = true;
        work.versionCount = number;
        emit VersionAdded(workId, msg.sender, fileHash, number, number - 1, timestamp);
    }

    function getWork(uint256 workId) public view returns (Work memory work) {
        work = works[workId];
        if (work.controller == address(0)) revert WorkNotFound();
    }
    function getVersion(uint256 workId, uint256 versionNumber) external view returns (Version memory) {
        Work memory work = getWork(workId);
        if (versionNumber == 0 || versionNumber > work.versionCount) revert VersionOutOfRange();
        return versions[workId][versionNumber];
    }
    function getVersionCount(uint256 workId) external view returns (uint256) { return getWork(workId).versionCount; }
    function isHashLinked(uint256 workId, bytes32 fileHash) external view returns (bool) { getWork(workId); return linked[workId][fileHash]; }

    function checkOriginal(bytes32 fileHash) private view {
        try originalRegistry.getProof(fileHash) returns (address owner, uint256 timestamp, bool exists) {
            if (!exists || timestamp == 0) revert OriginalProofNotFound();
            if (owner != msg.sender) revert NotOriginalRegistrant();
        } catch { revert OriginalRegistryUnavailable(); }
    }
    function currentTime() private view returns (uint64) {
        if (block.timestamp == 0 || block.timestamp > type(uint64).max) revert IntegerLimit();
        return uint64(block.timestamp);
    }
}
