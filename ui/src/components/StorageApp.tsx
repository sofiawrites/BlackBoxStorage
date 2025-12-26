import { useMemo, useState } from 'react';
import { isAddress } from 'ethers';
import { useAccount } from 'wagmi';
import { Header } from './Header';
import { DEFAULT_CONTRACT_ADDRESS } from '../config/contracts';
import { UploadFile } from './UploadFile';
import { MyFiles } from './MyFiles';
import '../styles/StorageApp.css';

type Tab = 'upload' | 'files';

export function StorageApp() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [contractAddress, setContractAddress] = useState<string>(DEFAULT_CONTRACT_ADDRESS);

  const contractAddressValid = useMemo(() => isAddress(contractAddress), [contractAddress]);

  return (
    <div className="storage-app">
      <Header />

      <main className="storage-main">
        <div className="storage-card">
          <div className="storage-card-header">
            <div>
              <h2 className="storage-title">Your encrypted file index</h2>
              <p className="storage-subtitle">
                Select a local file, generate an IPFS-like CID, encrypt it with a random address, then store the
                encrypted CID and an FHE-encrypted address on Sepolia.
              </p>
            </div>
          </div>

          <div className="storage-form-row">
            <label className="storage-label" htmlFor="contractAddress">
              Contract address (Sepolia)
            </label>
            <input
              id="contractAddress"
              className={`storage-input ${contractAddress.length === 0 ? '' : contractAddressValid ? 'valid' : 'invalid'}`}
              placeholder="0x..."
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value.trim())}
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
            />
            {contractAddress.length > 0 && !contractAddressValid && (
              <div className="storage-hint error">Invalid address</div>
            )}
            {contractAddressValid && (
              <div className="storage-hint">
                Connected as <span className="mono">{address ?? '—'}</span>
              </div>
            )}
          </div>

          <div className="storage-tabs">
            <button
              type="button"
              className={`storage-tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              Upload
            </button>
            <button
              type="button"
              className={`storage-tab ${activeTab === 'files' ? 'active' : ''}`}
              onClick={() => setActiveTab('files')}
            >
              My files
            </button>
          </div>

          <div className="storage-tab-body">
            {activeTab === 'upload' && <UploadFile contractAddress={contractAddressValid ? contractAddress : ''} />}
            {activeTab === 'files' && <MyFiles contractAddress={contractAddressValid ? contractAddress : ''} />}
          </div>
        </div>
      </main>
    </div>
  );
}

