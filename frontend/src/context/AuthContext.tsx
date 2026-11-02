import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  roles: string[];
  is_active: boolean;
  cari_id?: number;
  cari_title?: string;
  cari_code?: string;
  role?: string;
  permissions?: Record<string, boolean>;
  effective_permissions?: Record<string, boolean>;
}

interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permissionKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'gunay_kimya_auth_token';

// Helper function to decode JWT payload safely
function decodeJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Configure Axios default authorization header on token change
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      sessionStorage.setItem(TOKEN_KEY, token);

      // Attempt to load current user profile from /auth/me or JWT
      const fetchProfile = async () => {
        try {
          const res = await axios.get('/api/v1/auth/me');
          setUser(res.data);
        } catch (err) {
          // Fallback to JWT payload claims
          const payload = decodeJwtPayload(token);
          if (payload) {
            setUser({
              id: payload.user_id || 0,
              email: payload.sub || '',
              full_name: payload.sub ? payload.sub.split('@')[0] : 'Kullanıcı',
              roles: payload.roles || [],
              is_active: true,
            });
          } else {
            // Invalid token
            logout();
          }
        } finally {
          setIsLoading(false);
        }
      };

      fetchProfile();
    } else {
      delete axios.defaults.headers.common['Authorization'];
      sessionStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await axios.post('/api/v1/auth/login', {
        email: email.trim(),
        password: password,
      });

      const { access_token } = response.data;
      if (!access_token) {
        throw new Error('Erişim belirteci (token) alınamadı.');
      }

      setToken(access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // Fetch freshly authenticated user profile
      try {
        const meRes = await axios.get('/api/v1/auth/me');
        setUser(meRes.data);
      } catch {
        const payload = decodeJwtPayload(access_token);
        setUser({
          id: payload?.user_id || 0,
          email: payload?.sub || email,
          full_name: email.split('@')[0],
          roles: payload?.roles || [],
          is_active: true,
          cari_id: payload?.cari_id,
          role: payload?.user_role,
          effective_permissions: payload?.permissions,
          permissions: payload?.permissions
        });
      }
    } catch (error: any) {
      logout();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
  };

  const hasPermission = (permissionKey: string): boolean => {
    if (!user) return false;
    const roleLower = (user.role || '').toLowerCase();
    const rolesStr = (user.roles || []).join(' ').toLowerCase();
    if (
      roleLower === 'admin' ||
      rolesStr.includes('admin') ||
      rolesStr.includes('yönetici') ||
      rolesStr.includes('yonetici')
    ) {
      return true;
    }
    if (user.effective_permissions && typeof user.effective_permissions[permissionKey] === 'boolean') {
      return user.effective_permissions[permissionKey];
    }
    if (user.permissions && typeof user.permissions[permissionKey] === 'boolean') {
      return user.permissions[permissionKey];
    }
    // Default fallback based on role if no explicit permission set
    if (roleLower === 'customer' || rolesStr.includes('customer') || rolesStr.includes('bayi')) {
      return ['b2b_orders', 'b2b_tracking', 'b2b_statement'].includes(permissionKey);
    }
    // Staff standard
    return ['orders', 'planning', 'purchasing', 'manufacturing', 'inventory', 'crm', 'quality'].includes(
      permissionKey
    );
  };

  const value: AuthContextType = {
    token,
    user,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    hasPermission
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth hook must be used within an AuthProvider');
  }
  return context;
};
