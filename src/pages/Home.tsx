import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { LabCard } from '../components/LabCard';
import { CATEGORIES, LABS, labsByCategory } from '../labs/registry';

export function Home() {
  useDocumentTitle();
  const planned = LABS.filter((l) => l.status === 'planned');
  return (
    <div className="space-y-12">
      <section aria-labelledby="titulo" className="max-w-5xl space-y-3">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:gap-8">
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt="Logotipo do CryptoNet Lab: um cadeado protege o enlace entre dois nós, Alice e Bob, enquanto Eva observa de fora"
            width={160}
            height={160}
            className="h-28 w-28 shrink-0 md:h-40 md:w-40"
          />
          <div className="max-w-4xl space-y-3">
            <h1 id="titulo" className="text-4xl font-bold">
              CryptoNet Lab
            </h1>
            <p className="text-2xl text-muted">Laboratório Virtual de Criptografia e Protocolos Seguros</p>
            <p className="text-lg">
              Projeto acadêmico do curso de Engenharia de Redes de Comunicação da Universidade de Brasília (UnB), sob responsabilidade do Prof. Dr. Laerte Peotta de Melo. Cada
              operação criptográfica pode ser acompanhada passo a passo, com animações, fórmulas com os valores substituídos e a visão de quem observa a rede.
            </p>
          </div>
        </div>
        <aside aria-labelledby="normas-vigentes" className="mt-4 rounded-xl border-l-4 border-accent bg-surface p-5">
          <h2 id="normas-vigentes" className="text-xl font-bold">
            Baseados em normas vigentes e com documentação própria
          </h2>
          <p className="mt-1 text-lg">
            Todos os laboratórios são desenvolvidos a partir das RFCs e dos padrões do NIST mais recentes, conferidos no texto oficial do{' '}
            <a href="https://www.rfc-editor.org" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline">
              RFC Editor
            </a>{' '}
            e do{' '}
            <a href="https://csrc.nist.gov" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline">
              NIST
            </a>
            , com atenção às versões substituídas ou atualizadas. Os resultados são conferidos com os vetores de teste oficiais.
          </p>
          <p className="mt-3 text-lg">
            Cada laboratório tem ainda uma documentação própria, parte essencial do estudo. Ela apresenta a <strong>fundamentação</strong> do algoritmo, com os{' '}
            <strong>diagramas de sequência</strong> que mostram a ordem exata das mensagens trocadas entre Alice, Bob e Eva, os <strong>artigos clássicos dos criadores</strong> dos algoritmos e protocolos e os <strong>trabalhos acadêmicos</strong> de referência, com link direto para leitura, e os{' '}
            <strong>cenários</strong> executados na simulação (o funcionamento normal, as falhas e as defesas). Com esse material, o estudante relaciona o que vê na animação com o que a
            especificação determina e chega a um entendimento aprofundado dos algoritmos e protocolos. Use o link &quot;Documentação&quot; no cartão de cada laboratório.
          </p>
        </aside>
      </section>

      <section aria-labelledby="categorias" className="space-y-4">
        <h2 id="categorias" className="text-2xl font-bold">
          Categorias
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {CATEGORIES.map((c) => {
            const labs = labsByCategory(c.id);
            const soon = labs.filter((l) => l.status === 'planned').length;
            return (
              <Link
                key={c.id}
                to={`/categoria/${c.id}`}
                className={`block rounded-xl border p-5 ${c.id === 'dap' ? 'border-2 border-warn bg-warn/15 hover:bg-warn/25' : 'border-line bg-surface hover:bg-surface2'}`}
              >
                <h3 className="flex items-start gap-2 text-xl font-bold">
                  {c.id === 'dap' && (
                    <>
                      <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" className="mt-0.5 shrink-0 text-warn" fill="currentColor">
                        <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
                      </svg>
                      <span className="sr-only">Em destaque: </span>
                    </>
                  )}
                  {c.title}
                </h3>
                <p className="mt-1 text-base">{c.description}</p>
                <p className="mt-2 text-base font-semibold text-accent">
                  {labs.filter((l) => l.status === 'available').length} disponível(is){soon > 0 ? ` · ${soon} em breve` : ''}
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
        {CATEGORIES.map((c) => {
          const labs = labsByCategory(c.id).filter((l) => l.status === 'available');
          if (labs.length === 0) return null;
          return (
            <div key={c.id} className="space-y-3">
              <h3 className="border-b border-line pb-1 text-xl font-bold">
                <Link to={`/categoria/${c.id}`} className="text-accent underline">
                  {c.title}
                </Link>{' '}
                <span className="text-base font-semibold text-muted">({labs.length})</span>
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {labs.map((l) => (
                  <LabCard key={l.id} lab={l} headingLevel={4} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {planned.length > 0 && (
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
      )}
    </div>
  );
}
