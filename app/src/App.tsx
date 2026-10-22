import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

const Home = lazy(() => import('./features/home/Home'));
const Skill = lazy(() => import('./features/progress/Skill'));
const Planes = lazy(() => import('./features/plans/Planes'));
const Program = lazy(() => import('./features/plans/Program'));
const Routine = lazy(() => import('./features/plans/Routine'));
const Runner = lazy(() => import('./features/runner/Runner'));
const Metrics = lazy(() => import('./features/metrics/Metrics'));

function PageFallback() {
  return <div className="py-8 text-center text-muted-foreground">Cargando…</div>;
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}