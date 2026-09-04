/**
 * TenantSelect — wiederverwendbarer Händler-Picker (P1.3).
 *
 * Nutzt useTenants() + die design-system Select-Primitive. Liefert die kanonische
 * tenant_id (String) zurück — belastbar seit P0.2 (companies.pk = überall dieselbe
 * id). Eingesetzt in Support-Konsole, später Bot-Test-Lab / E2E-Runner / Live-Sim.
 */
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTenants } from '@/hooks/useTenants';

interface TenantSelectProps {
    value: string | null;
    onChange: (tenantId: string) => void;
    placeholder?: string;
    className?: string;
    includeDeleted?: boolean;
}

export function TenantSelect({
    value,
    onChange,
    placeholder = 'Händler wählen…',
    className,
    includeDeleted = false,
}: TenantSelectProps): JSX.Element {
    const { tenants, isLoading, error, refetch } = useTenants({ includeDeleted });

    return (
        <>
            <Select
                value={value ?? undefined}
                onValueChange={onChange}
                disabled={isLoading || Boolean(error)}
            >
                <SelectTrigger className={className} aria-invalid={Boolean(error)}>
                    <SelectValue
                        placeholder={
                            isLoading
                                ? 'Lade Händler…'
                                : error
                                  ? 'Händler konnten nicht geladen werden'
                                  : placeholder
                        }
                    />
                </SelectTrigger>
                <SelectContent>
                    {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {t.payment_status?.trim().toLowerCase() === 'suspended'
                                ? ' · gesperrt'
                                : ''}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {error && (
                <p role="alert" className="mt-1 text-xs text-status-danger">
                    Die Kundenzuweisung ist derzeit nicht verfügbar.{' '}
                    <button type="button" className="underline" onClick={refetch}>
                        Erneut laden
                    </button>
                </p>
            )}
        </>
    );
}
