import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Compass, Ellipsis, Search, ShoppingCart, Store, type LucideIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { loginUrl } from '@/components/RequireRole';
import { useAuth } from '@/lib/auth';
import { getMe } from '@/lib/endpoints';
import type { DemoSession } from '@/lib/types';
import { useAsync } from '@/lib/useAsync';
import { cn } from '@/lib/utils';

const nav: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'For you', icon: Compass },
  { to: '/seller-center', label: 'Sell', icon: Store },
];

const footerLinks = ['Company', 'Program', 'Terms & Policies'];

export function Logo({ withName = false, className }: { withName?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5 font-bold text-ink', className)} aria-label="Tiptop Shop home">
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-ink text-lg text-white">t</span>
      {withName ? <span className="text-lg tracking-tight">Tiptop Shop</span> : null}
    </Link>
  );
}

function MoreMenu({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <DropdownMenuItem asChild>
          <Link to="/console">Test Console</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Home only: full sidebar (280px). */
function Sidebar({ className }: { className?: string }) {
  return (
    <aside className={cn('fixed inset-y-0 left-0 z-40 w-[280px] flex-col border-r border-line-soft bg-white px-4 py-5', className)}>
      <Logo withName className="px-2" />
      <nav className="mt-6 flex flex-col gap-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              cn('flex h-12 items-center gap-3 rounded-lg px-3 text-[17px] font-semibold hover:bg-surface-2', isActive ? 'text-buyer' : 'text-ink')
            }
          >
            <Icon className="size-6" />
            {label}
          </NavLink>
        ))}
        <MoreMenu>
          <button type="button" className="flex h-12 cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-[17px] font-semibold hover:bg-surface-2">
            <Ellipsis className="size-6" />
            More
          </button>
        </MoreMenu>
      </nav>
      <footer className="mt-auto flex flex-col gap-1 border-t border-line-soft px-2 pt-4 text-xs text-muted-2">
        {footerLinks.map((l) => <span key={l}>{l}</span>)}
        <span className="mt-2">© 2026 Tiptop Shop · simulator, fake data</span>
      </footer>
    </aside>
  );
}

/** Other buyer pages: icon rail (76px). */
function Rail({ className }: { className?: string }) {
  const item = 'flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium hover:bg-surface-2';
  return (
    <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-[76px] flex-col items-center gap-2 border-r border-line-soft bg-white py-5', className)}>
      <Logo className="mb-4" />
      {nav.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end className={({ isActive }) => cn(item, isActive ? 'text-buyer' : 'text-ink')}>
          <Icon className="size-6" />
          {label}
        </NavLink>
      ))}
      <MoreMenu>
        <button type="button" className={cn(item, 'cursor-pointer text-ink')}>
          <Ellipsis className="size-6" />
          More
        </button>
      </MoreMenu>
    </aside>
  );
}

function SearchPill() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const urlQ = params.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  // follow the URL (Clear search, back/forward)
  useEffect(() => setQ(urlQ), [urlQ]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/?q=${encodeURIComponent(term)}` : '/');
  };
  return (
    <form role="search" onSubmit={submit} className="flex h-10 w-full max-w-[360px] items-center gap-2 rounded-full bg-surface px-4 focus-within:ring-2 focus-within:ring-ring/40">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products"
        aria-label="Search products"
        className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
      />
    </form>
  );
}

function BuyerMenu({ buyer }: { buyer: DemoSession }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const me = useAsync(() => getMe(buyer), [buyer.sessionToken]);
  const name = me.data?.buyer?.name ?? 'Buyer';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Account menu" className="cursor-pointer rounded-full py-1 pl-2 pr-1">
          <Avatar className="size-8">
            <AvatarFallback className="bg-buyer text-xs font-semibold text-white">{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account/orders">My orders</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await signOut('BUYER');
            navigate('/');
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountPill() {
  const { buyer } = useAuth();
  const location = useLocation();
  return (
    <div className="flex h-10 shrink-0 items-center rounded-full border border-line bg-white text-sm font-semibold">
      <Link to="/cart" className="flex h-full items-center gap-1.5 rounded-l-full pl-4 pr-3 hover:bg-surface-2">
        <ShoppingCart className="size-4" />
        Cart
      </Link>
      <span className="h-5 w-px bg-line" aria-hidden />
      {buyer ? (
        <BuyerMenu buyer={buyer} />
      ) : (
        <Link to={loginUrl(location.pathname + location.search)} className="flex h-full items-center rounded-r-full pl-3 pr-4 hover:bg-surface-2">
          Sign in
        </Link>
      )}
    </div>
  );
}

/** Buyer shell for /, /product/:id, /cart, /checkout and /account/*. */
export function ShopLayout() {
  const home = useLocation().pathname === '/';
  return (
    <div className="min-h-screen bg-white font-sans text-[15px] text-ink">
      {home ? (
        <>
          <Sidebar className="hidden lg:flex" />
          <Rail className="lg:hidden" />
        </>
      ) : (
        <Rail />
      )}
      <div className={cn('min-h-screen', home ? 'pl-[76px] lg:pl-[280px]' : 'pl-[76px]')}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-3 bg-white/95 px-6 backdrop-blur">
          <SearchPill />
          <AccountPill />
        </header>
        <main className="px-6 pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
