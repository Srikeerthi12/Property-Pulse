import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import * as inquiryService from '../../services/inquiryService.js';
import * as visitService from '../../services/visitService.js';
import * as dealService from '../../services/dealService.js';
import { Button } from '../ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.jsx';
import Modal from '../common/Modal.jsx';
import { RefreshCw } from 'lucide-react';

export default function AgentLeadsBoard() {
  const [leads, setLeads] = useState([]);
  const [leadError, setLeadError] = useState(null);
  const [isLeadLoading, setIsLeadLoading] = useState(false);
  const [leadQ, setLeadQ] = useState('');
  const [leadStatus, setLeadStatus] = useState('');

  const [noteDrafts, setNoteDrafts] = useState({});
  const [isLeadActionLoading, setIsLeadActionLoading] = useState(false);
  const [notesOpen, setNotesOpen] = useState({});
  const [notesByLeadId, setNotesByLeadId] = useState({});
  const [notesLoadingByLeadId, setNotesLoadingByLeadId] = useState({});

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('');
  const [visitNotes, setVisitNotes] = useState('');

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertLead, setConvertLead] = useState(null);
  const [convertOfferPrice, setConvertOfferPrice] = useState('');
  const [convertMessage, setConvertMessage] = useState('');

  const columns = [
    { key: 'new', title: 'New' },
    { key: 'contacted', title: 'Contacted' },
    { key: 'visit_scheduled', title: 'Visit' },
    { key: 'negotiation', title: 'Negotiation' },
    { key: 'closed', title: 'Closed' },
    { key: 'dropped', title: 'Dropped' },
  ];

  function isFinalLeadStatus(status) {
    return status === 'closed' || status === 'dropped';
  }

  function isSoldProperty(lead) {
    return String(lead?.property?.status || '').toLowerCase() === 'sold';
  }

  function isInactiveProperty(lead) {
    return String(lead?.property?.status || '').toLowerCase() === 'inactive';
  }

  function isUnavailableProperty(lead) {
    return isSoldProperty(lead) || isInactiveProperty(lead);
  }

  function allowedNextStatuses(status) {
    const allowed = {
      new: ['contacted', 'dropped'],
      contacted: ['visit_scheduled', 'dropped'],
      visit_scheduled: ['negotiation', 'dropped'],
      negotiation: ['closed', 'dropped'],
      closed: [],
      dropped: [],
    };
    return allowed[status] ?? [];
  }

  function canScheduleVisit(lead) {
    if (!lead) return false;
    if (isUnavailableProperty(lead)) return false;
    if (isFinalLeadStatus(lead.status)) return false;
    return ['contacted', 'visit_scheduled', 'negotiation'].includes(lead.status);
  }

  function canConvertToDeal(lead) {
    if (!lead) return false;
    if (isUnavailableProperty(lead)) return false;
    if (isFinalLeadStatus(lead.status)) return false;
    if (lead.hasActiveDeal) return false;
    const latestVisitCompleted = lead.latestVisitCompleted ?? false;
    if (!latestVisitCompleted) return false;
    return ['visit_scheduled', 'negotiation'].includes(lead.status);
  }

  function canUpdateLeadStatus(lead) {
    if (!lead) return false;
    if (isUnavailableProperty(lead)) return false;
    if (isFinalLeadStatus(lead.status)) return false;
    return true;
  }

  function canAddNote(lead) {
    if (!lead) return false;
    if (isUnavailableProperty(lead)) return false;
    if (isFinalLeadStatus(lead.status)) return false;
    return true;
  }

  async function refreshLeads() {
    setIsLeadLoading(true);
    setLeadError(null);
    try {
      const { items } = await inquiryService.listAgentLeads({
        status: leadStatus || undefined,
        q: leadQ?.trim() ? leadQ.trim() : undefined,
        page: 1,
        limit: 50,
      });
      setLeads(items ?? []);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load leads';
      setLeadError(message);
    } finally {
      setIsLeadLoading(false);
    }
  }

  useEffect(() => {
    refreshLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadQ, leadStatus]);

  async function updateStatus(inquiryId, status) {
    setLeadError(null);
    setIsLeadActionLoading(true);
    try {
      await inquiryService.updateInquiryStatus(inquiryId, status);
      await refreshLeads();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to update lead status';
      setLeadError(message);
    } finally {
      setIsLeadActionLoading(false);
    }
  }

  function openSchedule(lead) {
    setSelectedLead(lead);
    setVisitDate('');
    setVisitTime('');
    setVisitNotes('');
    setScheduleOpen(true);
  }

  async function submitSchedule() {
    if (!selectedLead) return;
    setLeadError(null);
    setIsLeadActionLoading(true);
    try {
      await visitService.createVisit({
        inquiryId: selectedLead.id,
        visitDate,
        visitTime,
        notes: visitNotes?.trim() ? visitNotes.trim() : undefined,
      });
      setScheduleOpen(false);
      setSelectedLead(null);
      // Do not move backwards in the pipeline.
      if (selectedLead.status === 'contacted') {
        await updateStatus(selectedLead.id, 'visit_scheduled');
      } else {
        await refreshLeads();
      }
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to schedule visit';
      setLeadError(message);
    } finally {
      setIsLeadActionLoading(false);
    }
  }

  function openConvert(lead) {
    setConvertLead(lead);
    setConvertOfferPrice('');
    setConvertMessage('');
    setConvertOpen(true);
  }

  async function submitConvert() {
    if (!convertLead) return;
    setLeadError(null);
    setIsLeadActionLoading(true);
    try {
      await dealService.createDeal({
        inquiryId: convertLead.id,
        offerPrice: convertOfferPrice,
        message: convertMessage?.trim() ? convertMessage.trim() : undefined,
      });
      setConvertOpen(false);
      setConvertLead(null);
      // Backend auto-updates lead status to negotiation.
      await refreshLeads();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to convert to deal';
      setLeadError(message);
    } finally {
      setIsLeadActionLoading(false);
    }
  }

  async function addNote(inquiryId) {
    setLeadError(null);
    setIsLeadActionLoading(true);
    try {
      const note = (noteDrafts[inquiryId] || '').trim();
      if (!note) return;
      await inquiryService.addInquiryNote(inquiryId, note);
      setNoteDrafts((prev) => ({ ...prev, [inquiryId]: '' }));
      if (notesOpen[inquiryId]) {
        await loadNotes(inquiryId, { force: true });
      }
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to add note';
      setLeadError(message);
    } finally {
      setIsLeadActionLoading(false);
    }
  }

  async function loadNotes(inquiryId, { force = false } = {}) {
    if (!inquiryId) return;
    if (!force && notesByLeadId[inquiryId]) return;
    setNotesLoadingByLeadId((prev) => ({ ...prev, [inquiryId]: true }));
    setLeadError(null);
    try {
      const data = await inquiryService.listInquiryNotes(inquiryId);
      setNotesByLeadId((prev) => ({ ...prev, [inquiryId]: data?.items ?? data?.notes ?? [] }));
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load notes';
      setLeadError(message);
    } finally {
      setNotesLoadingByLeadId((prev) => ({ ...prev, [inquiryId]: false }));
    }
  }

  function toggleNotes(inquiryId) {
    const nextOpen = !notesOpen[inquiryId];
    setNotesOpen((prev) => ({ ...prev, [inquiryId]: nextOpen }));
    if (nextOpen) loadNotes(inquiryId);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads</CardTitle>
        <CardDescription>Track inquiries assigned to you.</CardDescription>
      </CardHeader>
      <CardContent>
        {leadError ? (
          <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
            {leadError}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Search</label>
            <input
              value={leadQ}
              onChange={(e) => setLeadQ(e.target.value)}
              placeholder="Buyer name/email or property"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              value={leadStatus}
              onChange={(e) => setLeadStatus(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">All</option>
              {columns.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end">
          <Button variant="outline" onClick={refreshLeads} disabled={isLeadLoading}>
            <RefreshCw className="h-4 w-4" />
            {isLeadLoading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        {isLeadLoading ? (
          <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
        ) : leads.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">No leads assigned.</div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-6">
            {columns.map((col) => (
              <div key={col.key} className="rounded-lg border bg-background p-2">
                <div className="mb-2 text-xs font-medium text-muted-foreground">{col.title}</div>
                <div className="grid gap-2">
                  {leads
                    .filter((l) => l.status === col.key)
                    .map((l) => (
                      <div key={l.id} className="rounded-md border bg-background p-2">
                        <div className="truncate text-sm font-medium">{l.buyer?.name || 'Buyer'}</div>
                        <div className="truncate text-xs text-muted-foreground">{l.buyer?.email || '—'}</div>
                        <div className="mt-1 truncate text-xs">
                          <Link className="underline" to={`/properties/${l.propertyId}`}>
                            {l.property?.title || 'Open property'}
                          </Link>
                        </div>
                        {l.message ? (
                          <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{l.message}</div>
                        ) : null}

                        <div className="mt-2 grid gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] font-medium text-muted-foreground">Actions</div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                type="button"
                                onClick={() => openSchedule(l)}
                                disabled={isLeadActionLoading || !canScheduleVisit(l)}
                              >
                                Schedule visit
                              </Button>
                              <Button
                                variant="outline"
                                type="button"
                                onClick={() => openConvert(l)}
                                disabled={isLeadActionLoading || !canConvertToDeal(l)}
                              >
                                Convert to deal
                              </Button>
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] text-muted-foreground">Update status</label>
                            <select
                              value={l.status}
                              onChange={(e) => updateStatus(l.id, e.target.value)}
                              disabled={isLeadActionLoading || !canUpdateLeadStatus(l)}
                              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs"
                            >
                              {[l.status, ...allowedNextStatuses(l.status)]
                                .filter((v, i, a) => a.indexOf(v) === i)
                                .map((key) => {
                                  const label = columns.find((c) => c.key === key)?.title ?? key;
                                  return (
                                    <option key={key} value={key}>
                                      {label}
                                    </option>
                                  );
                                })}
                            </select>
                          </div>

                          <div>
                            <label className="text-[11px] text-muted-foreground">Add note</label>
                            <textarea
                              value={noteDrafts[l.id] ?? ''}
                              onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [l.id]: e.target.value }))}
                              rows={2}
                              placeholder="Follow-up details…"
                              disabled={isLeadActionLoading || !canAddNote(l)}
                              className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-xs"
                            />
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <Button variant="outline" type="button" onClick={() => toggleNotes(l.id)} disabled={isLeadActionLoading}>
                                {notesOpen[l.id] ? 'Hide notes' : 'View notes'}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => addNote(l.id)}
                                disabled={isLeadActionLoading || !canAddNote(l) || !(noteDrafts[l.id] || '').trim()}
                              >
                                Add
                              </Button>
                            </div>
                          </div>

                          {notesOpen[l.id] ? (
                            <div className="rounded-md border bg-background p-2">
                              <div className="mb-1 flex items-center justify-between">
                                <div className="text-[11px] font-medium text-muted-foreground">Notes</div>
                                <Button
                                  variant="outline"
                                  type="button"
                                  onClick={() => loadNotes(l.id, { force: true })}
                                  disabled={Boolean(notesLoadingByLeadId[l.id])}
                                >
                                  Refresh
                                </Button>
                              </div>

                              {notesLoadingByLeadId[l.id] ? (
                                <div className="text-xs text-muted-foreground">Loading…</div>
                              ) : (notesByLeadId[l.id] ?? []).length === 0 ? (
                                <div className="text-xs text-muted-foreground">No notes yet.</div>
                              ) : (
                                <div className="grid gap-2">
                                  {(notesByLeadId[l.id] ?? []).slice(-5).reverse().map((n) => (
                                    <div key={n.id} className="rounded-md border bg-background p-2">
                                      <div className="whitespace-pre-wrap text-xs">{n.note}</div>
                                      {n.createdAt ? (
                                        <div className="mt-1 text-[11px] text-muted-foreground">
                                          {new Date(n.createdAt).toLocaleString()}
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal
          open={scheduleOpen}
          title="Schedule visit"
          onClose={() => {
            if (isLeadActionLoading) return;
            setScheduleOpen(false);
            setSelectedLead(null);
          }}
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  if (isLeadActionLoading) return;
                  setScheduleOpen(false);
                  setSelectedLead(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="outline" onClick={submitSchedule} disabled={isLeadActionLoading || !visitDate || !visitTime}>
                Save
              </Button>
            </>
          }
        >
          <div className="text-sm text-muted-foreground">
            Lead: <span className="text-foreground">{selectedLead?.buyer?.name || 'Buyer'}</span> —{' '}
            <span className="text-foreground">{selectedLead?.property?.title || 'Property'}</span>
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
            <label className="text-xs text-muted-foreground">Notes (optional)</label>
            <textarea
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          </Modal>

        <Modal
          open={convertOpen}
          title="Convert to deal"
          onClose={() => {
            if (isLeadActionLoading) return;
            setConvertOpen(false);
            setConvertLead(null);
          }}
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  if (isLeadActionLoading) return;
                  setConvertOpen(false);
                  setConvertLead(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={submitConvert}
                disabled={isLeadActionLoading || !convertOfferPrice}
              >
                Create deal
              </Button>
            </>
          }
        >
          <div className="text-sm text-muted-foreground">
            Creating a deal for: <span className="text-foreground">{convertLead?.property?.title || 'Property'}</span>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Initial offer price</label>
            <input
              type="number"
              min="1"
              value={convertOfferPrice}
              onChange={(e) => setConvertOfferPrice(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Message (optional)</label>
            <textarea
              value={convertMessage}
              onChange={(e) => setConvertMessage(e.target.value)}
              rows={3}
              placeholder="Negotiation notes…"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </Modal>
      </CardContent>
    </Card>
  );
}
