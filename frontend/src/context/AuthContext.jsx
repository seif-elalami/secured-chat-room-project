import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

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
    // Check for existing token on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const data = await authAPI.login({ username, password });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      const data = await authAPI.register(userData);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    isAuthenticated: !!token,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
