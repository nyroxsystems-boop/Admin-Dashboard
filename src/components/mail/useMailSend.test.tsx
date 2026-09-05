import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { sendInboxEmail, updateInboxAssignment } from '@/api/inbox';
import { useMailSend } from './useMailSend';

vi.mock('@/api/inbox', () => ({ sendInboxEmail: vi.fn(), updateInboxAssignment: vi.fn() }));
const input = { from: 'info@partsunion.de', to: ['kunde@example.test'], subject: 'Antwort', body: 'Bestätigt.', htmlContent: '<p>Bestätigt.</p>' };
beforeEach(() => vi.resetAllMocks());

it('serializes sending and rejects same-tick double submissions', async () => {
    let done!: (value: { success: boolean; messageId: string }) => void;
    vi.mocked(sendInboxEmail).mockImplementation(() => new Promise(resolve => { done = resolve; }));
    const { result } = renderHook(() => useMailSend(vi.fn()));
    let first!: Promise<void>;
    act(() => { first = result.current.send(input); void result.current.send(input); });
    expect(sendInboxEmail).toHaveBeenCalledTimes(1);
    await act(async () => { done({ success: true, messageId: 'sent1' }); await first; });
    expect(result.current.phase).toBe('done');
});

it('keeps the exact payload and requestId when delivery is unconfirmed', async () => {
    vi.mocked(sendInboxEmail).mockRejectedValueOnce(new Error('Timeout')).mockResolvedValueOnce({ success: true, messageId: 'sent1' });
    const { result } = renderHook(() => useMailSend(vi.fn()));
    await act(async () => { await result.current.send(input); });
    expect(result.current.phase).toBe('unconfirmed'); expect(result.current.locked).toBe(true);
    await act(async () => { await result.current.retry(); });
    expect(vi.mocked(sendInboxEmail).mock.calls[1][0]).toEqual(vi.mocked(sendInboxEmail).mock.calls[0][0]);
    expect(result.current.phase).toBe('done');
});

it('retries only assignment after successful delivery and failed completion', async () => {
    vi.mocked(sendInboxEmail).mockResolvedValue({ success: true, messageId: 'sent1' });
    vi.mocked(updateInboxAssignment).mockRejectedValueOnce(new Error('Assignment unavailable')).mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useMailSend(vi.fn()));
    await act(async () => { await result.current.send(input, 'original1'); });
    expect(result.current.phase).toBe('finishFailed');
    await act(async () => { await result.current.retryFinish(); });
    expect(result.current.phase).toBe('done'); expect(sendInboxEmail).toHaveBeenCalledTimes(1);
    expect(updateInboxAssignment).toHaveBeenCalledTimes(2); expect(updateInboxAssignment).toHaveBeenLastCalledWith('original1', { status: 'done' });
});

it('allows correction only after a definitive validation rejection', async () => {
    vi.mocked(sendInboxEmail).mockRejectedValue(new ApiError('Invalid address', 400));
    const { result } = renderHook(() => useMailSend(vi.fn()));
    await act(async () => { await result.current.send(input); });
    expect(result.current.phase).toBe('editing'); expect(result.current.error).toBe('Invalid address');
});

it('shows an actionable delivery message rather than a raw API URL for server failures', async () => {
    vi.mocked(sendInboxEmail).mockRejectedValue(new ApiError('Server error 503 on /api/inbox/email/send', 503));
    const { result } = renderHook(() => useMailSend(vi.fn()));
    await act(async () => { await result.current.send(input); });
    expect(result.current.error).toBe('Keine eindeutige Versandbestätigung erhalten.');
});
