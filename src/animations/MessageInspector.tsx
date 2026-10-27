import type { Message, PartyDef } from '../simulation/types';
import { Formula } from './Formula';

interface Props {
  log: Message[];
  parties: PartyDef[];
}

/** Inspetor de mensagens: tudo o que já trafegou pelo canal, e quem consegue ler. */
export function MessageInspector({ log, parties }: Props) {
  const name = (id: string) => parties.find((p) => p.id === id)?.name ?? id;
  const adversary = parties.find((p) => p.adversary);
  if (log.length === 0) return <p className="text-base text-muted">Nenhuma mensagem foi enviada ainda.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Mensagens trocadas pelo canal público</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="py-1.5 pr-2">#</th>
            <th scope="col" className="py-1.5 pr-2">Origem → destino</th>
            <th scope="col" className="py-1.5 pr-2">Mensagem</th>
            <th scope="col" className="py-1.5 pr-2">Conteúdo no canal</th>
            {adversary && <th scope="col" className="py-1.5">{adversary.name} lê?</th>}
          </tr>
        </thead>
        <tbody>
          {log.map((m, i) => (
            <tr key={m.id} className="border-b border-line align-top">
              <td className="py-1.5 pr-2">{i + 1}</td>
              <td className="py-1.5 pr-2">
                {name(m.from)} → {name(m.to)}
              </td>
              <td className="py-1.5 pr-2">
                <Formula tex={m.label} />
                {m.tampered && <span className="ml-2 font-semibold text-danger">(adulterada)</span>}
              </td>
              <td className="break-all py-1.5 pr-2 font-mono">{m.summary}</td>
              {adversary && <td className="py-1.5">{m.from === adversary.id ? 'Autora da mensagem' : m.to === adversary.id ? 'Sim (interceptada)' : 'Sim (canal público)'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
