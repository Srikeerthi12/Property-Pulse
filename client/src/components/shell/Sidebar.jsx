import { Link, useLocation } from 'react-router-dom';

function NavItem({ to, label }) {
  const location = useLocation();
  const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to + '/'));

  return (
    <Link
      to={to}
      className={
        active
          ? 'rounded-md border bg-background px-3 py-2 text-sm font-medium'
          : 'rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground'
      }
    >
      {label}
    </Link>
  );
}

export default function Sidebar({ menu = [] }) {
  return (
    <aside className="hidden w-64 flex-shrink-0 border-r bg-sidebar/40 p-4 lg:block">
      <div className="mb-4 text-sm font-semibold tracking-tight">PropertyPulse</div>
      <nav className="grid gap-1">
        {menu.map((item) => (
          <NavItem key={item.to} to={item.to} label={item.label} />
        ))}
      </nav>
    </aside>
  );
}
