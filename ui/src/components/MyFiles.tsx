import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { BLACKBOX_STORAGE_ABI } from '../config/contracts';
import { decryptUtf8WithAddress, normalizeDecryptedAddress } from '../utils/encryption';
import '../styles/MyFiles.css';

type Props = {
  contractAddress: string;
};

type FileRow = {
  index: bigint;
  fileName: string;
  encryptedIpfsHash: `0x${string}`;
  encryptedAddressA: `0x${string}`;
  createdAt: bigint;
  decryptedCid?: string;
  decrypting?: boolean;
  error?: string;
};

function formatTimestamp(seconds: bigint): string {
  const ms = Number(seconds) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  return new Date(ms).toLocaleString();
}

export function MyFiles({ contractAddress }: Props) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance } = useZamaInstance();
  const publicClient = usePublicClient();

  const [rows, setRows] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>('');

  const canRead = useMemo(() => !!contractAddress && !!address && !!publicClient, [contractAddress, address, publicClient]);

  const { data: countData, refetch: refetchCount } = useReadContract({
    address: (contractAddress || undefined) as any,
    abi: BLACKBOX_STORAGE_ABI,
    functionName: 'getFileCount',
    args: address ? [address] : undefined,
    query: { enabled: canRead },
  });

  const reload = async () => {
    if (!canRead) return;
    if (!publicClient) return;
    setLoading(true);
    setLoadError('');

    try {
      const count = (await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: BLACKBOX_STORAGE_ABI,
        functionName: 'getFileCount',
        args: [address as `0x${string}`],
      })) as bigint;

      const next: FileRow[] = [];
      for (let i = 0n; i < count; i++) {
        const result = (await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: BLACKBOX_STORAGE_ABI,
          functionName: 'getFile',
          args: [address as `0x${string}`, i],
        })) as readonly [string, `0x${string}`, `0x${string}`, bigint];

        next.push({
          index: i,
          fileName: result[0],
          encryptedIpfsHash: result[1],
          encryptedAddressA: result[2],
          createdAt: result[3],
        });
      }
      setRows(next);
      await refetchCount();
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractAddress, address]);

  const decryptRow = async (row: FileRow) => {
    if (!instance || !address || !signerPromise) {
      setRows((prev) => prev.map((r) => (r.index === row.index ? { ...r, error: 'Missing Zama instance or signer' } : r)));
      return;
    }

    setRows((prev) =>
      prev.map((r) => (r.index === row.index ? { ...r, decrypting: true, error: undefined } : r)),
    );

    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [{ handle: row.encryptedAddressA, contractAddress }];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [contractAddress];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signer = await signerPromise;
      if (!signer) throw new Error('Signer not available');

      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decryptedAddressAValue = result[row.encryptedAddressA as string];
      const addressA = normalizeDecryptedAddress(decryptedAddressAValue);
      const cid = await decryptUtf8WithAddress(addressA, row.encryptedIpfsHash);

      setRows((prev) => prev.map((r) => (r.index === row.index ? { ...r, decryptedCid: cid } : r)));
    } catch (e) {
      console.error(e);
      setRows((prev) =>
        prev.map((r) =>
          r.index === row.index ? { ...r, error: e instanceof Error ? e.message : 'Decryption failed' } : r,
        ),
      );
    } finally {
      setRows((prev) => prev.map((r) => (r.index === row.index ? { ...r, decrypting: false } : r)));
    }
  };

  if (!contractAddress) return <div className="notice">Enter a valid contract address to view stored files.</div>;
  if (!address) return <div className="notice">Connect your wallet to view your files.</div>;

  const countLabel = typeof countData === 'bigint' ? countData.toString() : '—';

  return (
    <div className="files">
      <div className="files-header">
        <div className="files-meta">
          <div>
            <div className="meta-label">Owner</div>
            <div className="mono wrap">{address}</div>
          </div>
          <div>
            <div className="meta-label">Count</div>
            <div className="mono">{countLabel}</div>
          </div>
        </div>
        <button className="button" type="button" onClick={reload} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loadError && <div className="notice error">{loadError}</div>}

      {rows.length === 0 && !loading ? (
        <div className="empty">
          <div className="empty-title">No files stored</div>
          <div className="empty-subtitle">Use the Upload tab to add your first encrypted CID.</div>
        </div>
      ) : (
        <div className="table">
          <div className="table-head">
            <div>#</div>
            <div>Name</div>
            <div>Created</div>
            <div>CID</div>
            <div />
          </div>
          {rows.map((row) => (
            <div className="table-row" key={row.index.toString()}>
              <div className="mono">{row.index.toString()}</div>
              <div className="wrap">{row.fileName}</div>
              <div className="wrap">{formatTimestamp(row.createdAt)}</div>
              <div className="mono wrap">{row.decryptedCid ? row.decryptedCid : 'Encrypted'}</div>
              <div className="actions">
                <button
                  className="button small"
                  type="button"
                  onClick={() => decryptRow(row)}
                  disabled={!instance || !signerPromise || row.decrypting}
                >
                  {row.decrypting ? 'Decrypting…' : 'Decrypt'}
                </button>
              </div>
              {row.error && (
                <div className="row-error">
                  <div className="notice error">{row.error}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
