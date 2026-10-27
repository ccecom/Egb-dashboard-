import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import api from '../services/api';

export interface AdminUser {
  email: string;
  role?: string;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  access_token?: string;
  token?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  admin: AdminUser | null;
  error: string | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  logout: () => void;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const extractErrorMessage = (error: any, fallback: string): string => {
  const data = error?.response?.data ?? error;

  if (typeof data === 'string') return data;
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail)) {
    return data.detail.map((item: any) => item.msg || JSON.stringify(item)).join(', ');
  }
  if (typeof data?.message === 'string') return data.message;

  if (error?.code === 'ECONNABORTED') {
    return 'The server took too long to respond. Please try again.';
  }
  if (error?.code === 'ERR_NETWORK') {
    return 'Cannot connect to the server. Check your backend and network.';
  }

  return fallback;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('admin');
    localStorage.removeItem('user');

    setAdmin(null);
    setIsAuthenticated(false);
    setError(null);

    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const storedAdmin = localStorage.getItem('admin');

    if (token && storedAdmin) {
      try {
        setAdmin(JSON.parse(storedAdmin));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('admin');
      }
    }

    setIsLoading(false);

    const handleSessionExpired = () => {
      logout();
    };

    window.addEventListener('user_session_expired', handleSessionExpired);
    return () => window.removeEventListener('user_session_expired', handleSessionExpired);
  }, [logout]);

  const login = useCallback(async (email: string, password: string): Promise<AuthResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/v1/auth/admin/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      const data = response.data;
      console.log('Admin login response received:', data); // Debug log to inspect response structure

      // Check multiple common variations for token keys returned by backends
      const token =
        data.access_token ||
        data.token ||
        data.accessToken ||
        data.data?.access_token ||
        data.data?.token;

      if (!token) {
        const message = 'Login failed: server returned success, but no access token was found in response.';
        console.error(message, data);
        setError(message);
        return { success: false, message };
      }

      // Save token to localStorage under both keys for maximum compatibility
      localStorage.setItem('token', token);
      localStorage.setItem('access_token', token);

      const adminData: AdminUser = {
        email: data.admin_email || data.email || email,
        role: data.role || 'super_admin',
      };

      localStorage.setItem('admin', JSON.stringify(adminData));

      setAdmin(adminData);
      setIsAuthenticated(true);

      return { success: true, access_token: token };
    } catch (err: any) {
      const message = extractErrorMessage(err, 'Login failed.');
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        admin,
        error,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
