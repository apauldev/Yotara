import { createAuthClient } from 'better-auth/client';
import type { WorkspaceMode } from './index';

let apiBaseUrl = '';

export function configureAuthClient(baseURL: string) {
  apiBaseUrl = baseURL.replace(/\/auth\/?$/, '');
}

function getAuthClient() {
  return createAuthClient({
    baseURL: `${apiBaseUrl}/auth`,
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorBody?.message ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export type CaptureBehavior = 'quick' | 'capture';

export interface ProfileResponse {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    emailVerified?: boolean;
    passwordSetupRequired?: boolean;
    createdAt: string | number;
    updatedAt?: string | number;
    workspaceMode?: WorkspaceMode | null;
    onboardingCompleted?: boolean;
    archiveAutoDelete?: boolean;
    captureBehavior?: CaptureBehavior | null;
  };
}

export interface DataCounts {
  tasks: number;
  projects: number;
  labels: number;
}

export interface ClientConfig {
  requireEmailVerification: boolean;
  devMode: boolean;
}

export const AuthService = {
  getConfig: async () => {
    return await request<ClientConfig>('/config');
  },
  verifyEmail: async (token: string) => {
    return await getAuthClient().verifyEmail({ query: { token } });
  },
  sendVerificationEmail: async (email: string) => {
    return await getAuthClient().sendVerificationEmail({ email });
  },
  setPassword: async (newPassword: string) => {
    return await request<{ ok: true }>('/me/password/set', {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },
  signIn: async (email: string, password: string) => {
    return await getAuthClient().signIn.email({
      email,
      password,
    });
  },
  signUp: async (email: string, password: string, name: string, website = '') => {
    // The honeypot "website" field is sent so the auth bridge can detect bots.
    // Better Auth's client type is strict; the server accepts and strips it.
    const authClient = getAuthClient();
    type SignUpBody = Parameters<typeof authClient.signUp.email>[0];
    return await authClient.signUp.email({
      email,
      password,
      name,
      website,
    } as unknown as SignUpBody);
  },
  signOut: async () => {
    return await getAuthClient().signOut();
  },
  getSession: async () => {
    return await getAuthClient().getSession();
  },
  changePassword: async (
    currentPassword: string,
    newPassword: string,
    revokeOtherSessions = true,
  ) => {
    return await getAuthClient().changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions,
    });
  },
  getProfile: async () => {
    return await request<ProfileResponse>('/me');
  },
  forgotPassword: async (email: string) => {
    const result = await getAuthClient().requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return result;
  },
  resetPassword: async (newPassword: string, token: string) => {
    const result = await getAuthClient().resetPassword({
      newPassword,
      token,
    });
    return result;
  },
  updateProfile: async (payload: {
    workspaceMode?: WorkspaceMode;
    onboardingCompleted?: boolean;
    archiveAutoDelete?: boolean;
    captureBehavior?: CaptureBehavior;
  }) => {
    return await request<ProfileResponse>('/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  deleteAccount: async (password: string) => {
    return await request<{ ok: true }>('/me', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
  },
  getCounts: async () => {
    return await request<DataCounts>('/me/counts');
  },
  completeOnboarding: async (workspaceMode: WorkspaceMode) => {
    return await request<ProfileResponse>('/me', {
      method: 'PATCH',
      body: JSON.stringify({
        workspaceMode,
        onboardingCompleted: true,
      }),
    });
  },
};
