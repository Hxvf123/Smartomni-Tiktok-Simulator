import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { ClipboardList, Headset, LayoutDashboard, Megaphone, Package, Store, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import type { Identities } from '@/lib/types';
import { getIdentities } from '@/lib/endpoints';
import { useAsync } from '@/lib/useAsync';
import { cn } from '@/lib/utils';

interface MenuGroup {
  label: string;
  icon: LucideIcon;
  /** A group with `to` is a single link; otherwise it lists `items`. */
  to?: string;
  items?: { to: string; label: string }[];
}

const base = '/seller-center';
const menu: MenuGroup[] = [
  { label: 'Home', icon: LayoutDashboard, to: base },
  {
    label: 'Orders',
    icon: ClipboardList,
    items: [
      { to: `${base}/orders`, label: 'Manage orders' },
      { to: `${base}/returns`, label: 'Returns & refunds' },
    ],
  },
  { label: 'Products', icon: Package, to: `${base}/products` },
  { label: 'Marketing', icon: Megaphone, items: [{ to: `${base}/vouchers`, label: 'Vouchers' }] },
  { label: 'Customer service', icon: Headset, items: [{ to: `${base}/messages`, label: 'Messages' }] },
  { label: 'Shop', icon: Store, to: `${base}/shop` },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn('flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm', isActive ? 'bg-teal-soft font-semibold text-teal' : 'text-ink hover:bg-surface-2');

/** Side menu on md+; below md the same links become one horizontal strip under the header. */
function SideMenu() {
  const ref = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  // On the mobile strip the active link can be off screen.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);
  return (
    <nav
      ref={ref}
      aria-label="Seller Center"
      className="flex gap-1 overflow-x-auto border-b border-line-soft bg-white px-3 py-2 md:sticky md:top-14 md:block md:h-[calc(100vh-3.5rem)] md:w-[232px] md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r md:py-4"
    >
      {menu.map(({ label, icon: Icon, to, items }) =>
        to ? (
          <NavLink key={label} to={to} end className={(s) => cn(linkClass(s), 'gap-2.5 font-semibold md:mb-1')}>
            <Icon className="size-[18px]" />
            {label}
          </NavLink>
        ) : (
          <div key={label} className="max-md:contents md:mb-1">
            <div className="flex h-9 items-center gap-2.5 px-3 text-sm font-semibold text-ink max-md:hidden">
              <Icon className="size-[18px]" />
              {label}
            </div>
            {items?.map((i) => (
              <NavLink key={i.to} to={i.to} className={(s) => cn(linkClass(s), 'md:pl-[42px]')}>
                {i.label}
              </NavLink>
            ))}
          </div>
        ),
      )}
    </nav>
  );
}

type SellerIdentity = Identities['sellers'][number];

function ShopPicker({ owner }: { owner: SellerIdentity | undefined }) {
  const { seller, signIn } = useAuth();
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const shops = owner?.shops ?? [];
  const current = shops.find((x) => x.id === seller?.shopId);

  if (!owner || shops.length < 2) {
    return <span className="max-w-[140px] truncate text-sm text-white/80 sm:max-w-[220px]">{current?.name ?? ''}</span>;
  }
  const change = async (shopId: string) => {
    setSwitching(true);
    try {
      await signIn({ role: 'SELLER', sellerId: owner.id, shopId });
      navigate(base);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSwitching(false);
    }
  };
  return (
    <Select value={seller?.shopId} onValueChange={change} disabled={switching}>
      <SelectTrigger aria-label="Shop" size="sm" className="h-8 min-w-0 rounded-full sm:min-w-[180px] border-white/20 bg-white/10 text-white [&_svg]:text-white/70">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {shops.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SellerMenu({ owner }: { owner: SellerIdentity | undefined }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const name = owner?.name ?? 'Seller';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Seller account menu" className="cursor-pointer rounded-full">
          <Avatar className="size-8">
            <AvatarFallback className="bg-teal text-xs font-semibold text-white">{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/">Go to Tiptop Shop</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await signOut('SELLER');
            navigate('/');
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** What SellerLayout hands to the Seller Center pages (read with useSellerContext). */
export interface SellerContext {
  sellerName: string | undefined;
}

export const useSellerContext = () => useOutletContext<SellerContext>();

/** Seller Center shell for /seller-center/*. Teal theme via .theme-seller. */
export function SellerLayout() {
  const { seller } = useAuth();
  const ids = useAsync(getIdentities, []);
  const owner = ids.data?.sellers.find((s) => s.shops.some((x) => x.id === seller?.shopId));
  return (
    <div className="theme-seller min-h-screen bg-surface-2 font-sans text-[15px] text-ink">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-ink px-4 text-white md:gap-4 md:px-5">
        <Link to={base} className="flex shrink-0 items-center gap-2.5 font-bold">
          <span className="flex size-8 items-center justify-center rounded-[9px] bg-white text-ink">t</span>
          <span className="max-sm:hidden">Tiptop Shop</span>
          {/* light teal on the black header */}
          <span className="font-semibold text-[#5FD4CD]">Seller Center</span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <ShopPicker owner={owner} />
          <SellerMenu owner={owner} />
        </div>
      </header>
      <div className="flex flex-col md:flex-row">
        <SideMenu />
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet context={{ sellerName: owner?.name } satisfies SellerContext} />
        </main>
      </div>
    </div>
  );
}
