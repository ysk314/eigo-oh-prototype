import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@/context/AppContext';
import '@/styles/global.css';

const LoginPage = lazy(async () => import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const HomePage = lazy(async () => import('@/pages/HomePage').then((module) => ({ default: module.HomePage })));
const CoursePage = lazy(async () => import('@/pages/CoursePage').then((module) => ({ default: module.CoursePage })));
const PlayPage = lazy(async () => import('@/pages/PlayPage').then((module) => ({ default: module.PlayPage })));
const ChoicePage = lazy(async () => import('@/pages/ChoicePage').then((module) => ({ default: module.ChoicePage })));
const AdminPage = lazy(async () => import('@/pages/AdminPage').then((module) => ({ default: module.AdminPage })));
const AccountPage = lazy(async () => import('@/pages/AccountPage').then((module) => ({ default: module.AccountPage })));

function App() {
    return (
        <AppProvider>
            <BrowserRouter basename={import.meta.env.BASE_URL}>
                <Suspense fallback={<div style={{ padding: '24px', textAlign: 'center' }}>Loading...</div>}>
                    <Routes>
                        <Route path="/" element={<LoginPage />} />
                        <Route path="/dashboard" element={<HomePage />} />
                        <Route path="/course" element={<CoursePage />} />
                        <Route path="/play" element={<PlayPage />} />
                        <Route path="/choice" element={<ChoicePage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/account" element={<AccountPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </BrowserRouter>
        </AppProvider>
    );
}

export default App;
