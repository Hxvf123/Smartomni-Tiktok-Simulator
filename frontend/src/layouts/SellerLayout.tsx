import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
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
  cn('flex h-9 items-center rounded-lg px-3 text-sm', isActive ? 'bg-teal-soft font-semibold text-teal' : 'text-ink hover:bg-surface-2');

function SideMenu() {
  return (
    <nav aria-label="Seller Center" className="sticky top-14 h-[calc(100vh-3.5rem)] w-[232px] shrink-0 overflow-y-auto border-r border-line-soft bg-white px-3 py-4">
      {menu.map(({ label, icon: Icon, to, items }) =>
        to ? (
          <NavLink key={label} to={to} end className={(s) => cn(linkClass(s), 'mb-1 gap-2.5 font-semibold')}>
            <Icon className="size-[18px]" />
            {label}
          </NavLink>
        ) : (
          <div key={label} className="mb-1">
            <div className="flex h-9 items-center gap-2.5 px-3 text-sm font-semibold text-ink">
              <Icon className="size-[18px]" />
              {label}
            </div>
            {items?.map((i) => (
              <NavLink key={i.to} to={i.to} className={(s) => cn(linkClass(s), 'pl-[42px]')}>
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
    return <span className="max-w-[220px] truncate text-sm text-white/80">{current?.name ?? ''}</span>;
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
      <SelectTrigger aria-label="Shop" size="sm" className="h-8 min-w-[180px] rounded-full border-white/20 bg-white/10 text-white [&_svg]:text-white/70">
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
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 bg-ink px-5 text-white">
        <Link to={base} className="flex items-center gap-2.5 font-bold">
          <span className="flex size-8 items-center justify-center rounded-[9px] bg-white text-ink">t</span>
          <span>Tiptop Shop</span>
          {/* light teal on the black header */}
          <span className="font-semibold text-[#5FD4CD]">Seller Center</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <ShopPicker owner={owner} />
          <SellerMenu owner={owner} />
        </div>
      </header>
      <div className="flex">
        <SideMenu />
        <main className="min-w-0 flex-1 p-6">
          <Outlet context={{ sellerName: owner?.name } satisfies SellerContext} />
        </main>
      </div>
    </div>
  );
}
