import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { api } from '../lib/api';
import { clearStoredSession, getStoredSession, storeSession } from '../lib/auth-storage';
import { onSessionExpired } from '../lib/auth-events';

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  status: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string())
});

const sessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userSchema
});

const meSchema = z.object({
  user: userSchema
});

type User = z.infer<typeof userSchema>;

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message;
  }

  return 'Nao foi possivel conectar com a API.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const endSession = useCallback((message?: string) => {
    clearStoredSession();
    setUser(null);
    setError(message ?? null);
  }, []);

  useEffect(() => {
    return onSessionExpired(() => {
      endSession('Sessao expirada. Entre novamente.');
    });
  }, [endSession]);

  useEffect(() => {
    const session = getStoredSession();

    if (!session) {
      setIsLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((response) => {
        setUser(meSchema.parse(response.data).user);
      })
      .catch(() => {
        endSession('Sessao expirada. Entre novamente.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [endSession]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);

    try {
      const response = await api.post('/auth/login', { email, password });
      const session = sessionSchema.parse(response.data);

      storeSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken
      });
      setUser(session.user);
    } catch (loginError) {
      const message = getErrorMessage(loginError);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async () => {
    const session = getStoredSession();

    try {
      if (session?.refreshToken) {
        await api.post('/auth/logout', { refreshToken: session.refreshToken });
      }
    } finally {
      endSession();
    }
  }, [endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      error,
      login,
      logout,
      hasPermission: (permission) => Boolean(user?.permissions.includes(permission))
    }),
    [error, isLoading, login, logout, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
