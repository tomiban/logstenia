import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

const Home = lazy(() => import('./pages/Home'));
const Skill = lazy(() => import('./pages/Skill'));
const Planes = lazy(() => import('./pages/Planes'));
const Program = lazy(() => import('./pages/Program'));
const Routine = lazy(() => import('./pages/Routine'));
const Runner = lazy(() => import('./pages/Runner'));
const Metrics = lazy(() => import('./pages/Metrics'));
const Progress = lazy(() => import('./pages/Progress'));
const Settings = lazy(() => import('./pages/Settings'));

function PageFallback() {
  return <div className="py-8 text-center text-[var(--muted)]">Cargando…</div>;
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/skill/:id" element={<Skill />} />
          <Route path="/planes" element={<Planes />} />
          <Route path="/program/:id" element={<Program />} />
          <Route path="/routine/:id" element={<Routine />} />
          <Route path="/run/:id" element={<Runner />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}