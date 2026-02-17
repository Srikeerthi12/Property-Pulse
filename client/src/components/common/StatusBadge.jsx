const LABELS = {
  new: 'New',
  contacted: 'Contacted',
  visit_scheduled: 'Visit Scheduled',
  negotiation: 'Negotiation',
  closed: 'Closed',
  dropped: 'Dropped',
};

function classesForStatus(status) {
  const s = String(status || '').toLowerCase();

  if (s === 'new') return 'border-info/30 bg-info/10 text-info';
  if (s === 'contacted') return 'border-warning/30 bg-warning/10 text-warning';
  if (s === 'visit_scheduled') return 'border-accent/50 bg-accent/30 text-accent-foreground';
  if (s === 'negotiation') return 'border-secondary/40 bg-secondary/20 text-secondary-foreground';
  if (s === 'closed') return 'border-success/30 bg-success/10 text-success';
  if (s === 'dropped') return 'border-destructive/30 bg-destructive/10 text-destructive';
  return 'border-muted/40 bg-muted/30 text-muted-foreground';
}

export default function StatusBadge({ status, className = '' }) {
  const text = LABELS[String(status || '').toLowerCase()] || String(status || '');

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${classesForStatus(status)} ${className}`.trim()}>
      {text}
    </span>
  );
}
