import { reactive } from 'vue';

interface User {
  username: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  initialized: boolean;
}

const state = reactive<AuthState>({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refresh_token'),
  initialized: false,
});

export function useAuth() {
  function login(user: User, token: string, refreshToken?: string) {
    state.user = user;
    state.token = token;
    state.refreshToken = refreshToken || null;
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    else localStorage.removeItem('refresh_token');
  }

  function logout() {
    state.user = null;
    state.token = null;
    state.refreshToken = null;
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
  }

  function isAuthenticated(): boolean {
    return !!state.token && !!state.user;
  }

  return { state, login, logout, isAuthenticated };
}
