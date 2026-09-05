import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mailWorkspaceMessages } from '@/test/fixtures/mailWorkspace';
import InboxView from './InboxView';

const api = vi.hoisted(() => ({ read: vi.fn(), body: vi.fn(), move: vi.fn() }));
vi.mock('@/api/inbox', () => ({ getInboxMessage: api.body }));
vi.mock('@/components/mail/MailWorkflow', () => ({ MailConversation: () => null, MailInternalNote: () => null, MailWorkflow: () => null }));
vi.mock('@/components/mail/MailHtmlFrame', () => ({ MailHtmlFrame: () => <p>Vollständiger Nachrichteninhalt</p> }));
vi.mock('@/components/mail/MailComposer', () => ({ MailComposer: () => null }));
vi.mock('@/hooks/useInbox', () => {
    const mutation = () => ({ mutate: vi.fn(), isPending: false });
    return {
        useInbox: () => ({ items: mailWorkspaceMessages, isLoading: false, isFetching: false, error: null, hasNextPage: true, refetch: vi.fn() }),
        useMailboxes: () => ({ mailboxes: [{ id: 'all', name: 'Alle Postfächer', unread: 1 }], sendingAddresses: ['team@partsunion.de'], refetch: vi.fn() }),
        useMarkInboxRead: () => ({ mutate: api.read, isPending: false }),
        useMoveInboxMessage: () => ({ mutate: api.move, isPending: false }), useMarkAsSpam: mutation, useMarkAsNotSpam: mutation, useRestoreInboxMessage: mutation,
    };
});
function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><InboxView /></QueryClientProvider>);
}
describe('Mailbox workspace', () => {
    beforeEach(() => { vi.clearAllMocks(); api.body.mockImplementation(async (id: string) => mailWorkspaceMessages.find(message => message.id === id)); api.move.mockImplementation((_input, options) => options?.onSuccess?.()); });
    it('shows actionable status, ownership, attachments and honest paged counts', () => {
        mount();
        const list = within(screen.getByRole('list', { name: 'E-Mail-Liste' }));
        expect(list.getByText('Ungelesen')).toBeInTheDocument();
        expect(list.getByText('In Bearbeitung')).toBeInTheDocument();
        expect(list.getByText('Elias')).toBeInTheDocument();
        expect(list.getByText('Anhänge')).toBeInTheDocument();
        expect(screen.getByText('3 Nachrichten geladen · weitere vorhanden')).toBeInTheDocument();
        expect(api.body).not.toHaveBeenCalled();
    });
    it('navigates focus without fetching bodies or marking messages read', async () => {
        mount();
        const buttons = within(screen.getByRole('list', { name: 'E-Mail-Liste' })).getAllByRole('button');
        buttons[0].focus();
        fireEvent.keyDown(buttons[0], { key: 'ArrowDown' });
        expect(buttons[1]).toHaveFocus();
        fireEvent.keyDown(buttons[1], { key: 'End' });
        expect(buttons[2]).toHaveFocus();
        fireEvent.keyDown(buttons[2], { key: 'Home' });
        expect(buttons[0]).toHaveFocus();
        expect(api.body).not.toHaveBeenCalled();
        expect(api.read).not.toHaveBeenCalled();
        fireEvent.click(buttons[0]);
        await waitFor(() => expect(api.body).toHaveBeenCalledWith('preview-1'));
        expect(buttons[0]).toHaveAttribute('aria-current', 'true');
        expect(api.read).toHaveBeenCalledTimes(1);
    });
    it('continues with the next conversation after archiving', async () => {
        mount();
        const buttons = within(screen.getByRole('list', { name: 'E-Mail-Liste' })).getAllByRole('button');
        fireEvent.click(buttons[0]);
        await screen.findByText('Vollständiger Nachrichteninhalt');
        fireEvent.click(screen.getByRole('button', { name: 'Archivieren' }));
        await waitFor(() => expect(api.body).toHaveBeenCalledWith('preview-2'));
        expect(buttons[1]).toHaveAttribute('aria-current', 'true');
    });
});
