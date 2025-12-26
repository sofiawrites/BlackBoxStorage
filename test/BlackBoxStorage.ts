import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { BlackBoxStorage, BlackBoxStorage__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

function normalizeBytes32Handle(handle: unknown): string {
  if (typeof handle === "string") return handle;
  return ethers.toBeHex(handle as any, 32);
}

async function deployFixture() {
  const factory = (await ethers.getContractFactory("BlackBoxStorage")) as BlackBoxStorage__factory;
  const contract = (await factory.deploy()) as BlackBoxStorage;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

describe("BlackBoxStorage", function () {
  let signers: Signers;
  let contract: BlackBoxStorage;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("stores file metadata and encrypted addressA", async function () {
    const fileName = "example.png";
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

    expect(await contract.getFileCount(signers.alice.address)).to.eq(1n);

    const [storedName, storedEncryptedHash, storedEncryptedAddressA, createdAt] = await contract.getFile(
      signers.alice.address,
      0,
    );

    expect(storedName).to.eq(fileName);
    expect(storedEncryptedHash).to.eq(encryptedIpfsHash);
    expect(storedEncryptedAddressA).to.not.eq(ethers.ZeroHash);
    expect(createdAt).to.be.greaterThan(0n);

    const encryptedAddressAHandle = normalizeBytes32Handle(storedEncryptedAddressA);
    const decryptedAddressA = await fhevm.userDecryptEaddress(
      encryptedAddressAHandle,
      contractAddress,
      signers.alice,
    );
    expect(decryptedAddressA.toLowerCase()).to.eq(addressA.toLowerCase());
  });
});
