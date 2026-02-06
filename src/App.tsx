import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@/context/AppContext';
import { HomePage, CoursePage, PlayPage, ChoicePage, LoginPage, AdminPage } from '@/pages';
import '@/styles/global.css';

function App() {
    return (
        <AppProvider>
            <BrowserRouter basename={import.meta.env.BASE_URL}>
                <Routes>
                    <Route path="/" element={<LoginPage />} />
                    <Route path="/dashboard" element={<HomePage />} />
                    <Route path="/course" element={<CoursePage />} />
                    <Route path="/play" element={<PlayPage />} />
                    <Route path="/choice" element={<ChoicePage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AppProvider>
    );
}

export default App;
