import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AsyncState } from '../components/AsyncState';
import { ApiError } from '../lib/api';

describe('AsyncState', () => {
  it('renders loading, error, empty and data states consistently', () => {
    const { rerender } = render(<AsyncState data={undefined} loading error={undefined}>{() => <div>data</div>}</AsyncState>);
    expect(screen.getByRole('status').textContent).toMatch(/Loading/);

    rerender(<AsyncState data={undefined} loading={false} error={new ApiError('boom', 500, 'req-1')}>{() => <div>data</div>}</AsyncState>);
    expect(screen.getByRole('alert').textContent).toMatch(/boom/);
    expect(screen.getByRole('alert').textContent).toMatch(/req-1/);

    rerender(<AsyncState data={[] as number[]} loading={false} error={undefined} isEmpty={(d) => d.length === 0} emptyText="nothing">{() => <div>data</div>}</AsyncState>);
    expect(screen.getByText('nothing')).toBeTruthy();

    rerender(<AsyncState data={[1]} loading={false} error={undefined} isEmpty={(d) => d.length === 0}>{(d) => <div>{`count ${d.length}`}</div>}</AsyncState>);
    expect(screen.getByText('count 1')).toBeTruthy();
  });
});
