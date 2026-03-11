import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/client.js";

function parseTrustedOrigins() {
    const configuredOrigins = process.env["TRUSTED_ORIGINS"]
        ?.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean) ?? [];

    const defaultOrigins = [
        process.env["APP_BASE_URL"],
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ].filter((origin): origin is string => Boolean(origin));

    return Array.from(new Set([...defaultOrigins, ...configuredOrigins]));
}

const appBaseUrl = process.env["APP_BASE_URL"] ?? "http://localhost:3000";
const trustedOrigins = parseTrustedOrigins();
const useSecureCookies =
    process.env["NODE_ENV"] === "production" ||
    appBaseUrl.startsWith("https://");

export const auth = betterAuth({
    baseURL: appBaseUrl,
    trustedOrigins,
    database: drizzleAdapter(db, {
        provider: "sqlite",
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    advanced: {
        defaultCookieAttributes: {
            httpOnly: true,
            sameSite: "lax",
            secure: useSecureCookies,
        },
        useSecureCookies,
    },
});
