import { Link, useParams } from 'react-router-dom';
import { LabCard } from '../components/LabCard';
import { CATEGORIES, labsByCategory } from '../labs/registry';
import { NotFound } from './NotFound';

export function Category() {
  const { id } = useParams();
  const category = CATEGORIES.find((c) => c.id === id);
  if (!category) return <NotFound />;
  return (
    <div className="space-y-6">
      <nav aria-label="Trilha de navegação" className="text-base">
        <Link to="/" className="text-accent underline">
          Início
        </Link>{' '}
        / {category.title}
      </nav>
      <h1 className="text-3xl font-bold">{category.title}</h1>
      <p className="max-w-3xl text-lg">{category.description}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {labsByCategory(category.id).map((l) => (
          <LabCard key={l.id} lab={l} headingLevel={2} />
        ))}
      </div>
    </div>
  );
}
