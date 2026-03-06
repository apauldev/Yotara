import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
    // You can also use an environment variable here if preferred
    baseURL: "http://localhost:3000"
});

export const AuthService = {
    signIn: async (email: string, password: string) => {
        return await authClient.signIn.email({
            email,
            password
        });
    },
    signUp: async (email: string, password: string, name: string) => {
        return await authClient.signUp.email({
            email,
            password,
            name
        });
    },
    signOut: async () => {
        return await authClient.signOut();
    },
    getSession: async () => {
        return await authClient.getSession();
    }
};
