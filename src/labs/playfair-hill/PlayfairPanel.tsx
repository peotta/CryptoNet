import { useEffect, useMemo, useState } from 'react';
import { FrequencyChart } from '../../animations/FrequencyChart';
import { PlayfairGrid } from '../../animations/PlayfairGrid';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { ALPHABET, letterPercentages, PT_FREQUENCY } from '../../crypto/classical';
import { engines } from '../../crypto/local/classical';
import { positionOf } from '../../crypto/playfair';
import { randomBigIntBelow } from '../../crypto/random';
import { IC_PORTUGUESE, IC_RANDOM } from '../../crypto/substitution';
import { Callout, Field, LabSection, buttonClass } from '../../components/ui';
import { buildPlayfairProtocol, MAX_LETTERS, runPlayfair, type PlayfairRun } from './playfairFlows';

const EXAMPLE_KEY = 'MONARQUIA';
const EXAMPLE_TEXT =
  'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol, atravessar o vale em silêncio e esperar o sinal do comandante junto à ponte velha. Quem for visto pelos moradores deverá voltar imediatamente ao acampamento e aguardar novas ordens.';
const num = (v: number, d = 4) => v.toFixed(d).replace('.', ',');

const RULES = {
  linha: 'Mesma linha: cada letra é trocada pela letra à sua direita (a última volta à primeira).',
  coluna: 'Mesma coluna: cada letra é trocada pela letra abaixo dela (a última volta à primeira).',
  retângulo: 'Linhas e colunas diferentes: cada letra é trocada pela letra da sua própria linha, na coluna da outra letra do par.',
} as const;

function randomWord(length: number): string {
  return Array.from({ length }, () => ALPHABET[Number(randomBigIntBelow(26n))]).join('');
}

function DigraphStepper({ run, index, onIndex }: { run: PlayfairRun; index: number | null; onIndex: (i: number | null) => void }) {
  const n = run.steps.length;
  const step = index === null ? null : run.steps[index];
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-xl font-bold">Cifrar digrafo a digrafo</h3>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonClass} disabled={index === null || index === 0} onClick={() => onIndex(index === null || index <= 0 ? null : index - 1)}>
          ← Digrafo anterior
        </button>
        <button type="button" className={buttonClass} disabled={index !== null && index >= n - 1} onClick={() => onIndex(index === null ? 0 : Math.min(n - 1, index + 1))}>
          {index === null ? 'Começar pelo primeiro digrafo' : 'Próximo digrafo →'}
        </button>
      </div>
      <p aria-live="polite" className="text-lg">
        {step ? (
          <>
            Digrafo {index! + 1} de {n}: <span className="font-mono font-bold">{step.input}</span> → regra: <strong>{step.rule}</strong> → <span className="font-mono font-bold">{step.output}</span>.{' '}
            <span className="text-base text-muted">{RULES[step.rule]}</span>
          </>
        ) : (
          'Use os botões para ver a regra aplicada a cada digrafo, com as letras destacadas na grade.'
        )}
      </p>
      <p className="break-all font-mono text-base text-muted">Cifra até aqui: {index === null ? '(vazia)' : run.cipherLetters.slice(0, (index + 1) * 2)}</p>
    </div>
  );
}

