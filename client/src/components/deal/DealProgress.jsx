export default function DealProgress({ status }) {
  const steps = [
    { key: 'open', label: 'Open' },
    { key: 'negotiation', label: 'Negotiation' },
    { key: 'agreement_pending', label: 'Agreement' },
    { key: 'closed', label: 'Closed' },
  ];

  function indexFor(s) {
    const value = String(s || '').toLowerCase();
    if (value === 'open') return 0;
    if (value === 'negotiation') return 1;
    if (value === 'agreement_pending') return 2;
    if (['closed_won', 'closed_lost', 'cancelled'].includes(value)) return 3;
    return 0;
  }

  const idx = indexFor(status);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className={`h-2 rounded-full ${i <= idx ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 text-[11px] text-muted-foreground">
        {steps.map((s) => (
          <div key={s.key} className="truncate">
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
