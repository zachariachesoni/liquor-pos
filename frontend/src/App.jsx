import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Customers from './pages/Customers';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Register from './pages/Register';
import Employees from './pages/Employees';
import Layout from './components/Layout';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) return <Navigate to="/login" />;

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // If not authorized for this specific route, send back to dashboard
    return <Navigate to="/dashboard" />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
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

      <Route
        path="/pos"
        element={
          <ProtectedRoute>
            <POS />
          </ProtectedRoute>
        }
      />

      <Route
        path="/products"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <Products />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <Inventory />
          </ProtectedRoute>
        }
      />

      <Route
        path="/sales"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <Sales />
          </ProtectedRoute>
        }
      />

      <Route
        path="/customers"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']}>
            <Customers />
          </ProtectedRoute>
        }
      />

      <Route
        path="/employees"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <Employees />
          </ProtectedRoute>
        }
      />

      <Route
        path="/expenses"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <Expenses />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <Reports />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default App;
