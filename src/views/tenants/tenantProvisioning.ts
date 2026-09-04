import type { TenantTaxInput } from '@/api/tenants';

export interface TenantTaxDraft {
    businessType: '' | 'sole_trader' | 'company';
    smallBusiness: boolean;
    vatId: string;
    taxNumber: string;
    taxMethod: '' | 'IST' | 'SOLL';
}

/**
 * Builds the optional tax-profile part of the provisioning request.
 * Selecting only IST/SOLL is still an explicit tax decision and must not be
 * dropped just because the remaining inputs kept their defaults.
 */
export function buildTenantTaxInput(draft: TenantTaxDraft): TenantTaxInput | undefined {
    const taxTouched = Boolean(
        draft.vatId.trim()
        || draft.taxNumber.trim()
        || draft.businessType
        || draft.smallBusiness
        || draft.taxMethod,
    );
    if (!taxTouched) return undefined;

    const tax: TenantTaxInput = {
        small_business: draft.smallBusiness,
    };
    if (draft.vatId.trim()) tax.vat_id = draft.vatId.replace(/\s+/g, '');
    if (draft.taxNumber.trim()) tax.tax_number = draft.taxNumber.trim();
    if (draft.businessType) tax.business_type = draft.businessType;
    if (draft.taxMethod) tax.tax_method = draft.taxMethod;
    return tax;
}
