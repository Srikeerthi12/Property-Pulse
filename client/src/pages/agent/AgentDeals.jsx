import { useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
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

export default function AgentDeals() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState('');

  const [offerOpen, setOfferOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [docsDeal, setDocsDeal] = useState(null);

  const [offerPrice, setOfferPrice] = useState('');
  const [offerMessage, setOfferMessage] = useState('');

  const [nextStatus, setNextStatus] = useState('open');
  const [finalPrice, setFinalPrice] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dealService.listAgentDeals({ status: statusFilter || undefined, page: 1, limit: 200 });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function openOfferModal(d) {
    setSelectedDeal(d);
    setOfferPrice(typeof d.offerPrice === 'number' ? String(d.offerPrice) : '');
    setOfferMessage(d.notes || '');
    setOfferOpen(true);
  }

  function openStatusModal(d) {
    setSelectedDeal(d);
    setNextStatus(d.status || 'open');
    setFinalPrice(typeof d.finalPrice === 'number' ? String(d.finalPrice) : '');
    setStatusNotes(d.notes || '');
    setStatusOpen(true);
  }

  function openDocuments(d) {
    setDocsDeal(d);
    setDocsOpen(true);
  }

  async function submitOffer() {
    if (!selectedDeal) return;
    setIsLoading(true);
    setError(null);
    try {
      await dealService.updateDealOffer(selectedDeal.id, {
        offerPrice,
        message: offerMessage?.trim() ? offerMessage.trim() : undefined,
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

  async function submitStatus() {
    if (!selectedDeal) return;
    setIsLoading(true);
    setError(null);
    try {
      await dealService.updateDealStatus(selectedDeal.id, {
        status: nextStatus,
        finalPrice: nextStatus === 'closed_won' ? finalPrice : undefined,
        notes: statusNotes?.trim() ? statusNotes.trim() : undefined,
      });
      setStatusOpen(false);
      setSelectedDeal(null);
      await refresh();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update status';
      setError(msg);
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Deals</h1>
        <p className="text-sm text-muted-foreground">Manage negotiations and close transactions.</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by deal status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="negotiation">Negotiation</option>
                <option value="agreement_pending">Agreement pending</option>
                <option value="closed_won">Closed won</option>
                <option value="closed_lost">Closed lost</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-end justify-end">
              <Button variant="outline" onClick={refresh} disabled={isLoading}>
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My deals</CardTitle>
          <CardDescription>Latest deals (up to 200).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No deals found.</div>
          ) : (
            <div className="grid gap-2">
              {items.map((d) => (
                <div key={d.id} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{d?.property?.title || 'Property'}</div>
                      <div className="truncate text-xs text-muted-foreground">{d?.property?.location || '—'}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusBadge status={d.status} />
                        <div className="text-xs text-muted-foreground">Offer: {formatMoney(d.offerPrice)}</div>
                        <div className="text-xs text-muted-foreground">Final: {formatMoney(d.finalPrice)}</div>
                      </div>
                      <div className="mt-3">
                        <DealProgress status={d.status} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Buyer: {d?.buyer?.email || '—'}</div>
                      {d?.notes ? <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{d.notes}</div> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => openOfferModal(d)} disabled={isLoading || isClosed(d.status)}>
                        Update offer
                      </Button>
                      <Button variant="outline" onClick={() => openDocuments(d)} disabled={isLoading}>
                        Documents
                      </Button>
                      <Button variant="outline" onClick={() => openStatusModal(d)} disabled={isLoading}>
                        Update status
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DealDocumentsModal
        open={docsOpen}
        dealId={docsDeal?.id}
        dealTitle={docsDeal?.property?.title}
        onClose={() => {
          if (isLoading) return;
          setDocsOpen(false);
          setDocsDeal(null);
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
            <Button variant="outline" onClick={submitOffer} disabled={isLoading || !offerPrice}>
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
          <label className="text-xs text-muted-foreground">Notes (optional)</label>
          <textarea
            value={offerMessage}
            onChange={(e) => setOfferMessage(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </Modal>

      <Modal
        open={statusOpen}
        title="Update status"
        onClose={() => {
          if (isLoading) return;
          setStatusOpen(false);
          setSelectedDeal(null);
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (isLoading) return;
                setStatusOpen(false);
                setSelectedDeal(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={submitStatus} disabled={isLoading || !nextStatus}>
              Save
            </Button>
          </>
        }
      >
        <div className="text-sm text-muted-foreground">
          Updating: <span className="text-foreground">{selectedDeal?.property?.title || 'Property'}</span>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="open">Open</option>
            <option value="negotiation">Negotiation</option>
            <option value="agreement_pending">Agreement pending</option>
            <option value="closed_won">Closed won</option>
            <option value="closed_lost">Closed lost</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {nextStatus === 'closed_won' ? (
          <div>
            <label className="text-xs text-muted-foreground">Final price</label>
            <input
              type="number"
              min="1"
              value={finalPrice}
              onChange={(e) => setFinalPrice(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        ) : null}
        <div>
          <label className="text-xs text-muted-foreground">Notes (optional)</label>
          <textarea
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </Modal>
    </div>
  );
}
