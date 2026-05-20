'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.AuthService = void 0;
exports.configureAuthClient = configureAuthClient;
const client_1 = require('better-auth/client');
let apiBaseUrl = '';
function configureAuthClient(baseURL) {
  apiBaseUrl = baseURL.replace(/\/auth\/?$/, '');
}
function getAuthClient() {
  return (0, client_1.createAuthClient)({
    baseURL: `${apiBaseUrl}/auth`,
  });
}
async function request(path, init) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message ?? `Request failed with status ${response.status}`);
  }
  return await response.json();
}
exports.AuthService = {
  signIn: async (email, password) => {
    return await getAuthClient().signIn.email({
      email,
      password,
    });
  },
  signUp: async (email, password, name) => {
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
  changePassword: async (currentPassword, newPassword, revokeOtherSessions = true) => {
    return await getAuthClient().changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions,
    });
  },
  getProfile: async () => {
    return await request('/me');
  },
  updateProfile: async (payload) => {
    return await request('/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  completeOnboarding: async (workspaceMode) => {
    return await request('/me', {
      method: 'PATCH',
      body: JSON.stringify({
        workspaceMode,
        onboardingCompleted: true,
      }),
    });
  },
};
