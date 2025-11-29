// src/components/ProtectedRoute/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function RoleProtectedRoute({ children, allowedRoles = [] }) {
    const { user, isLoading } = useAuth();

    // Show loading while checking authentication
    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                fontSize: '18px',
                color: '#666',
                fontFamily: 'Arial, sans-serif'
            }}>
                <div>
                    <div style={{ marginBottom: '10px', textAlign: 'center' }}>🔐</div>
                    <div>Loading...</div>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Check if user has the required role (case-insensitive)
    const userRole = user.RoleName || user.role || user.Role;

    if (allowedRoles.length > 0) {
        // Normalize roles to lowercase for comparison
        const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());
        const normalizedUserRole = userRole ? userRole.toLowerCase() : '';

        if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
            // User doesn't have permission - redirect to their appropriate dashboard
            if (normalizedUserRole === 'admin') {
                return <Navigate to="/admin/dashboard" replace />;
            } else if (normalizedUserRole === 'lecturer') {
                return <Navigate to="/lecturer/take-attendance" replace />;
            } else if (normalizedUserRole === 'student') {
                return <Navigate to="/student/dashboard" replace />;
            }
            // If role unknown, redirect to login
            return <Navigate to="/login" replace />;
        }
    }

    return children;
}

export default RoleProtectedRoute;