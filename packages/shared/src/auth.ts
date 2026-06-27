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
    createdAt: string | number;
    updatedAt?: string | number;
    workspaceMode?: WorkspaceMode | null;
    onboardingCompleted?: boolean;
    archiveAutoDelete?: boolean;
    captureBehavior?: CaptureBehavior | null;
  };
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
