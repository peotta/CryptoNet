import { MotionConfig } from 'motion/react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { Category } from './pages/Category';
import { DocPage } from './pages/DocPage';
import { Home } from './pages/Home';
import { LabPage } from './pages/LabPage';
import { NotFound } from './pages/NotFound';

/** HashRouter: funciona em hospedagem estática (GitHub Pages) mesmo ao recarregar qualquer página. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="categoria/:id" element={<Category />} />
        <Route path="lab/:id" element={<LabPage />} />
        <Route path="lab/:id/documentacao" element={<DocPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    // reducedMotion="user": respeita a preferência do sistema por movimento reduzido.
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </MotionConfig>
  );
}
