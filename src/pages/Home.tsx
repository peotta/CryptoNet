import { Link } from 'react-router-dom';
import { LabCard } from '../components/LabCard';
import { CATEGORIES, LABS, labsByCategory } from '../labs/registry';

export function Home() {
  const available = LABS.filter((l) => l.status === 'available');
  const planned = LABS.filter((l) => l.status === 'planned');
  return (
    <div className="space-y-12">
      <section aria-labelledby="titulo" className="max-w-4xl space-y-3">
        <h1 id="titulo" className="text-4xl font-bold">
          CryptoNet Lab
        </h1>
        <p className="text-2xl text-muted">Laboratório Virtual de Criptografia e Protocolos Seguros</p>
        <p className="text-lg">
          Projeto acadêmico do curso de Engenharia de Redes de Comunicação da Universidade de Brasília (UnB), sob responsabilidade do Prof. Dr. Laerte Peotta de Melo. Cada
          operação criptográfica pode ser acompanhada passo a passo, com animações, fórmulas com os valores substituídos e a visão de quem observa a rede.
        </p>
      </section>

      <section aria-labelledby="categorias" className="space-y-4">
        <h2 id="categorias" className="text-2xl font-bold">
          Categorias
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {CATEGORIES.map((c) => {
            const labs = labsByCategory(c.id);
            return (
              <Link key={c.id} to={`/categoria/${c.id}`} className="block rounded-xl border border-line bg-surface p-5 hover:bg-surface2">
                <h3 className="text-xl font-bold">{c.title}</h3>
                <p className="mt-1 text-base">{c.description}</p>
                <p className="mt-2 text-base font-semibold text-accent">
                  {labs.filter((l) => l.status === 'available').length} disponível(is) · {labs.filter((l) => l.status === 'planned').length} em breve
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="disponiveis" className="space-y-4">
        <h2 id="disponiveis" className="text-2xl font-bold">
          Laboratórios disponíveis
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {available.map((l) => (
            <LabCard key={l.id} lab={l} />
          ))}
        </div>
      </section>

      <section aria-labelledby="futuros" className="space-y-4">
        <h2 id="futuros" className="text-2xl font-bold">
          Laboratórios futuros
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {planned.map((l) => (
            <LabCard key={l.id} lab={l} />
          ))}
        </div>
      </section>
    </div>
  );
}
