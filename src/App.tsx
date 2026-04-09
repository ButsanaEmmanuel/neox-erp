import { ThemeProvider } from './components/ThemeProvider'
import NeoxDashboard from './components/NeoxDashboard'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import ForcePasswordChangePage from './pages/ForcePasswordChangePage'

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    if (user.forcePasswordChange) return <Navigate to="/change-password" replace />;
    return <>{children}</>;
}

const ForcePasswordChangeRoute = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    if (!user.forcePasswordChange) return <Navigate to="/" replace />;
    return <>{children}</>;
}

function App() {
    return (
        <AuthProvider>
            <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
                <ErrorBoundary>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/login" element={<LoginPage />} />
                            <Route
                                path="/change-password"
                                element={
                                    <ForcePasswordChangeRoute>
                                        <ForcePasswordChangePage />
                                    </ForcePasswordChangeRoute>
                                }
                            />
                            <Route 
                                path="/*" 
                                element={
                                    <ProtectedRoute>
                                        <NeoxDashboard />
                                    </ProtectedRoute>
                                } 
                            />
                        </Routes>
                    </BrowserRouter>
                </ErrorBoundary>
            </ThemeProvider>
        </AuthProvider>
    )
}

export default App
