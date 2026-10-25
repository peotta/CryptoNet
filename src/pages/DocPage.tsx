import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocView, goTo } from '../docs/DocView';
import { headingsOf } from '../docs/slug';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { CATEGORIES, docUrl, findLab } from '../labs/registry';
import { NotFound } from './NotFound';

// Os documentos são gerados por npm run docs:labs e embutidos no build como texto (sem fetch).
const files = import.meta.glob('/docs/laboratorios/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

export function DocPage() {
  const { id } = useParams();
  const lab = findLab(id);
  const loader = lab ? files[`/docs/laboratorios/${lab.id}.md`] : undefined;
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useDocumentTitle(lab && loader ? `Documentação: ${lab.title}` : 'Página não encontrada');

  useEffect(() => {
    setMarkdown(null);
    setFailed(false);
    if (!loader) return;
    let cancelled = false;
    loader().then(
      (text) => !cancelled && setMarkdown(text),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [loader]);

  const toc = useMemo(() => (markdown ? headingsOf(markdown).filter((h) => h.level === 2 || h.level === 4) : []), [markdown]);
  if (!lab || !loader) return <NotFound />;
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
        /{' '}
        <Link to={`/lab/${lab.id}`} className="text-accent underline">
          {lab.title}
        </Link>{' '}
        / Documentação
      </nav>
      <div className="flex flex-wrap gap-3">
        <Link to={`/lab/${lab.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 text-base font-semibold text-accent-ink hover:opacity-90">
          Abrir o laboratório
        </Link>
        <a href={docUrl(lab)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-base font-semibold hover:bg-surface2">
          Ver no GitHub<span className="sr-only"> (abre em nova aba)</span>
          <span aria-hidden="true">&nbsp;↗</span>
        </a>
      </div>
      {failed && (
        <p role="alert" className="text-lg font-semibold text-danger">
          Não foi possível carregar a documentação.
        </p>
      )}
      {!markdown && !failed && (
        <p role="status" className="text-lg">
          Carregando a documentação…
        </p>
      )}
      {markdown && (
        <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label="Nesta página" className="text-base lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
            <p className="mb-2 font-bold">Nesta página</p>
            <ul className="space-y-1">
              {toc.map((h) => (
                <li key={h.id} className={h.level === 4 ? 'pl-4 text-muted' : ''}>
                  <a
                    href={`#/lab/${lab.id}/documentacao`}
                    className="hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      goTo(h.id);
                    }}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <DocView markdown={markdown} />
        </div>
      )}
    </div>
  );
}
