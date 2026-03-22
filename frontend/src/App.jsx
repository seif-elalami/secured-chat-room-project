import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/App/Layout';
import DashboardPage from './components/App/DashboardPage';
import RoomPage from './components/App/RoomPage';
import NotesPage from './components/App/NotesPage';
import AssignmentsPage from './components/App/AssignmentsPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Routes inside Layout */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/rooms" element={<RoomPage />} />
            <Route path="/rooms/:roomId" element={<RoomPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/assignments" element={<AssignmentsPage />} />
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
