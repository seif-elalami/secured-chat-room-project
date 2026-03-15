import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

// Temporary Dashboard component (replace later)
const Dashboard = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard</h1>
      <p>Welcome! You're logged in.</p>
      <button onClick={() => {
        localStorage.clear();
        window.location.href = '/login';
      }}>
        Logout
      </button>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
