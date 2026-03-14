import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/client.js";
import { getAppBaseUrl, getTrustedOrigins } from "./auth-origins.js";

const appBaseUrl = getAppBaseUrl();
const trustedOrigins = getTrustedOrigins();
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
