import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, userAPI } from '../services/api';
import { clearCSRFToken } from '../services/security';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token in sessionStorage (not localStorage)
    const storedToken = sessionStorage.getItem('token');
    const storedUser = sessionStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);

    // Listen for 401 auto-logout events from api.js
    const handleSecurityLogout = () => {
      logout();
    };
    window.addEventListener('security:logout', handleSecurityLogout);

    return () => {
      window.removeEventListener('security:logout', handleSecurityLogout);
    };
  }, []);

  const updateSessionUser = (nextUser, nextToken = token) => {
    if (nextToken) {
      sessionStorage.setItem('token', nextToken);
      setToken(nextToken);
    }

    sessionStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const login = async (username, password) => {
    try {
      const data = await authAPI.login({ username, password });

      updateSessionUser(data.user, data.token);

      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.message ||
        (error.code === 'ERR_NETWORK'
          ? 'Cannot reach the API server on port 3000'
          : 'Login failed');
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      const data = await authAPI.register(userData);

      updateSessionUser(data.user, data.token);

      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.message ||
        (error.code === 'ERR_NETWORK'
          ? 'Cannot reach the API server on port 3000'
          : 'Registration failed');
      return { success: false, error: message };
    }
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    clearCSRFToken(); // Clear in-memory CSRF token securely
    setToken(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const profile = await userAPI.getMe();
      updateSessionUser(profile);
      return { success: true, data: profile };
    } catch (error) {
      const message =
        error.response?.data?.message ||
        (error.code === 'ERR_NETWORK'
          ? 'Cannot reach the API server on port 3000'
          : 'Could not refresh profile');
      return { success: false, error: message };
    }
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    refreshProfile,
    updateSessionUser,
    isAuthenticated: !!token,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
