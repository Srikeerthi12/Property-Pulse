import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listMyInquiries, submitInquiryOffer } from '../../services/inquiryService.js';
import * as visitService from '../../services/visitService.js';
import Modal from '../../components/common/Modal.jsx';
import { Table, TBody, TD, TH, THead, TR } from '../../components/common/Table.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { Button } from '../../components/ui/button.jsx';

export default function BuyerInquiries() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('');
  const [message, setMessage] = useState('');
  const [scheduleBusy, setScheduleBusy] = useState(false);

  const [offerOpen, setOfferOpen] = useState(false);
  const [offerInquiry, setOfferInquiry] = useState(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [offerBusy, setOfferBusy] = useState(false);

  async function reload() {
    const data = await listMyInquiries({ page: 1, limit: 50 });
    const rows = Array.isArray(data) ? data : data?.items ?? [];
    setItems(rows);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await listMyInquiries({ page: 1, limit: 50 });
        const rows = Array.isArray(data) ? data : data?.items ?? [];
        if (mounted) setItems(rows);
      } catch (e) {
        if (mounted) setError(e?.response?.data?.message || e?.message || 'Failed to load inquiries');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function openSchedule(inquiry) {
    setSelectedInquiry(inquiry);
    setVisitDate('');
    setVisitTime('');
    setMessage('');
    setScheduleOpen(true);
  }

  function openOffer(inquiry) {
    setOfferInquiry(inquiry);
    setOfferPrice(inquiry?.offerPrice ? String(inquiry.offerPrice) : '');
    setOfferMessage(inquiry?.offerMessage ? String(inquiry.offerMessage) : '');
    setOfferOpen(true);
  }

  async function submitSchedule() {
    if (!selectedInquiry) return;
    setError('');
    setScheduleBusy(true);
    try {
      await visitService.createVisit({
        inquiryId: selectedInquiry.id,
        visitDate,
        visitTime,
        notes: message?.trim() ? message.trim() : undefined,
      });
      await reload();
      setScheduleOpen(false);
      setSelectedInquiry(null);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to schedule visit');
    } finally {
      setScheduleBusy(false);
    }
  }

  async function submitOffer() {
    if (!offerInquiry) return;
    setError('');
    setOfferBusy(true);
    try {
      await submitInquiryOffer(offerInquiry.id, {
        offerPrice,
        message: offerMessage?.trim() ? offerMessage.trim() : undefined,
      });
      await reload();
      setOfferOpen(false);
      setOfferInquiry(null);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to submit offer');
    } finally {
      setOfferBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My Inquiries</h1>
        <p className="text-sm text-muted-foreground">Track your inquiries and their current status.</p>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No inquiries yet.</div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Property</TH>
              <TH>Status</TH>
              <TH>Visit</TH>
              <TH>Offer</TH>
              <TH>Created</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link to={`/properties/${row.propertyId}`} className="font-medium hover:underline">
                    {row?.property?.title || row?.propertyTitle || row?.title || 'Property'}
                  </Link>
                  <div className="text-xs text-muted-foreground">Agent: {row?.agent?.name || 'Unassigned'}</div>
                </TD>
                <TD>
                  <StatusBadge status={row?.status} />
                </TD>
                <TD>
                  <Button variant="outline" type="button" onClick={() => openSchedule(row)}>
                    Schedule visit
                  </Button>
                </TD>
                <TD>
                  <Button variant="outline" type="button" onClick={() => openOffer(row)}>
                    {row?.offerPrice ? 'Update offer' : 'Submit offer'}
                  </Button>
                </TD>
                <TD className="text-muted-foreground">
                  {row?.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={scheduleOpen}
        title="Schedule visit"
        onClose={() => {
          if (scheduleBusy) return;
          setScheduleOpen(false);
          setSelectedInquiry(null);
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (scheduleBusy) return;
                setScheduleOpen(false);
                setSelectedInquiry(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={submitSchedule} disabled={scheduleBusy || !visitDate || !visitTime}>
              Send request
            </Button>
          </>
        }
      >
        <div className="text-sm text-muted-foreground">
          Request a visit time for: <span className="text-foreground">{selectedInquiry?.property?.title || 'Property'}</span>
        </div>
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
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Any details for the agent…"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </Modal>

      <Modal
        open={offerOpen}
        title="Submit offer"
        onClose={() => {
          if (offerBusy) return;
          setOfferOpen(false);
          setOfferInquiry(null);
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (offerBusy) return;
                setOfferOpen(false);
                setOfferInquiry(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={submitOffer} disabled={offerBusy || !offerPrice}>
              Submit
            </Button>
          </>
        }
      >
        <div className="text-sm text-muted-foreground">
          Offer for: <span className="text-foreground">{offerInquiry?.property?.title || 'Property'}</span>
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
            value={offerMessage}
            onChange={(e) => setOfferMessage(e.target.value)}
            rows={3}
            placeholder="Any details for the agent…"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </Modal>
    </div>
  );
}
