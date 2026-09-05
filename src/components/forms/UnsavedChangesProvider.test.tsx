import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { UnsavedChangesProvider } from './UnsavedChangesProvider';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

function Editor() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useUnsavedChanges('Händler-Einrichtung', text.length > 0, busy);
  useUnsavedChanges('Vertragsdaten', text.length > 0);
  return <><input aria-label="Eingabe" value={text} onChange={event => setText(event.target.value)} /><button onClick={() => setBusy(true)}>Speichern starten</button><button onClick={() => { setBusy(false); setText(''); }}>Server bestätigt</button><Link to="/other">Anderer Bereich</Link></>;
}
function Workspace() {
  const location = useLocation();
  return <UnsavedChangesProvider>{location.pathname === '/form' ? <Editor /> : <h1>Anderer Bereich geöffnet</h1>}</UnsavedChangesProvider>;
}
function mount() {
  const router = createMemoryRouter([{ path: '*', element: <Workspace /> }], { initialEntries: ['/other', '/form'], initialIndex: 1 });
  render(<RouterProvider router={router} />);
  return router;
}
describe('in-application draft protection', () => {
  it('aggregates dirty forms, preserves input when cancelled and allows explicit discard', async () => {
    mount();
    fireEvent.change(screen.getByLabelText('Eingabe'), { target: { value: 'Not saved' } });
    fireEvent.click(screen.getByText('Anderer Bereich'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Ungespeicherte Änderungen');
    expect(screen.getByLabelText('Noch nicht gespeicherte Bereiche')).toHaveTextContent('Händler-Einrichtung');
    expect(screen.getByLabelText('Noch nicht gespeicherte Bereiche')).toHaveTextContent('Vertragsdaten');
    fireEvent.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }));
    expect(screen.getByLabelText('Eingabe')).toHaveValue('Not saved');
    fireEvent.click(screen.getByText('Anderer Bereich'));
    fireEvent.click(await screen.findByRole('button', { name: 'Verwerfen und wechseln' }));
    expect(await screen.findByRole('heading', { name: 'Anderer Bereich geöffnet' })).toBeVisible();
  });
  it('also blocks back navigation and does not discard an in-flight save', async () => {
    const router = mount();
    fireEvent.change(screen.getByLabelText('Eingabe'), { target: { value: 'Draft' } });
    fireEvent.click(screen.getByText('Speichern starten'));
    await act(async () => { await router.navigate(-1); });
    expect(await screen.findByRole('dialog')).toHaveTextContent('Speicherung läuft');
    expect(screen.getByRole('button', { name: 'Verwerfen und wechseln' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }));
    fireEvent.click(screen.getByText('Server bestätigt'));
    await act(async () => { await router.navigate(-1); });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Anderer Bereich geöffnet' })).toBeVisible());
  });
  it('does not interrupt navigation from a clean form', async () => {
    mount(); fireEvent.click(screen.getByText('Anderer Bereich'));
    expect(await screen.findByRole('heading', { name: 'Anderer Bereich geöffnet' })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
