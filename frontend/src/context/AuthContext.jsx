import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, tokens, persistedUser } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Rehydrate from localStorage on first load so refresh doesn't log you out
  const [user, setUser] = useState(() => persistedUser.get());
  const [loading, setLoading] = useState(false);

  // Keep localStorage in sync whenever user changes
  useEffect(() => {
    if (user) persistedUser.set(user);
    else persistedUser.clear();
  }, [user]);

  /**
   * Institution login.
   * On success: stores tokens, sets user state.
   * On failure: throws { message } so callers can display errors.
   */
  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const data = await authApi.loginInstitution(email, password);
      // data = { institution, accessToken }
      tokens.setAccess(data.accessToken);
      // Refresh token is set as an httpOnly cookie by the backend,
      // but we also keep a copy in localStorage for the refresh call.
      if (data.refreshToken) tokens.setRefresh(data.refreshToken);

      const u = {
        id:    data.institution._id,
        name:  data.institution.name,
        email: data.institution.email,
        type:  'institution',
        subscriptionTier: data.institution.subscriptionTier,
      };
      setUser(u);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Login failed.' };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Institution registration (2-step wizard).
   * Accepts all fields from the SignupPage form.
   */
  const register = useCallback(async ({
    institutionName,
    institutionType,
    country,
    website,
    adminName,
    email,
    password,
  }) => {
    setLoading(true);
    try {
      const data = await authApi.registerInstitution({
        name:     institutionName,
        email,
        password,
        address:  country,         // map country → address field backend expects
        website:  website || undefined,
      });

      tokens.setAccess(data.accessToken);
      if (data.refreshToken) tokens.setRefresh(data.refreshToken);

      const u = {
        id:    data.institution._id,
        name:  data.institution.name,
        email: data.institution.email,
        type:  'institution',
        apiKey: data.apiKey,
        subscriptionTier: data.institution.subscriptionTier,
        // Store extra signup info locally (not in DB)
        institutionType,
        adminName,
      };
      setUser(u);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Registration failed.' };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Logout — invalidates the token on the backend, then clears local state.
   */
  const logout = useCallback(async () => {
    try {
      await authApi.logout(tokens.getRefresh());
    } catch {
      // Silent failure — clear state regardless
    }
    tokens.clear();
    setUser(null);
  }, []);

  /**
   * Forgot password — sends reset email.
   */
  const forgotPassword = useCallback(async (email) => {
    await authApi.forgotPassword(email, 'institution');
  }, []);

  /**
   * Reset password with the token from the reset email.
   */
  const resetPassword = useCallback(async (token, newPassword) => {
    await authApi.resetPassword(token, newPassword, 'institution');
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      forgotPassword,
      resetPassword,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
