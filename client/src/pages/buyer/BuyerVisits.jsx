import { useEffect, useState } from 'react';

import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import Modal from '../../components/common/Modal.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import * as visitService from '../../services/visitService.js';

function VisitRow({ v, onConfirm, onCancel, onOpenReschedule, isBusy }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{v?.property?.title || 'Property visit'}</div>
          <div className="truncate text-xs text-muted-foreground">{v?.property?.location || '—'}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="text-xs text-muted-foreground">
              {v.visitDate || '—'} {v.visitTime ? `• ${String(v.visitTime).slice(0, 5)}` : ''}
            </div>
            <StatusBadge status={v.status} />
          </div>
          {v?.agent?.name ? (
            <div className="mt-1 text-xs text-muted-foreground">Agent: {v.agent.name}</div>
          ) : null}
          {v?.notes ? <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{v.notes}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => onConfirm(v)}
            disabled={isBusy || v.status === 'confirmed' || v.status === 'cancelled'}
          >
            Confirm
          </Button>
          <Button variant="outline" onClick={() => onOpenReschedule(v)} disabled={isBusy || v.status === 'cancelled'}>
            Reschedule
          </Button>
          <Button variant="outline" onClick={() => onCancel(v)} disabled={isBusy || v.status === 'cancelled'}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BuyerVisits() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('');
  const [notes, setNotes] = useState('');

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await visitService.listMyVisits({ page: 1, limit: 100 });
      setItems(data?.items ?? []);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load visits';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function confirmVisit(v) {
    setError(null);
    setIsLoading(true);
    try {
      await visitService.updateVisitStatus(v.id, { status: 'confirmed' });
      await refresh();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to confirm visit';
      setError(message);
      setIsLoading(false);
    }
  }

  async function cancel(v) {
    setError(null);
    setIsLoading(true);
    try {
      await visitService.cancelVisit(v.id);
      await refresh();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to cancel visit';
      setError(message);
      setIsLoading(false);
    }
  }

  function openReschedule(v) {
    setSelectedVisit(v);
    setVisitDate(v.visitDate || '');
    setVisitTime(v.visitTime ? String(v.visitTime).slice(0, 5) : '');
    setNotes(v.notes || '');
    setRescheduleOpen(true);
  }

  async function submitReschedule() {
    if (!selectedVisit) return;
    setError(null);
    setIsLoading(true);
    try {
      await visitService.rescheduleVisit(selectedVisit.id, {
        visitDate,
        visitTime,
        notes: notes?.trim() ? notes.trim() : undefined,
      });
      setRescheduleOpen(false);
      setSelectedVisit(null);
      await refresh();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to reschedule';
      setError(message);
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My visits</h1>
        <p className="text-sm text-muted-foreground">Confirm, cancel, or request a new time.</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Upcoming & recent</CardTitle>
          <CardDescription>Your scheduled appointments.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No visits yet.</div>
          ) : (
            <div className="grid gap-2">
              {items.map((v) => (
                <VisitRow
                  key={v.id}
                  v={v}
                  onConfirm={confirmVisit}
                  onCancel={cancel}
                  onOpenReschedule={openReschedule}
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

      <Modal
        open={rescheduleOpen}
        title="Reschedule visit"
        onClose={() => {
          if (isLoading) return;
          setRescheduleOpen(false);
          setSelectedVisit(null);
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (isLoading) return;
                setRescheduleOpen(false);
                setSelectedVisit(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={submitReschedule} disabled={isLoading || !visitDate || !visitTime}>
              Save
            </Button>
          </>
        }
      >
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Time</label>
          <input
            type="time"
            value={visitTime}
            onChange={(e) => setVisitTime(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Message (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </Modal>
    </div>
  );
}
