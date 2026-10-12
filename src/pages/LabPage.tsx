import { Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CATEGORIES, findLab } from '../labs/registry';
import { NotFound } from './NotFound';

export function LabPage() {
  const { id } = useParams();
  const lab = findLab(id);
  if (!lab || !lab.component) return <NotFound />;
  const Lab = lab.component;
  const category = CATEGORIES.find((c) => c.id === lab.category);
  return (
    <div className="space-y-6">
      <nav aria-label="Trilha de navegação" className="text-base">
        <Link to="/" className="text-accent underline">
          Início
        </Link>{' '}
        /{' '}
        <Link to={`/categoria/${lab.category}`} className="text-accent underline">
          {category?.title}
        </Link>{' '}
        / {lab.title}
      </nav>
      <h1 className="text-3xl font-bold">Laboratório: {lab.title}</h1>
      <Suspense fallback={<p role="status" className="text-lg">Carregando laboratório…</p>}>
        <Lab />
      </Suspense>
    </div>
  );
}
