export function Table({ children }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border bg-background">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }) {
  return <thead className="bg-muted/30 text-xs text-muted-foreground">{children}</thead>;
}

export function TBody({ children }) {
  return <tbody className="divide-y">{children}</tbody>;
}

export function TR({ children }) {
  return <tr className="hover:bg-accent/10">{children}</tr>;
}

export function TH({ children, className = '' }) {
  return <th className={`px-3 py-2 font-medium ${className}`.trim()}>{children}</th>;
}

export function TD({ children, className = '' }) {
  return <td className={`px-3 py-2 align-top ${className}`.trim()}>{children}</td>;
}
