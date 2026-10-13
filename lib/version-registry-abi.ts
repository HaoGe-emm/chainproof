// Generated from Solidity 0.8.20; do not edit by hand.
export const versionRegistryAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "original",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "HashAlreadyLinked",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "IntegerLimit",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidOriginalRegistry",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotController",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotOriginalRegistrant",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OriginalProofNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OriginalRegistryUnavailable",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UnexpectedPreviousVersion",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "VersionOutOfRange",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "WorkNotFound",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "workId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "controller",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "fileHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "versionNumber",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "previousVersionNumber",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "VersionAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "workId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "controller",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "fileHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "versionNumber",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "WorkCreated",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "workId",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "fileHash",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "expectedPreviousVersionNumber",
        "type": "uint256"
      }
    ],
    "name": "addVersion",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "initialFileHash",
        "type": "bytes32"
      }
    ],
    "name": "createWork",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "workId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "workId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "versionNumber",
        "type": "uint256"
      }
    ],
    "name": "getVersion",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "fileHash",
            "type": "bytes32"
          },
          {
            "internalType": "uint64",
            "name": "previousVersionNumber",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "associatedAt",
            "type": "uint64"
          }
        ],
        "internalType": "struct ChainProofVersionRegistry.Version",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "workId",
        "type": "uint256"
      }
    ],
    "name": "getVersionCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "workId",
        "type": "uint256"
      }
    ],
    "name": "getWork",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "controller",
            "type": "address"
          },
          {
            "internalType": "uint64",
            "name": "createdAt",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "versionCount",
            "type": "uint64"
          }
        ],
        "internalType": "struct ChainProofVersionRegistry.Work",
        "name": "work",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "workId",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "fileHash",
        "type": "bytes32"
      }
    ],
    "name": "isHashLinked",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextWorkId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "originalRegistry",
    "outputs": [
      {
        "internalType": "contract IChainProof",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