export function PlayfairPanel() {
  const [keyword, setKeyword] = useState(EXAMPLE_KEY);
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [tamper, setTamper] = useState(false);
  const [digraph, setDigraph] = useState<number | null>(null);
  const [run, setRun] = useState<PlayfairRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    runPlayfair(engines.classical, { keyword, text, tamper })
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
          setDigraph(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setRun(null);
          setError(e instanceof Error ? e.message : 'Falha ao cifrar.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [keyword, text, tamper]);

  const definition = useMemo(() => (run ? buildPlayfairProtocol(run.flow) : null), [run]);
  const current = run && digraph !== null ? run.steps[digraph] : null;
  const toPos = current && run ? ([positionOf(run.grid, current.output[0]), positionOf(run.grid, current.output[1])] as [typeof current.from[0], typeof current.from[1]]) : null;
  const percents = useMemo(() => (run ? letterPercentages(run.cipherLetters) : null), [run]);

  return (
    <>
      <Callout variant="danger" title="Cifra clássica: não oferece segurança">
        <p>O Playfair foi usado em campo por décadas, mas é quebrado por análise de digrafos e por computador. Aqui ele serve para estudar cifras de pares de letras.</p>
      </Callout>

      <LabSection id="pf-params" title="3. Parâmetros configuráveis">
        <Field
          id="pf-key"
          label="Palavra-chave (1 a 25 letras)"
          value={keyword}
          onChange={(v) => setKeyword(v.toUpperCase())}
          error={error && /palavra-chave/.test(error) ? error : null}
          hint="Letras de A a Z. A grade usa as letras da chave, sem repetir, e depois as demais; J e I compartilham a mesma casa."
          inputMode="text"
          maxLength={25}
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => setKeyword(randomWord(8))}>
            Sortear palavra-chave de 8 letras (aleatório seguro)
          </button>
          <button type="button" className={buttonClass} onClick={() => setKeyword(EXAMPLE_KEY)}>
            Usar a chave do exemplo
          </button>
        </div>
        <div>
          <label htmlFor="pf-text" className="mb-1 block text-base font-semibold">
            Mensagem de Alice
          </label>
          <textarea id="pf-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-describedby="pf-text-hint" className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
          <p id="pf-text-hint" className="mt-1 text-base text-muted">
            O texto é normalizado (maiúsculas, sem acentos, espaços ou pontuação; até {MAX_LETTERS} letras; J vira I). O X é inserido entre letras iguais do mesmo digrafo e no fim, se
            sobrar uma letra.
          </p>
        </div>
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
          Eva altera uma letra da cifra em trânsito
        </label>
        {error && !/palavra-chave/.test(error) && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {error}
          </p>
        )}
      </LabSection>

      <LabSection id="pf-viz" title="4. Visualização animada">
        {run ? (
          <div className="space-y-6">
            <div className="grid items-start gap-6 md:grid-cols-[auto_1fr]">
              <div className="space-y-2">
                <PlayfairGrid grid={run.grid} from={current ? current.from : null} to={toPos} />
                <p className="text-base text-muted">Roxo: letras de entrada. Laranja: letras de saída.</p>
              </div>
              <DigraphStepper run={run} index={digraph} onIndex={setDigraph} />
            </div>
            {definition && <ProtocolPlayer definition={definition} resetKey={`${run.grid}|${run.cipherLetters}|${run.flow.tampered}`} />}
          </div>
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>

      {run && percents && (
        <>
          <LabSection id="pf-eva" title="5. Criptoanálise de Eva">
            <div className="space-y-6">
              <section aria-labelledby="pf-eva-1" className="space-y-2">
                <h3 id="pf-eva-1" className="text-xl font-bold">
                  5.1 O índice de coincidência e o histograma
                </h3>
                <p className="text-lg">
                  Na substituição simples, o IC da cifra era igual ao do texto claro. No Playfair, cada letra clara depende da vizinha, e o IC cai e o histograma se achata, aproximando-se do aleatório.
                </p>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Texto claro', num(run.flow.icPlain)],
                    ['Texto cifrado', num(run.flow.icCipher)],
                    ['Português (referência)', num(IC_PORTUGUESE)],
                    ['Aleatório (referência)', num(IC_RANDOM)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-line bg-surface p-3">
                      <dt className="text-base text-muted">{k}</dt>
                      <dd className="font-mono text-xl font-bold">{v}</dd>
                    </div>
                  ))}
                </dl>
                <FrequencyChart observed={percents} expected={PT_FREQUENCY} observedLabel="texto cifrado capturado por Eva" expectedLabel="língua portuguesa" />
                <p className="text-lg">O histograma da cifra é mais plano e não acompanha o do português: a análise de frequência de letras, que quebra a substituição simples, não basta aqui.</p>
              </section>

              <section aria-labelledby="pf-eva-2" className="space-y-3">
                <h3 id="pf-eva-2" className="text-xl font-bold">
                  5.2 Estatísticas de digrafos
                </h3>
                <p className="text-lg">
                  O Playfair cifra cada digrafo sempre da mesma forma, então digrafos repetidos no texto claro aparecem repetidos na cifra. Há cerca de 600 digrafos possíveis (25 × 24), muito mais
                  que as 26 letras: seriam necessárias centenas de letras para as frequências se firmarem. Na cifra há {run.flow.distinctCipherDigraphs} digrafos distintos em {run.flow.nDigraphs}.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Digrafos mais frequentes na cifra (o que Eva vê)', run.flow.topCipher],
                    ['Digrafos mais frequentes no texto claro (o que Eva quer descobrir)', run.flow.topPlain],
                  ].map(([title, rows]) => (
                    <div key={title as string} className="overflow-x-auto">
                      <table className="w-full text-left text-base">
                        <caption className="mb-2 text-left text-lg font-semibold">{title as string}</caption>
                        <thead>
                          <tr className="border-b border-line">
                            <th scope="col" className="py-1 pr-3">Digrafo</th>
                            <th scope="col" className="py-1">Ocorrências</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(rows as { digraph: string; count: number }[]).map((r) => (
                            <tr key={r.digraph} className="border-b border-line">
                              <th scope="row" className="py-1 pr-3 font-mono font-bold">{r.digraph}</th>
                              <td className="py-1">{r.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-labelledby="pf-eva-3" className="space-y-2">
                <h3 id="pf-eva-3" className="text-xl font-bold">
                  5.3 Propriedades que denunciam o Playfair
                </h3>
                <ul className="list-disc space-y-1 pl-6 text-lg">
                  <li>Nenhuma letra é cifrada em si mesma, o que descarta hipóteses.</li>
                  <li>Se AB vira CD, então BA vira DC (simetria do digrafo inverso).</li>
                  <li>O texto cifrado tem sempre um número par de letras, e nunca há digrafos com letras iguais (como AA) na cifra.</li>
                  <li>Digrafos repetidos no texto claro ficam repetidos na cifra.</li>
                </ul>
                <Callout variant="info" title="Como se quebra o Playfair">
                  <p>
                    Com algumas centenas de letras, a análise de digrafos, o uso de palavras prováveis e, hoje, a busca por computador (têmpera simulada sobre a grade) recuperam a chave. Nos
                    testes deste projeto, a busca local só teve sucesso com cerca de 700 letras e vários reinícios, e levou segundos: por isso Eva, neste laboratório, apenas analisa as
                    estatísticas e não executa essa busca.
                  </p>
                </Callout>
              </section>
            </div>
          </LabSection>

          <LabSection id="pf-results" title="6. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultados da cifragem e da análise de Eva</caption>
                <tbody>
                  <Row label="Palavra-chave" value={run.flow.keyword} mono />
                  <Row label="Grade (linha a linha)" value={Array.from({ length: 5 }, (_, r) => run.grid.slice(r * 5, r * 5 + 5)).join(' / ')} mono />
                  <Row label="Digrafos do texto claro" value={run.flow.plainDigraphs} mono />
                  <Row label="Digrafos da cifra" value={run.flow.cipherDigraphs} mono />
                  {run.flow.tampered && <Row label="Cifra recebida por Bob (alterada por Eva)" value={run.flow.receivedDigraphs} mono />}
                  <Row label="Mensagem recuperada por Bob" value={run.flow.recovered} mono />
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Eva leu a mensagem?</th>
                    <td className="py-2 font-semibold text-k-cipher">Não com a frequência de letras; a cifra continua fraca contra digrafos e computador</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </LabSection>
        </>
      )}
    </>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <tr className="border-b border-line">
      <th scope="row" className="py-2 pr-4 font-semibold">
        {label}
      </th>
      <td className={`break-all py-2 ${mono ? 'font-mono text-base' : ''}`}>{value}</td>
    </tr>
  );
}
