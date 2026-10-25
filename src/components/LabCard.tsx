import { Link } from 'react-router-dom';
import { docUrl, type LabMeta } from '../labs/registry';

export function LabCard({ lab, headingLevel = 3 }: { lab: LabMeta; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3';
  const available = lab.status === 'available';
  return (
    <article className={`flex flex-col rounded-xl border bg-surface p-5 ${available ? 'border-line' : 'border-dashed border-line'}`}>
      <Heading className="text-xl font-bold">{lab.title}</Heading>
      <p className={`mt-1 inline-block self-start rounded-md px-2 py-0.5 text-base font-semibold ${available ? 'bg-k-secret/15 text-k-secret' : 'bg-surface2 text-muted'}`}>
        {available ? 'Disponível' : 'Em breve'}
      </p>
      <p className="mt-2 flex-1 text-base">{lab.summary}</p>
      {available && lab.objectives.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-base text-muted">
          {lab.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      )}
      {available && (
        <>
          <Link to={`/lab/${lab.id}`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 text-base font-semibold text-accent-ink hover:opacity-90">
            Abrir laboratório<span className="sr-only">: {lab.title}</span>
          </Link>
          <a href={docUrl(lab)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center justify-center gap-1 self-center text-base font-semibold text-accent underline">
            Documentação<span className="sr-only">: {lab.title} (abre em nova aba)</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M8 7h9v9" />
            </svg>
          </a>
        </>
      )}
    </article>
  );
}
