import { describe, expect, it } from 'vitest';

import { buildTenantTaxInput, type TenantTaxDraft } from './tenantProvisioning';

const EMPTY_TAX: TenantTaxDraft = {
    businessType: '',
    smallBusiness: false,
    vatId: '',
    taxNumber: '',
    taxMethod: '',
};

describe('tenant provisioning tax payload', () => {
    it('omits a completely untouched tax profile', () => {
        expect(buildTenantTaxInput(EMPTY_TAX)).toBeUndefined();
    });

    it('sends a tax-method-only decision', () => {
        expect(buildTenantTaxInput({ ...EMPTY_TAX, taxMethod: 'IST' })).toEqual({
            small_business: false,
            tax_method: 'IST',
        });
    });

    it('normalizes entered tax identifiers', () => {
        expect(
            buildTenantTaxInput({
                ...EMPTY_TAX,
                vatId: ' DE 123 456 789 ',
                taxNumber: ' 12/345/67890 ',
            }),
        ).toMatchObject({ vat_id: 'DE123456789', tax_number: '12/345/67890' });
    });
});
