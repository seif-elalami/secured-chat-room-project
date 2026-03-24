import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from './AuthLayout';
import '../../styles/Auth.css';
// Add this import:
import api from '../../services/api';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!formData.username || !formData.password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      // --- CSRF step: Fetch the CSRF token before login ---
      await api.get('/csrf-token');
      // ---------------------------------------------------

      const result = await login(formData.username, formData.password);

      if (result.success) {
        navigate('/dashboard'); // Change to your main app route
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('An error occurred during login. Please try again.');
    }
    setLoading(false);
  };

  return (
    <AuthLayout
      mode="login"
      title="Welcome Back!"
      subtitle="Return to your rooms, messages, assignments, and shared activity."
    >
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="Enter your username"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="btn-primary auth-submit-button"
          disabled={loading}
        >
          <span className="btn-primary-text">
            {loading ? 'Signing in...' : 'Enter Secure Space'}
          </span>
          <span className="btn-primary-glow" />
        </button>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
              Sign up
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
};

export default Login;
