# BlackBox Storage

BlackBox Storage is a privacy-preserving file index that stores encrypted IPFS-style CIDs and encrypted addresses on
chain. The actual file never leaves your machine. You generate a CID locally, encrypt it with a random EVM address,
encrypt that address with Zama FHE, and store the ciphertexts on Sepolia. Later, only the owner can decrypt the address
and recover the CID.

## Project Summary

BlackBox Storage solves the problem of keeping file references private while still benefiting from on-chain persistence.
Instead of publishing a plaintext CID, the app stores:

- A human-readable file name.
- An AES-GCM encrypted CID (encrypted with a random EVM address A).
- An FHE-encrypted address A (stored as `eaddress`).
- A timestamp for when the record was created.

This creates a two-layer privacy model:

1. The CID is hidden by symmetric encryption.
2. The symmetric key is derived from address A.
3. Address A itself is encrypted on-chain with Zama FHE and only the owner can decrypt it.

## Problems This Project Solves

- **CID exposure**: Plaintext CIDs reveal content-addressed metadata. This keeps CIDs private on-chain.
- **Key management complexity**: The key is derived from an EVM address that is itself stored as FHE ciphertext.
- **On-chain indexing without leaking data**: You can list, count, and timestamp stored files without revealing content.
- **End-to-end local handling**: Files never leave the client. CIDs are computed locally; no external upload is required.

## Key Advantages

- **Two-layer privacy**: CID encryption + FHE encryption of the CID key.
- **User-controlled access**: Only the owner can decrypt the encrypted address A.
- **No file upload required**: The CID is generated locally; storage is a metadata index only.
- **Deterministic workflow**: Every step is explicit and inspectable (CID, encryption, storage, decrypt).
- **Minimal on-chain footprint**: Stores compact metadata, not file blobs.
- **Composable**: You can later attach real IPFS uploads without changing the on-chain model.

## How It Works (End-to-End Flow)

1. **Select a local file** in the UI.
2. **Generate a CIDv0 locally** by hashing file bytes with SHA-256 and encoding in base58.
3. **Create a random EVM address A** on the client.
4. **Encrypt the CID** with AES-256-GCM using a key derived from address A.
5. **Encrypt address A with Zama FHE** and send it to the contract as `externalEaddress`.
6. **Store** the file name, encrypted CID, encrypted address A, and timestamp on-chain.
7. **List files** by reading the owner's file count and individual records.
8. **Decrypt** address A with the Zama relayer and the owner's signature.
9. **Decrypt the CID** locally with AES-256-GCM and the recovered address A.

## What Is and Is Not Stored

Stored on-chain:

- File name (plaintext).
- Encrypted CID (AES-GCM).
- Encrypted address A (`eaddress`).
- `createdAt` timestamp.

Not stored on-chain:

- File contents.
- Plaintext CID.
- Plaintext address A.

## Tech Stack

Smart contracts:

- Solidity `0.8.27`
- Hardhat + hardhat-deploy
- Zama FHEVM libraries (`@fhevm/solidity`)
- TypeChain (ethers v6 target)

Frontend:

- React + Vite
- RainbowKit + wagmi
- viem (read calls)
- ethers (write calls)
- Zama relayer SDK (`@zama-fhe/relayer-sdk`)
- Plain CSS (no Tailwind)

## Architecture

On-chain contract (`contracts/BlackBoxStorage.sol`):

- `FileRecord`: `fileName`, `encryptedIpfsHash`, `encryptedAddressA`, `createdAt`
- `addFile(...)` stores a new record and grants FHE access to the owner
- `getFileCount(owner)` returns the number of files for a given address
- `getFile(owner, index)` returns a specific record
- Emits `FileAdded(owner, index, fileName)`

CLI tasks (`tasks/BlackBoxStorage.ts`):

- `task:storage-address` prints the deployed address
- `task:storage-add-file` generates a pseudo CID and encrypts it
- `task:storage-list` decrypts stored CIDs via Zama

Frontend (`ui/`):

- Upload tab: select file, compute CID, encrypt, store on-chain
- My files tab: read records, decrypt address A, decrypt CID locally
- Contract address is entered manually to avoid hardcoding

## Repository Structure

```
contracts/        Smart contracts (BlackBoxStorage, FHECounter example)
deploy/           Hardhat deploy scripts
tasks/            Hardhat tasks for CLI workflows
test/             Unit and Sepolia tests
docs/             Zama FHE references for this repo
ui/               React frontend (Vite)
deployments/      Deployment artifacts and ABI outputs
```

## Setup and Usage

### Prerequisites

- Node.js 20+
- npm
- A Sepolia RPC key (Infura) and a funded Sepolia private key

### Install Dependencies

```bash
npm install
```

### Configure Environment

Create `.env` in the repo root:

```bash
INFURA_API_KEY=your_infura_project_id
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=optional_for_verification
```

### Compile and Test

```bash
npm run compile
npm run test
```

### Deploy Locally

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

### Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
```

### CLI Workflow Examples

```bash
# Print deployment address
npx hardhat task:storage-address --network sepolia

# Add a file record (pseudo CID generated if not provided)
npx hardhat task:storage-add-file --name "example.png" --network sepolia

# List and decrypt your records
npx hardhat task:storage-list --network sepolia
```

### Frontend Usage

```bash
cd ui
npm install
npm run dev
```

Then:

1. Connect a wallet on Sepolia.
2. Enter the deployed `BlackBoxStorage` contract address.
3. Upload a file, compute a CID, and store it.
4. Switch to "My files" and decrypt stored CIDs.

### ABI Sync (Important)

The frontend ABI must match the deployed contract ABI:

- Copy the ABI from `deployments/sepolia/BlackBoxStorage.json`.
- Paste it into `ui/src/config/contracts.ts` as `BLACKBOX_STORAGE_ABI`.

## Security and Privacy Notes

- CID encryption uses AES-256-GCM with a key derived from address A.
- Address A is stored on-chain as FHE ciphertext and is only decryptable by the owner.
- The file itself never leaves the client; this is a metadata index.
- File names are plaintext and are visible on-chain.
- If the owner shares address A, the CID can be decrypted by others.

## Future Roadmap

- Real IPFS upload (optional) alongside the local CID generation flow.
- Batch uploads and folder-level metadata.
- Sharing controls (grant/revoke decryption to other addresses).
- Activity indexing and filtering by name, date, or custom tags.
- Support for additional FHE-encrypted metadata (size, type, tags).
- Mainnet deployment path and multi-chain support.
- Optional storage fee or subscription model for long-term indexing.

## License

BSD-3-Clause-Clear. See `LICENSE`.
