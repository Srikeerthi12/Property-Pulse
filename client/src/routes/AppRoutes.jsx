import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import Login from '../pages/auth/Login.jsx';
import Register from '../pages/auth/Register.jsx';
import ForgotPassword from '../pages/auth/ForgotPassword.jsx';
import DashboardRedirect from '../pages/DashboardRedirect.jsx';
import Profile from '../pages/Profile.jsx';
import PropertyDetails from '../pages/PropertyDetails.jsx';
import NotFound from '../pages/NotFound.jsx';
import AdminDashboard from '../pages/admin/AdminDashboard.jsx';
import AdminLeads from '../pages/admin/AdminLeads.jsx';
import AdminProperties from '../pages/admin/AdminProperties.jsx';
import AdminUsers from '../pages/admin/AdminUsers.jsx';
import AdminAnalytics from '../pages/admin/AdminAnalytics.jsx';
import AgentDashboard from '../pages/agent/AgentDashboard.jsx';
import AgentLeads from '../pages/agent/AgentLeads.jsx';
import AgentActivity from '../pages/agent/AgentActivity.jsx';
import BuyerDashboard from '../pages/buyer/BuyerDashboard.jsx';
import BuyerInquiries from '../pages/buyer/BuyerInquiries.jsx';
import BuyerSaved from '../pages/buyer/BuyerSaved.jsx';
import BuyerVisits from '../pages/buyer/BuyerVisits.jsx';
import BuyerDeals from '../pages/buyer/BuyerDeals.jsx';
import SellerDashboard from '../pages/seller/SellerDashboard.jsx';
import SellerProperties from '../pages/seller/SellerProperties.jsx';
import SellerAnalytics from '../pages/seller/SellerAnalytics.jsx';
import SellerVisits from '../pages/seller/SellerVisits.jsx';
import SellerDeals from '../pages/seller/SellerDeals.jsx';
import ProtectedRoute from '../components/common/ProtectedRoute.jsx';
import RoleProtectedRoute from '../components/common/RoleProtectedRoute.jsx';
import DashboardLayout from '../components/shell/DashboardLayout.jsx';
import AgentVisits from '../pages/agent/AgentVisits.jsx';
import AdminVisits from '../pages/admin/AdminVisits.jsx';
import AgentDeals from '../pages/agent/AgentDeals.jsx';
import AdminDeals from '../pages/admin/AdminDeals.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardRedirect />} />
        <Route path="profile" element={<Profile />} />
        <Route path="properties/:id" element={<PropertyDetails />} />

        <Route
          path="buyer"
          element={
            <RoleProtectedRoute allowedRoles={['buyer']}>
              <Outlet />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<BuyerDashboard />} />
          <Route path="inquiries" element={<BuyerInquiries />} />
          <Route path="saved" element={<BuyerSaved />} />
          <Route path="visits" element={<BuyerVisits />} />
          <Route path="deals" element={<BuyerDeals />} />
        </Route>

        <Route
          path="agent"
          element={
            <RoleProtectedRoute allowedRoles={['agent']}>
              <Outlet />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<AgentDashboard />} />
          <Route path="leads" element={<AgentLeads />} />
          <Route path="activity" element={<AgentActivity />} />
          <Route path="visits" element={<AgentVisits />} />
          <Route path="deals" element={<AgentDeals />} />
        </Route>

        <Route
          path="seller"
          element={
            <RoleProtectedRoute allowedRoles={['seller']}>
              <Outlet />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<SellerDashboard />} />
          <Route path="properties" element={<SellerProperties />} />
          <Route path="analytics" element={<SellerAnalytics />} />
          <Route path="visits" element={<SellerVisits />} />
          <Route path="deals" element={<SellerDeals />} />
        </Route>

        <Route
          path="admin"
          element={
            <RoleProtectedRoute allowedRoles={['admin']}>
              <Outlet />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="properties" element={<AdminProperties />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="visits" element={<AdminVisits />} />
          <Route path="deals" element={<AdminDeals />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
