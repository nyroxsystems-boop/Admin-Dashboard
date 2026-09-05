import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxMessageSchema } from '@/api/types';
import { updateInboxAssignment } from '@/api/inbox';
import { MailInternalNote } from './MailWorkflow';

vi.mock('@/api/inbox', () => ({ updateInboxAssignment: vi.fn(), getInboxThread: vi.fn() }));
const message = InboxMessageSchema.parse({ id: 'mail-a', from: 'supplier@example.test', to: ['info@example.test'], subject: 'Delivery', received_at: '2026-09-04T10:00:00Z', assignment_notes: 'Original' });
function mount(note = message) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><MailInternalNote message={note} /></QueryClientProvider>);
    return { ...view, change: (next: typeof message) => view.rerender(<QueryClientProvider client={client}><MailInternalNote message={next} /></QueryClientProvider>) };
}
function edit() {
    fireEvent.click(screen.getByText('Interne Notiz', { exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Notiz bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Interne Notiz bearbeiten'), { target: { value: 'Internal only' } });
}
describe('Internal mail notes', () => {
    beforeEach(() => vi.resetAllMocks());
    it('sends only an assignment note with the original value, never email content', async () => {
        vi.mocked(updateInboxAssignment).mockResolvedValue({ success: true });
        mount(); edit();
        fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' }));
        await waitFor(() => expect(updateInboxAssignment).toHaveBeenCalledWith('mail-a', { notes: 'Internal only', expectedNotes: 'Original' }));
        await waitFor(() => expect(screen.queryByLabelText('Interne Notiz bearbeiten')).not.toBeInTheDocument());
    });
    it('retains the draft after a conflict and gives an explicit reload choice', async () => {
        vi.mocked(updateInboxAssignment).mockRejectedValue(new Error('Die Notiz wurde inzwischen geändert.'));
        mount(); edit();
        fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('inzwischen geändert');
        expect(screen.getByLabelText('Interne Notiz bearbeiten')).toHaveValue('Internal only');
        expect(screen.getByRole('button', { name: 'Eingabe verwerfen und neu laden' })).toBeEnabled();
    });
    it('does not overwrite another operator or carry a draft to another message', () => {
        const view = mount(); edit();
        view.change({ ...message, assignment_notes: 'Another operator' });
        expect(screen.getByRole('button', { name: 'Notiz speichern' })).toBeDisabled();
        expect(screen.getByLabelText('Interne Notiz bearbeiten')).toHaveValue('Internal only');
        view.change({ ...message, id: 'mail-b', assignment_notes: 'Different message' });
        expect(screen.queryByLabelText('Interne Notiz bearbeiten')).not.toBeInTheDocument();
        expect(updateInboxAssignment).not.toHaveBeenCalled();
    });
});
