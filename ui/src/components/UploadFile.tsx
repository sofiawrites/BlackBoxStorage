import { useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract, Wallet } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { BLACKBOX_STORAGE_ABI } from '../config/contracts';
import { computeCidV0FromFile, describeFile } from '../utils/ipfs';
import { encryptUtf8WithAddress } from '../utils/encryption';
import '../styles/UploadFile.css';

type Props = {
  contractAddress: string;
};

export function UploadFile({ contractAddress }: Props) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [cid, setCid] = useState<string>('');
  const [isHashing, setIsHashing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');

  const canUseContract = useMemo(() => !!contractAddress && !!address && !!instance && !!signerPromise, [
    contractAddress,
    address,
    instance,
    signerPromise,
  ]);

  const reset = () => {
    setFile(null);
    setFileName('');
    setCid('');
    setIsHashing(false);
    setIsSubmitting(false);
    setTxHash('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSelectFile = async (selected: File | undefined) => {
    setError('');
    setTxHash('');
    setCid('');
    setFile(selected ?? null);
    setFileName(selected?.name ?? '');
  };

  const generateCid = async () => {
    if (!file) return;
    setError('');
    setIsHashing(true);
    try {
      const computed = await computeCidV0FromFile(file);
      setCid(computed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compute CID');
    } finally {
      setIsHashing(false);
    }
  };

  const submit = async () => {
    if (!file || !fileName) {
      setError('Select a file first');
      return;
    }
    if (!cid) {
      setError('Generate the CID first');
      return;
    }
    if (!canUseContract) {
      setError('Connect wallet, initialize Zama, and set a valid contract address');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setTxHash('');

    try {
      const addressA = Wallet.createRandom().address;
      const encryptedIpfsHash = await encryptUtf8WithAddress(addressA, cid);

      const input = instance.createEncryptedInput(contractAddress, address);
      input.addAddress(addressA);
      const encryptedInput = await input.encrypt();

      const signer = await signerPromise;
      if (!signer) throw new Error('Signer not available');

      const contract = new Contract(contractAddress, BLACKBOX_STORAGE_ABI, signer);
      const tx = await contract.addFile(fileName, encryptedIpfsHash, encryptedInput.handles[0], encryptedInput.inputProof);
      setTxHash(tx.hash);
      await tx.wait();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="upload">
      {zamaError && <div className="notice error">Zama init error: {zamaError}</div>}
      {!contractAddress && <div className="notice">Enter a valid contract address to start.</div>}

      <div className="upload-grid">
        <div className="card">
          <h3 className="card-title">1) Select local file</h3>
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            onChange={(e) => onSelectFile(e.target.files?.[0])}
          />
          {file && <div className="hint">Selected: <span className="mono">{describeFile(file)}</span></div>}

          <label className="label" htmlFor="fileName">
            File name saved on-chain
          </label>
          <input
            id="fileName"
            className="text-input"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="example.png"
            autoComplete="off"
          />
        </div>

        <div className="card">
          <h3 className="card-title">2) Generate IPFS-like CID</h3>
          <p className="card-help">
            This computes a CIDv0 locally from file content. No network upload happens.
          </p>
          <button className="button" type="button" disabled={!file || isHashing} onClick={generateCid}>
            {isHashing ? 'Computing…' : 'Compute CID'}
          </button>
          {cid && (
            <div className="result">
              <div className="result-label">CID</div>
              <div className="mono wrap">{cid}</div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">3) Encrypt and store on-chain</h3>
          <p className="card-help">
            A random EVM address A is generated locally. The CID is encrypted with A, and A is stored as an FHE-encrypted
            ciphertext on-chain.
          </p>
          <button
            className="button primary"
            type="button"
            onClick={submit}
            disabled={!canUseContract || !file || !fileName || !cid || zamaLoading || isSubmitting}
          >
            {isSubmitting ? 'Submitting…' : 'Save to chain'}
          </button>

          {txHash && (
            <div className="result">
              <div className="result-label">Transaction</div>
              <div className="mono wrap">{txHash}</div>
            </div>
          )}

          {error && <div className="notice error">{error}</div>}

          <button className="link-button" type="button" onClick={reset} disabled={isSubmitting}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

