import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordResetView from './PasswordResetView';
import { requestPasswordReset, resetPassword } from '@/api/auth';

vi.mock('@/api/auth', () => ({ requestPasswordReset: vi.fn(), resetPassword: vi.fn() }));
const token = 'a'.repeat(64);
const password = 'Parts!Secure90210';

describe('Admin account recovery', () => {
    beforeEach(() => vi.resetAllMocks());
    it('requests recovery and gives a neutral account-independent confirmation', async () => {
        vi.mocked(requestPasswordReset).mockResolvedValue({ success: true });
        render(<MemoryRouter initialEntries={['/reset-password']}><PasswordResetView /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('E-Mail oder Benutzername'), { target: { value: 'owner@partsunion.de' } });
        fireEvent.click(screen.getByRole('button', { name: 'Link anfordern' }));
        await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith('owner@partsunion.de'));
        expect(await screen.findByRole('status')).toHaveTextContent('Wenn ein passendes Konto existiert');
    });
    it('accepts the fragment token from the real recovery email without asking users to copy a token', async () => {
        vi.mocked(resetPassword).mockResolvedValue({ success: true });
        render(<MemoryRouter initialEntries={[`/reset-password#token=${token}`]}><PasswordResetView /></MemoryRouter>);
        expect(screen.queryByLabelText('Token')).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: password } });
        fireEvent.change(screen.getByLabelText('Passwort wiederholen'), { target: { value: password } });
        fireEvent.click(screen.getByRole('button', { name: 'Passwort speichern' }));
        await waitFor(() => expect(resetPassword).toHaveBeenCalledWith(token, password));
        expect(await screen.findByRole('status')).toHaveTextContent('Dein Passwort wurde geändert');
    });
    it('does not report success for expired or rejected links', async () => {
        vi.mocked(resetPassword).mockRejectedValue(new Error('Dieser Link ist abgelaufen.'));
        render(<MemoryRouter initialEntries={[`/reset-password?token=${token}`]}><PasswordResetView /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: password } });
        fireEvent.change(screen.getByLabelText('Passwort wiederholen'), { target: { value: password } });
        fireEvent.click(screen.getByRole('button', { name: 'Passwort speichern' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Dieser Link ist abgelaufen.');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
