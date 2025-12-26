import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments, ethers, fhevm } from "hardhat";
import { BlackBoxStorage } from "../types";

type Signers = {
  alice: HardhatEthersSigner;
};

function normalizeBytes32Handle(handle: unknown): string {
  if (typeof handle === "string") return handle;
  return ethers.toBeHex(handle as any, 32);
}

describe("BlackBoxStorageSepolia", function () {
  let signers: Signers;
  let contract: BlackBoxStorage;
  let contractAddress: string;

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("BlackBoxStorage");
      contractAddress = deployment.address;
      contract = await ethers.getContractAt("BlackBoxStorage", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  it("stores and decrypts addressA", async function () {
    this.timeout(4 * 40000);

    const beforeCount: bigint = await contract.getFileCount(signers.alice.address);

    const fileName = `sepolia-${Date.now()}.txt`;
    const encryptedIpfsHash = ethers.hexlify(ethers.toUtf8Bytes("0x01:encrypted-payload"));

    const addressA = ethers.Wallet.createRandom().address;
    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .addAddress(addressA)
      .encrypt();

    const tx = await contract
      .connect(signers.alice)
      .addFile(fileName, encryptedIpfsHash, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const afterCount: bigint = await contract.getFileCount(signers.alice.address);
    expect(afterCount).to.eq(beforeCount + 1n);

    const [storedName, _storedEncryptedHash, storedEncryptedAddressA] = await contract.getFile(
      signers.alice.address,
      afterCount - 1n,
    );
    expect(storedName).to.eq(fileName);

    const encryptedAddressAHandle = normalizeBytes32Handle(storedEncryptedAddressA);
    const decryptedAddressA = await fhevm.userDecryptEaddress(
      encryptedAddressAHandle,
      contractAddress,
      signers.alice,
    );
    expect(decryptedAddressA.toLowerCase()).to.eq(addressA.toLowerCase());
  });
});
