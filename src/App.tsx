import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Game } from './pages/Game';
import { Home } from './pages/Home';
import { Start } from './pages/Start';
import { useApp } from './state/AppContext';

// 수업 중 대부분의 학생은 게임 화면만 쓴다. 순위·관리 화면은 필요할 때 내려받는다.
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));

function Loading() {
  return <p className="p-8 text-center text-slate-400">불러오는 중…</p>;
}

export function App() {
  const { student } = useApp();

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={student ? <Navigate to="/home" replace /> : <Start />} />
        <Route path="/home" element={student ? <Home /> : <Navigate to="/" replace />} />
        <Route path="/game/:level" element={student ? <Game /> : <Navigate to="/" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
