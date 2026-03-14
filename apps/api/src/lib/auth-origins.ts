function parseOriginList(value: string | undefined) {
    return value
        ?.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean) ?? [];
}

export function getAppBaseUrl() {
    return process.env["APP_BASE_URL"] ?? "http://localhost:3000";
}

export function getTrustedOrigins() {
    const configuredOrigins = parseOriginList(process.env["TRUSTED_ORIGINS"]);
    const defaultOrigins = [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ];

    return Array.from(new Set([...defaultOrigins, ...configuredOrigins]));
}

export function getCorsOrigins() {
    const configuredOrigins = parseOriginList(process.env["CORS_ORIGIN"]);

    return Array.from(new Set([...getTrustedOrigins(), ...configuredOrigins]));
}
