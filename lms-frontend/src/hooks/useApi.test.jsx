import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApi } from './useApi';

/**
 * Every data-driven page in this app leans on useApi for its three states, so
 * the contract it exposes is worth pinning down.
 */
describe('useApi', () => {
  it('starts in a loading state before the request settles', async () => {
    const request = vi.fn(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useApi(request, []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('exposes the response body once the request resolves', async () => {
    const request = vi.fn(async () => ({ data: [{ id: 1, name: 'Machine Learning' }] }));
    const { result } = renderHook(() => useApi(request, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 1, name: 'Machine Learning' }]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces the server message when the request fails', async () => {
    const request = vi.fn(async () => {
      throw { response: { data: { message: 'You do not teach this course.' } } };
    });
    const { result } = renderHook(() => useApi(request, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('You do not teach this course.');
    expect(result.current.data).toBeNull();
  });

  it('falls back to a readable message when the server sends none', async () => {
    const request = vi.fn(async () => { throw new Error('Network Error'); });
    const { result } = renderHook(() => useApi(request, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network Error');
  });

  it('treats a 204 with no body as null rather than throwing', async () => {
    const request = vi.fn(async () => ({ status: 204, data: undefined }));
    const { result } = renderHook(() => useApi(request, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('honours the initialData option so lists can render before the first response', () => {
    const request = vi.fn(() => new Promise(() => {}));
    const { result } = renderHook(() => useApi(request, [], { initialData: [] }));

    expect(result.current.data).toEqual([]);
  });

  it('does not fire the request when immediate is false', () => {
    const request = vi.fn(async () => ({ data: 'x' }));
    const { result } = renderHook(() => useApi(request, [], { immediate: false }));

    expect(request).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('refetch re-runs the request and clears a previous error', async () => {
    let attempt = 0;
    const request = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('Network Error');
      return { data: 'recovered' };
    });

    const { result } = renderHook(() => useApi(request, []));
    await waitFor(() => expect(result.current.error).toBe('Network Error'));

    await act(async () => { await result.current.refetch(); });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('recovered');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not set state after the component has unmounted', async () => {
    let resolve;
    const request = vi.fn(() => new Promise((r) => { resolve = r; }));
    const { unmount } = renderHook(() => useApi(request, []));

    unmount();
    // Resolving after unmount must not trigger a React state-update warning.
    await act(async () => { resolve({ data: 'late' }); });
  });
});