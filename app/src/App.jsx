import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Layout from './components/Layout'

const Home = lazy(() => import('./pages/Home'))
const Assessment = lazy(() => import('./pages/Assessment'))
const Assistant = lazy(() => import('./pages/Assistant'))
const Ranking = lazy(() => import('./pages/Ranking'))
const Roadmap = lazy(() => import('./pages/Roadmap'))
const Exams = lazy(() => import('./pages/Exams'))
const TeacherAssistant = lazy(() => import('./pages/TeacherAssistant'))
const StudentAssistant = lazy(() => import('./pages/StudentAssistant'))
const Profile = lazy(() => import('./pages/Profile'))

function LoadingSpinner() {
    return (
        <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
    )
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/home" replace />} />
                <Route
                    path="home"
                    element={
                        <Suspense fallback={<LoadingSpinner />}>
                            <Home />
                        </Suspense>
                    }
                />
                <Route
                    path="assessment"
                    element={
                        <Suspense fallback={<LoadingSpinner />}>
                            <Assessment />
                        </Suspense>
                    }
                />
                <Route
                    path="assistant"
                    element={
                        <Suspense fallback={<LoadingSpinner />}>
                            <Assistant />
                        </Suspense>
                    }
                />
                <Route
                    path="ranking"
                    element={
                        <Suspense fallback={<LoadingSpinner />}>
                            <Ranking />
                        </Suspense>
                    }
                />
                <Route
                    path="roadmap"
                    element={
                        <Suspense fallback={<LoadingSpinner />}>
                            <Roadmap />
                        </Suspense>
                    }
                />
                <Route
                    path="exams"
                    element={
                        <Suspense fallback={<LoadingSpinner />}>
                            <Exams />
                        </Suspense>
                    }
                />
                <Route
                    path="teacher-assistant"
                    element={
                        <Suspense fallback={<LoadingSpinner />}>
                            <TeacherAssistant />
                        </Suspense>
                    }
                />
                <Route
                    path="student-chat"
                    element={
                        <Suspense fallback={<LoadingSpinner />}>
                            <StudentAssistant />
                        </Suspense>
                    }
                />
                <Route
                    path="profile"
                    element={
                        <Suspense fallback={<LoadingSpinner />}>
                            <Profile />
                        </Suspense>
                    }
                />
                <Route path="*" element={<Navigate to="/home" replace />} />
            </Route>
        </Routes>
    )
}
