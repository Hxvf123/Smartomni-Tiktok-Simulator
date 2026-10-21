import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MockBadge } from '@/components/ui/mock-badge';

describe('MockBadge', () => {
  it('renders the label alone, or a frame around mocked content', () => {
    const { rerender, container } = render(<MockBadge />);
    expect(screen.getByText('MOCK')).toBeTruthy();
    expect(container.querySelector('[data-mock]')).toBeNull();

    rerender(<MockBadge><p>4.8 rating</p></MockBadge>);
    expect(screen.getByText('MOCK')).toBeTruthy();
    expect(screen.getByText('4.8 rating').closest('[data-mock]')).toBeTruthy();
  });
});
