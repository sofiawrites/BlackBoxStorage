import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { ethers } from "ethers";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function normalizeBytes32Handle(handle: unknown): string {
  if (typeof handle === "string") return handle;
  return ethers.toBeHex(handle as any, 32);
}

function base58Encode(bytes: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = 0n;
  for (const b of bytes) value = value * 256n + BigInt(b);
  let encoded = "";
  while (value > 0n) {
    const mod = value % 58n;
    encoded = alphabet[Number(mod)] + encoded;
    value /= 58n;
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) encoded = "1" + encoded;
  return encoded || "1";
}

function randomCidV0(): string {
  const digest = randomBytes(32);
  const multihash = Buffer.concat([Buffer.from([0x12, 0x20]), digest]); // sha2-256 + 32 bytes
  return base58Encode(multihash);
}

function addressToKey(address: string): Buffer {
  const addrBytes = Buffer.from(address.replace(/^0x/, "").toLowerCase(), "hex");
  return createHash("sha256").update(addrBytes).digest();
}

function encryptWithAddress(address: string, plaintext: string): string {
  const key = addressToKey(address);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([Buffer.from([0x01]), iv, ciphertext, tag]);
  return `0x${payload.toString("hex")}`;
}

function decryptWithAddress(address: string, encryptedHex: string): string {
  const payload = Buffer.from(encryptedHex.replace(/^0x/, ""), "hex");
  if (payload.length < 1 + 12 + 16) throw new Error("Invalid encrypted payload");
  if (payload[0] !== 0x01) throw new Error("Unsupported payload version");
  const iv = payload.subarray(1, 13);
  const ciphertextWithTag = payload.subarray(13);
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
  const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
  const key = addressToKey(address);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

async function resolveStorageAddress(hre: any, addressOverride?: string): Promise<string> {
  if (addressOverride) return addressOverride;
  const deployment = await hre.deployments.get("BlackBoxStorage");
  return deployment.address;
}

task("task:storage-address", "Prints the BlackBoxStorage address").setAction(async function (_args: TaskArguments, hre) {
  const address = await resolveStorageAddress(hre);
  console.log(`BlackBoxStorage address is ${address}`);
});

task("task:storage-add-file", "Adds a file record to BlackBoxStorage")
  .addParam("name", "The file name to store")
  .addOptionalParam("cid", "Optionally provide an IPFS-like CID string")
  .addOptionalParam("address", "Optionally specify the BlackBoxStorage contract address")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers: hardhatEthers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const contractAddress = await resolveStorageAddress(hre, args.address);
    const [signer] = await hardhatEthers.getSigners();

    const cid = (args.cid as string | undefined) ?? randomCidV0();
    const tempWallet = ethers.Wallet.createRandom();
    const addressA = tempWallet.address;

    const encryptedIpfsHash = encryptWithAddress(addressA, cid);

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signer.address)
      .addAddress(addressA)
      .encrypt();

    const contract = await hardhatEthers.getContractAt("BlackBoxStorage", contractAddress);
    const tx = await contract
      .connect(signer)
      .addFile(args.name, encryptedIpfsHash, encryptedInput.handles[0], encryptedInput.inputProof);

    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`Stored name="${args.name}" cid="${cid}" with encrypted addressA handle=${encryptedInput.handles[0]}`);
  });

task("task:storage-list", "Lists your stored file records and decrypts the CID")
  .addOptionalParam("address", "Optionally specify the BlackBoxStorage contract address")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers: hardhatEthers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const contractAddress = await resolveStorageAddress(hre, args.address);
    const [signer] = await hardhatEthers.getSigners();

    const contract = await hardhatEthers.getContractAt("BlackBoxStorage", contractAddress);
    const count: bigint = await contract.getFileCount(signer.address);
    console.log(`BlackBoxStorage=${contractAddress} owner=${signer.address} count=${count}`);

    for (let i = 0n; i < count; i++) {
      const [fileName, encryptedIpfsHash, encryptedAddressA, createdAt] = await contract.getFile(signer.address, i);
      const encryptedAddressAHandle = normalizeBytes32Handle(encryptedAddressA);
      const addressA = await fhevm.userDecryptEaddress(encryptedAddressAHandle, contractAddress, signer);
      const cid = decryptWithAddress(addressA, encryptedIpfsHash);
      console.log(
        `#${i} name="${fileName}" createdAt=${createdAt.toString()} addressA=${addressA} cid="${cid}" encryptedHash=${encryptedIpfsHash}`,
      );
    }
  });
