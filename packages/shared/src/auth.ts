import { createAuthClient } from 'better-auth/client';

let authBaseUrl = '';

export function configureAuthClient(baseURL: string) {
  authBaseUrl = baseURL;
}

function getAuthClient() {
  return createAuthClient({
    baseURL: authBaseUrl,
  });
}

export const AuthService = {
  signIn: async (email: string, password: string) => {
    return await getAuthClient().signIn.email({
      email,
      password,
    });
  },
  signUp: async (email: string, password: string, name: string) => {
    return await getAuthClient().signUp.email({
      email,
      password,
      name,
    });
  },
  signOut: async () => {
    return await getAuthClient().signOut();
  },
  getSession: async () => {
    return await getAuthClient().getSession();
  },
};
