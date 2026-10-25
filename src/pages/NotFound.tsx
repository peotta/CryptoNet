import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFound() {
  useDocumentTitle('Página não encontrada');
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold">Página não encontrada</h1>
      <p className="text-lg">O endereço solicitado não existe ou o laboratório ainda não foi publicado.</p>
      <Link to="/" className="text-lg text-accent underline">
        Voltar ao início
      </Link>
    </div>
  );
}
