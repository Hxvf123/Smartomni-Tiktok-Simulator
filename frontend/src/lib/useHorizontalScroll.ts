import { useCallback, useEffect, useRef, useState } from 'react';

/** A horizontally scrolling row paged by arrow buttons: the ref for the row, whether each edge is reached, and page(±1). */
export function useHorizontalScroll<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }, []);
  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, ...deps]);
  const page = (dir: 1 | -1) => ref.current?.scrollBy?.({ left: dir * ref.current.clientWidth, behavior: 'smooth' });
  return { ref, edges, update, page };
}
