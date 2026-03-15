import React from 'react';
import '../../styles/Auth.css';

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
