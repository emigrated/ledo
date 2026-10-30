import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ShareReturn from './pages/ShareReturn';
import MaintenanceRegistrationShare from './pages/MaintenanceRegistrationShare';
import MaintenanceRecordShare from './pages/MaintenanceRecordShare';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/share/return/:token" element={<ShareReturn />} />
        <Route path="/maintenance-register" element={<MaintenanceRegistrationShare />} />
        <Route path="/maintenance-records" element={<MaintenanceRecordShare />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </HashRouter>
  );
}

export default App;

