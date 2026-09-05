import { z } from 'zod';
import { apiFetch } from './client';

const optionalText = z.string().nullish();
export const ReadinessProfileSchema = z.object({
    dpaAcceptedAt: z.string().nullable(),
    dpaVersion: z.string().nullable(),
    billing: z.object({ company_name: optionalText, company_address: optionalText, company_zip: optionalText, company_city: optionalText, iban: optionalText }).nullable(),
    tax: z.object({ business_type: z.enum(['sole_trader', 'company']).nullish(), tax_method: z.enum(['IST', 'SOLL']).nullish(), small_business: z.boolean().optional(), period_type: z.enum(['monthly', 'quarterly']).nullish(), vat_id: optionalText, tax_number: optionalText }).nullable(),
});
export type ReadinessProfile = z.infer<typeof ReadinessProfileSchema>;
export function parseReadinessProfile(value: unknown): ReadinessProfile {
    const parsed = ReadinessProfileSchema.safeParse(value);
    if (!parsed.success) throw new Error('Die Serverantwort zu den Firmendaten ist unvollständig. Bitte erneut laden.');
    return parsed.data;
}
export async function getReadinessProfile(tenantId: string): Promise<ReadinessProfile> {
    return parseReadinessProfile(await apiFetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/readiness-profile`));
}
