import { useEffect, useMemo, useState } from 'react';

import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { addMinutes, format, getDay, parse, startOfWeek } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { Button } from '../../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.jsx';
import Modal from '../../components/common/Modal.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import * as visitService from '../../services/visitService.js';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

function toDateTime(visit) {
  if (visit?.scheduledAt) {
    const d = new Date(visit.scheduledAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (visit?.visitDate && visit?.visitTime) {
    const t = String(visit.visitTime).slice(0, 8);
    const d = new Date(`${visit.visitDate}T${t}`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export default function AgentVisits() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await visitService.listAgentVisits({ page: 1, limit: 500 });
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

  const events = useMemo(() => {
    return (items || [])
      .map((v) => {
        const start = toDateTime(v);
        if (!start) return null;
        return {
          id: v.id,
          title: `${v?.property?.title || 'Property'} — ${v?.buyer?.name || 'Buyer'}`,
          start,
          end: addMinutes(start, 30),
          resource: v,
        };
      })
      .filter(Boolean);
  }, [items]);

  function openDetail(v) {
    setSelected(v);
    setStatus(v?.status || 'scheduled');
    setNotes(v?.notes || '');
    setDetailOpen(true);
  }

  async function saveStatus() {
    if (!selected) return;
    setIsLoading(true);
    setError(null);
    try {
      await visitService.updateVisitStatus(selected.id, { status, notes: notes?.trim() ? notes.trim() : undefined });
      setDetailOpen(false);
      setSelected(null);
      await refresh();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to update visit';
      setError(message);
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Visit calendar</h1>
        <p className="text-sm text-muted-foreground">Your scheduled appointments.</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>Click an appointment to update status/notes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-end">
            <Button variant="outline" onClick={refresh} disabled={isLoading}>
              Refresh
            </Button>
          </div>

          <div className="mt-3 h-[600px] rounded-lg border bg-background p-2">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              onSelectEvent={(e) => openDetail(e.resource)}
              views={['month', 'week', 'day']}
              defaultView="week"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visit list</CardTitle>
          <CardDescription>All your visits (latest first).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No visits yet.</div>
          ) : (
            <div className="grid gap-2">
              {[...items]
                .sort((a, b) => {
                  const da = toDateTime(a)?.getTime() ?? 0;
                  const db = toDateTime(b)?.getTime() ?? 0;
                  return db - da;
                })
                .slice(0, 50)
                .map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => openDetail(v)}
                    className="rounded-lg border bg-background p-3 text-left hover:bg-accent/20"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{v?.property?.title || 'Property'}</div>
                        <div className="truncate text-xs text-muted-foreground">Buyer: {v?.buyer?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {v.visitDate || '—'} {v.visitTime ? `• ${String(v.visitTime).slice(0, 5)}` : ''}
                        </div>
                      </div>
                      <div className="mt-2 sm:mt-0">
                        <StatusBadge status={v.status} />
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={detailOpen}
        title="Visit details"
        onClose={() => {
          if (isLoading) return;
          setDetailOpen(false);
          setSelected(null);
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (isLoading) return;
                setDetailOpen(false);
                setSelected(null);
              }}
            >
              Close
            </Button>
            <Button variant="outline" onClick={saveStatus} disabled={isLoading || !status}>
              Save
            </Button>
          </>
        }
      >
        <div className="text-sm">
          <div className="font-medium">{selected?.property?.title || 'Property'}</div>
          <div className="text-xs text-muted-foreground">Buyer: {selected?.buyer?.name || '—'}</div>
          <div className="text-xs text-muted-foreground">{selected?.visitDate || '—'} {selected?.visitTime ? `• ${String(selected.visitTime).slice(0, 5)}` : ''}</div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="no_show">No show</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </Modal>
    </div>
  );
}
