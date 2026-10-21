import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Footprints, Glasses, House, Luggage, CookingPot, Shirt, Smartphone, Sparkles, Tent, Watch, type LucideIcon } from 'lucide-react';
import { MockBadge } from '@/components/ui/mock-badge';
import { useHorizontalScroll } from '@/lib/useHorizontalScroll';
import { cn } from '@/lib/utils';
import { mockCategories } from '@/mocks';

/** Icon shown while a category has no picture. */
const icons: Record<string, LucideIcon> = {
  womenswear: Shirt,
  'phones-electronics': Smartphone,
  'fashion-accessories': Watch,
  menswear: Shirt,
  'home-supplies': House,
  beauty: Sparkles,
  shoes: Footprints,
  'sports-outdoor': Tent,
  'luggage-bags': Luggage,
  kitchenware: CookingPot,
};

function Arrow({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={dir === 'prev' ? 'Previous categories' : 'Next categories'}
      onClick={onClick}
      className={cn(
        'absolute top-[42px] z-10 flex size-9 cursor-pointer items-center justify-center rounded-full bg-white text-ink shadow-md ring-1 ring-line-soft hover:bg-surface-2',
        dir === 'prev' ? '-left-3' : '-right-3',
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

/** Home "Categories" row (TikTok Shop style): round tiles that filter the home page by ?category=. */
export function CategoryRow() {
  const [params] = useSearchParams();
  const active = params.get('category');
  const { ref, edges, update, page } = useHorizontalScroll<HTMLUListElement>();

  /** Toggles the category and keeps the search term. */
  const linkFor = (slug: string) => {
    const next = new URLSearchParams(params);
    if (active === slug) next.delete('category');
    else next.set('category', slug);
    const qs = next.toString();
    return qs ? `/?${qs}` : '/';
  };

  return (
    <section aria-labelledby="categories" className="mt-2">
      <div className="mb-4 flex items-center gap-3">
        <h2 id="categories" className="text-xl font-bold tracking-tight text-ink">
          Categories
        </h2>
        {import.meta.env.DEV ? <MockBadge /> : null}
      </div>
      <div className="relative">
        {!edges.start ? <Arrow dir="prev" onClick={() => page(-1)} /> : null}
        <ul ref={ref} onScroll={update} className="flex gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mockCategories.map((c) => {
            const Icon = icons[c.slug] ?? Glasses;
            const on = active === c.slug;
            return (
              <li key={c.slug} className="w-[132px] shrink-0">
                <Link to={linkFor(c.slug)} aria-current={on ? 'true' : undefined} className="group flex flex-col items-center gap-2.5 rounded-xl px-1 py-1 text-center">
                  <span
                    className={cn('flex size-[110px] items-center justify-center overflow-hidden rounded-full ring-2 transition-transform group-hover:scale-[1.03]', on ? 'ring-buyer' : 'ring-transparent')}
                    style={{ backgroundColor: c.bg }}
                  >
                    {c.image ? <img src={c.image} alt="" className="size-full object-cover" /> : <Icon className="size-12 text-ink/70" strokeWidth={1.5} aria-hidden />}
                  </span>
                  <span className={cn('line-clamp-2 text-[15px] font-semibold leading-snug', on ? 'text-buyer' : 'text-ink')}>{c.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {!edges.end ? <Arrow dir="next" onClick={() => page(1)} /> : null}
      </div>
    </section>
  );
}
