import { useEffect, useState } from 'react';

import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import Modal from '../../components/common/Modal.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import DealDocumentsModal from '../../components/deal/DealDocumentsModal.jsx';
import DealProgress from '../../components/deal/DealProgress.jsx';
import * as dealService from '../../services/dealService.js';

function formatMoney(value) {
  if (typeof value !== 'number') return '—';
  return `₹${value.toLocaleString()}`;
}

function isClosed(status) {
  return ['closed_won', 'closed_lost', 'cancelled'].includes(status);
}

function DealRow({ d, onOpenUpdateOffer, onOpenDocuments, onCancel, isBusy }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{d?.property?.title || 'Deal'}</div>
          <div className="truncate text-xs text-muted-foreground">{d?.property?.location || '—'}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={d.status} />
            <div className="text-xs text-muted-foreground">Offer: {formatMoney(d.offerPrice)}</div>
            <div className="text-xs text-muted-foreground">Final: {formatMoney(d.finalPrice)}</div>
          </div>
          <div className="mt-3">
            <DealProgress status={d.status} />
          </div>
          {d?.agent?.name ? <div className="mt-1 text-xs text-muted-foreground">Agent: {d.agent.name}</div> : null}
          {d?.notes ? <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{d.notes}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenUpdateOffer(d)} disabled={isBusy || isClosed(d.status)}>
            Update offer
          </Button>
          <Button variant="outline" onClick={() => onOpenDocuments(d)} disabled={isBusy}>
            Documents
          </Button>
          <Button variant="outline" onClick={() => onCancel(d)} disabled={isBusy || isClosed(d.status)}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BuyerDeals() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [offerOpen, setOfferOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dealService.listMyDeals({ page: 1, limit: 100 });
      setItems(data?.items ?? []);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load deals';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function openUpdateOffer(d) {
    setSelectedDeal(d);
    setOfferPrice(typeof d.offerPrice === 'number' ? String(d.offerPrice) : '');
    setMessage(d.notes || '');
    setOfferOpen(true);
  }

  function openDocuments(d) {
    setSelectedDeal(d);
    setDocsOpen(true);
  }

  async function submitOfferUpdate() {
    if (!selectedDeal) return;
    setIsLoading(true);
    setError(null);
    try {
      await dealService.updateDealOffer(selectedDeal.id, {
        offerPrice,
        message: message?.trim() ? message.trim() : undefined,
      });
      setOfferOpen(false);
      setSelectedDeal(null);
      await refresh();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update offer';
      setError(msg);
      setIsLoading(false);
    }
  }

  async function cancel(d) {
    setIsLoading(true);
    setError(null);
    try {
      await dealService.cancelDeal(d.id);
      await refresh();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to cancel deal';
      setError(msg);
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My deals</h1>
        <p className="text-sm text-muted-foreground">Track offer status and negotiation progress.</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Deals</CardTitle>
          <CardDescription>Offers you’ve made and their current status.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No deals yet.</div>
          ) : (
            <div className="grid gap-2">
              {items.map((d) => (
                <DealRow
                  key={d.id}
                  d={d}
                  onOpenUpdateOffer={openUpdateOffer}
                  onOpenDocuments={openDocuments}
                  onCancel={cancel}
                  isBusy={isLoading}
                />
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={refresh} disabled={isLoading}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <DealDocumentsModal
        open={docsOpen}
        dealId={selectedDeal?.id}
        dealTitle={selectedDeal?.property?.title}
        onClose={() => {
          if (isLoading) return;
          setDocsOpen(false);
          setSelectedDeal(null);
        }}
      />

      <Modal
        open={offerOpen}
        title="Update offer"
        onClose={() => {
          if (isLoading) return;
          setOfferOpen(false);
          setSelectedDeal(null);
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (isLoading) return;
                setOfferOpen(false);
                setSelectedDeal(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={submitOfferUpdate} disabled={isLoading || !offerPrice}>
              Save
            </Button>
          </>
        }
      >
        <div className="text-sm text-muted-foreground">
          Updating offer for: <span className="text-foreground">{selectedDeal?.property?.title || 'Property'}</span>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Offer price</label>
          <input
            type="number"
            min="1"
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Message (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </Modal>
    </div>
  );
}
