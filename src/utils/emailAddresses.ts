const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmailAddresses(value: string): string[] {
    return [...new Set(
        value
            .split(/[,;\n\r]+(?=(?:[^"]*"[^"]*")*[^"]*$)/)
            .map((address) => {
                const value = address.trim();
                const named = value.match(/^[^<>]*<([^<>]+)>$/);
                return (named ? named[1] : value).trim().toLowerCase();
            })
            .filter(Boolean),
    )];
}

export function invalidEmailAddresses(value: string): string[] {
    return parseEmailAddresses(value).filter((address) => (
        address.length > 254 || !EMAIL_ADDRESS_PATTERN.test(address)
    ));
}
