const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmailAddresses(value: string): string[] {
    return [...new Set(
        value
            .split(/[;,]/)
            .map((address) => address.trim().toLowerCase())
            .filter(Boolean),
    )];
}

export function invalidEmailAddresses(value: string): string[] {
    return parseEmailAddresses(value).filter((address) => (
        address.length > 254 || !EMAIL_ADDRESS_PATTERN.test(address)
    ));
}
