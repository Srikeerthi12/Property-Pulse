import { useEffect, useMemo, useState } from 'react';

import Modal from '../common/Modal.jsx';
import { Button } from '../ui/button.jsx';
import { apiAbsoluteUrl } from '../../utils/apiUrl.js';
import * as dealService from '../../services/dealService.js';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

export default function DealDocumentsModal({ open, onClose, dealId, dealTitle }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [files, setFiles] = useState(null);
  const [docType, setDocType] = useState('');

  const canLoad = useMemo(() => open && !!dealId, [open, dealId]);

  async function refresh() {
    if (!dealId) return;
    setIsBusy(true);
    setError(null);
    try {
      const data = await dealService.listDealDocuments(dealId);
      setItems(data?.items ?? []);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load documents';
      setError(msg);
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    if (!canLoad) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad]);

  async function upload() {
    if (!dealId) return;
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;

    setIsBusy(true);
    setError(null);
    try {
      await dealService.uploadDealDocuments(dealId, list, { docType: docType || undefined });
      setFiles(null);
      await refresh();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to upload';
      setError(msg);
      setIsBusy(false);
    }
  }

  async function remove(doc) {
    if (!dealId || !doc?.id) return;
    setIsBusy(true);
    setError(null);
    try {
      await dealService.deleteDealDocument(dealId, doc.id);
      await refresh();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to delete document';
      setError(msg);
      setIsBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Deal documents"
      onClose={() => {
        if (isBusy) return;
        setError(null);
        setFiles(null);
        setDocType('');
        onClose?.();
      }}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              if (isBusy) return;
              setError(null);
              setFiles(null);
              setDocType('');
              onClose?.();
            }}
          >
            Close
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted-foreground">
        Deal: <span className="text-foreground">{dealTitle || '—'}</span>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Upload documents (PDF/JPG/PNG/DOCX)</label>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              disabled={isBusy}
            >
              <option value="">Type: Unspecified</option>
              <option value="id_proof">Type: ID proof</option>
              <option value="agreement">Type: Agreement</option>
              <option value="payment_proof">Type: Payment proof</option>
              <option value="invoice">Type: Invoice</option>
            </select>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              disabled={isBusy}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={upload} disabled={isBusy || !files || files.length === 0}>
            Upload
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-medium">Files</div>
        {isBusy && items.length === 0 ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No documents yet.</div>
        ) : (
          <div className="grid gap-2">
            {items.map((d) => (
              <div key={d.id} className="flex flex-col gap-2 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{d.filename}</div>
                  <div className="text-xs text-muted-foreground">
                    {d?.doc_type ? `Type: ${String(d.doc_type).replaceAll('_', ' ')}` : 'Type: —'}
                    {' • '}Uploaded: {formatDate(d.created_at)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    href={apiAbsoluteUrl(d.url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>
                  <Button variant="outline" onClick={() => remove(d)} disabled={isBusy}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={refresh} disabled={isBusy || !dealId}>
          Refresh
        </Button>
      </div>
    </Modal>
  );
}
