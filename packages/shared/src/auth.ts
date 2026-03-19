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
  getProfile: async () => {
    return await request<ProfileResponse>('/me');
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
