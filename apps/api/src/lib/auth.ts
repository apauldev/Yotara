import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/client.js";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "sqlite",
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
    },
    sessionConfig: {
        cookieOptions: {
    advanced: {
        defaultCookieAttributes: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
        },
    },
});
