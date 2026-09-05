import { beforeEach, expect, it, vi } from 'vitest';
import { apiFetch } from './client';
import { createDraft, sendInboxEmail, updateDraft, updateInboxAssignment } from './inbox';

vi.mock('./client', () => ({ apiFetch: vi.fn(), API_BASE_URL: 'http://test.local', getAuthToken: () => null, getAuthorizationValue: () => null }));
const input = { from: 'info@partsunion.de', to: ['kunde@example.test'], subject: 'Prüfung', body: 'Antwort' };
beforeEach(() => vi.resetAllMocks());

it('does not report an unacknowledged send response as a delivered email', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: false });
    await expect(sendInboxEmail({ ...input, requestId: 'request-1' })).rejects.toThrow();
    vi.mocked(apiFetch).mockResolvedValue({ success: true, messageId: 'sent-1' });
    await expect(sendInboxEmail({ ...input, requestId: 'request-1' })).resolves.toEqual({ success: true, messageId: 'sent-1' });
});
it('requires a real draft ID on creation and an acknowledgement on update', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true });
    await expect(createDraft(input)).rejects.toThrow();
    vi.mocked(apiFetch).mockResolvedValue({ success: false });
    await expect(updateDraft('draft-1', input)).rejects.toThrow();
});
it('cannot mark send-and-complete finished when assignment was not acknowledged', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: false });
    await expect(updateInboxAssignment('original-1', { status: 'done' })).rejects.toThrow();
});
