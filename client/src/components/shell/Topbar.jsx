import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../ui/button.jsx';

function TopNav({ menu = [] }) {
  if (!menu || menu.length === 0) return null;

  return (
    <nav className="hidden min-w-0 flex-1 md:block">
      <div className="flex items-center gap-1 overflow-x-auto px-2">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              [
                'whitespace-nowrap rounded-md px-3 py-2 text-sm',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default function Topbar({ menu = [] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold tracking-tight">PropertyPulse</div>
          <div className="hidden text-xs text-muted-foreground md:block">{user?.role || ''}</div>
        </div>

        <TopNav menu={menu} />

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden min-w-0 md:block">
            <div className="truncate text-xs text-muted-foreground">{user?.email || ''}</div>
          </div>
          <Button variant="outline" onClick={() => navigate('/profile')}>
            Profile
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
