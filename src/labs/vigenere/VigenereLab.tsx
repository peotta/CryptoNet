import { useEffect, useMemo, useState } from 'react';
import { BarSeries } from '../../animations/BarSeries';
import { FrequencyChart } from '../../animations/FrequencyChart';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { TabulaRecta } from '../../animations/TabulaRecta';
import { ALPHABET, letterPercentages, PT_FREQUENCY } from '../../crypto/classical';
import { CryptoInputError, } from '../../crypto/bigmath';
import { engines } from '../../crypto/engines';
import { IC_PORTUGUESE, IC_RANDOM } from '../../crypto/substitution';
import { randomBigIntBelow } from '../../crypto/random';
import { columns, validateVigenereKey } from '../../crypto/vigenere';
import { useDebounced } from '../../hooks/useDebounced';
import { Callout, Field, LabSection, ReviewQuestions, buttonClass } from '../../components/ui';
import { TextDiff } from '../classica/TextDiff';
import { VIGENERE_OBJECTIVES, VIGENERE_QUESTIONS } from './content';
import { buildVigenereProtocol } from './flows';
import { MAX_KEY_LENGTH, MAX_LETTERS, runVigenere, type VigenereRun } from './run';

const EXAMPLE_KEY = 'SEGREDO';
const EXAMPLE_TEXT =
  'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol, atravessar o vale em silêncio e esperar o sinal do comandante junto à ponte velha. Quem for visto pelos moradores deverá voltar imediatamente ao acampamento e aguardar novas ordens. Ninguém deve acender fogueiras durante a noite, porque a fumaça denunciaria a posição de todo o grupo ao inimigo que vigia a estrada principal. Se o plano der certo, ao meio dia a bandeira estará hasteada na torre mais alta.';

const num = (v: number, d = 4) => v.toFixed(d).replace('.', ',');
const pct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

function keyProblem(key: string): string | null {
  try {
    validateVigenereKey(key);
    return null;
  } catch (e) {
    return e instanceof CryptoInputError ? e.message : 'Chave inválida.';
  }
}

function randomKey(length: number): string {
  return Array.from({ length }, () => ALPHABET[Number(randomBigIntBelow(26n))]).join('');
}

/** Cifra letra a letra: a conta de cada letra, com a linha e a coluna da tabela em destaque. */
function LetterStepper({ run, index, onIndex }: { run: VigenereRun; index: number | null; onIndex: (i: number | null) => void }) {
  const n = run.plainLetters.length;
  const m = run.key.length;
  const p = index === null ? 0 : ALPHABET.indexOf(run.plainLetters[index]);
  const kLetter = index === null ? '' : run.key[index % m];
  const k = index === null ? 0 : ALPHABET.indexOf(kLetter);
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-xl font-bold">Cifrar letra a letra</h3>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonClass} disabled={index === null || index === 0} onClick={() => onIndex(index === null || index <= 0 ? null : index - 1)}>
          ← Letra anterior
        </button>
        <button type="button" className={buttonClass} disabled={index !== null && index >= n - 1} onClick={() => onIndex(index === null ? 0 : Math.min(n - 1, index + 1))}>
          {index === null ? 'Começar pela primeira letra' : 'Próxima letra →'}
        </button>
      </div>
      <p aria-live="polite" className="text-lg">
        {index === null ? (
          'Use os botões para ver a conta de cada letra e a posição dela na tabela de Vigenère.'
        ) : (
          <>
            Letra {index + 1} de {n}: P = <span className="font-mono font-bold">{run.plainLetters[index]}</span> ({p}); letra da chave na posição {(index % m) + 1} de {m}: K ={' '}
            <span className="font-mono font-bold">{kLetter}</span> ({k}). <span className="font-mono">C = ({p} + {k}) mod 26 = {p + k} mod 26 = {(p + k) % 26}</span> →{' '}
            <span className="font-mono font-bold">{ALPHABET[(p + k) % 26]}</span>
          </>
        )}
      </p>
      <p className="break-all font-mono text-base text-muted">Cifra até aqui: {index === null ? '(vazia)' : run.cipherLetters.slice(0, index + 1)}</p>
    </div>
  );
}

export default function VigenereLab() {
  const [keyText, setKeyText] = useState(EXAMPLE_KEY);
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [tamper, setTamper] = useState(false);
  const [letter, setLetter] = useState<number | null>(null);
  const [column, setColumn] = useState(0);
  const [run, setRun] = useState<VigenereRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dKey = useDebounced(keyText);
  const dText = useDebounced(text);
  const keyErr = keyProblem(keyText);

  useEffect(() => {
    if (keyProblem(dKey)) {
      setRun(null);
      return;
    }
    let cancelled = false;
    runVigenere(engines.classical, { key: dKey, text: dText, tamper })
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
          setLetter(null);
          setColumn(0);
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
  }, [dKey, dText, tamper]);

  const definition = useMemo(() => (run ? buildVigenereProtocol(run.flow) : null), [run]);
  const plainIdx = letter !== null && run ? ALPHABET.indexOf(run.plainLetters[letter]) : null;
  const keyIdx = letter !== null && run ? ALPHABET.indexOf(run.key[letter % run.key.length]) : null;

  const analysis = useMemo(() => {
    if (!run) return null;
    const { crack } = run;
    const cols = columns(run.cipherLetters, crack.keyLength);
    const top3 = crack.kasiski.rankedFactors.slice(0, 3).map((f) => f - 2);
    const topRepetitions = crack.kasiski.repetitions.slice(0, 8);
    const realKey = run.key;
    return { cols, top3, topRepetitions, realKey };
  }, [run]);

  return (
    <div className="space-y-10">
      <LabSection id="vg-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {VIGENERE_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="vg-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          A cifra de Vigenère (século XVI) usa uma <strong>palavra-chave</strong> repetida ao longo da mensagem: a letra da chave na posição i define um deslocamento de César para a i-ésima letra.
          É uma cifra <strong>polialfabética</strong>: a mesma letra clara vira letras cifradas diferentes, e a análise de frequência simples deixa de funcionar.
        </p>
        <p className="text-lg">
          Mesmo assim, a chave se repete com período m, e isso é uma fragilidade. Eva descobre o <strong>tamanho da chave</strong> (teste de Kasiski e índice de coincidência por coluna) e depois
          quebra cada coluna como um César simples.
        </p>
        <Callout variant="danger" title="Cifra clássica: não oferece segurança">
          <p>Chaves curtas e repetidas deixam um rastro estatístico. Só uma chave aleatória, tão longa quanto o texto e nunca reutilizada (one-time pad) elimina esse rastro.</p>
        </Callout>
      </LabSection>

      <LabSection id="vg-params" title="3. Parâmetros configuráveis">
        <Field
          id="vg-key"
          label="Chave (palavra de 1 a 20 letras)"
          value={keyText}
          onChange={(v) => setKeyText(v.toUpperCase())}
          error={keyErr}
          hint="Letras de A a Z. Quanto mais longa a chave, mais texto Eva precisa para quebrá-la."
          inputMode="text"
          maxLength={MAX_KEY_LENGTH}
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => setKeyText(randomKey(6))}>
            Sortear chave de 6 letras (aleatório seguro)
          </button>
          <button type="button" className={buttonClass} onClick={() => setKeyText(EXAMPLE_KEY)}>
            Usar a chave do exemplo
          </button>
        </div>
        <div>
          <label htmlFor="vg-text" className="mb-1 block text-base font-semibold">
            Mensagem de Alice
          </label>
          <textarea id="vg-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-describedby="vg-text-hint" className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
          <p id="vg-text-hint" className="mt-1 text-base text-muted">
            O texto é normalizado (maiúsculas, sem acentos, espaços ou pontuação; até {MAX_LETTERS} letras). Experimente uma chave longa com um texto curto: sobram poucas letras por coluna e Eva
            falha.
          </p>
        </div>
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
          Eva altera uma letra da cifra em trânsito
        </label>
        {error && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {error}
          </p>
        )}
      </LabSection>

      <LabSection id="vg-viz" title="4. Visualização animada">
        {run && !keyErr ? (
          <div className="space-y-6">
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
              <TabulaRecta keyIndex={keyIdx} plainIndex={plainIdx} />
              <LetterStepper run={run} index={letter} onIndex={setLetter} />
            </div>
            {definition && <ProtocolPlayer definition={definition} resetKey={`${run.key}|${run.cipherLetters}|${run.flow.tampered}`} />}
          </div>
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>

      {run && analysis && (
        <>
          <LabSection id="vg-eva" title="5. Criptoanálise de Eva">
            <div className="space-y-6">
              <section aria-labelledby="vg-eva-1" className="space-y-2">
                <h3 id="vg-eva-1" className="text-xl font-bold">
                  5.1 O índice de coincidência do texto inteiro cai
                </h3>
                <p className="text-lg">
                  Na substituição simples, o IC da cifra era igual ao do texto claro. Na Vigenère, a mistura de alfabetos o aproxima do valor de um texto aleatório ({num(IC_RANDOM)}).
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
              </section>

              <section aria-labelledby="vg-eva-2" className="space-y-3">
                <h3 id="vg-eva-2" className="text-xl font-bold">
                  5.2 Teste de Kasiski
                </h3>
                <p className="text-lg">
                  Eva procura sequências de 3 ou mais letras que se repetem na cifra. Se duas repetições vêm do mesmo trecho de texto claro, a distância entre elas é múltiplo do tamanho da chave.
                  Encontradas {run.crack.kasiski.repetitions.length} sequências repetidas.
                </p>
                {analysis.topRepetitions.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[30rem] text-left text-base">
                      <caption className="mb-2 text-left text-lg font-semibold">As sequências repetidas mais frequentes</caption>
                      <thead>
                        <tr className="border-b border-line">
                          <th scope="col" className="py-2 pr-3">Sequência</th>
                          <th scope="col" className="py-2 pr-3">Posições</th>
                          <th scope="col" className="py-2">Distâncias</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.topRepetitions.map((r) => (
                          <tr key={r.sequence} className="border-b border-line">
                            <th scope="row" className="py-1 pr-3 font-mono font-bold">{r.sequence}</th>
                            <td className="py-1 pr-3 font-mono">{r.positions.join(', ')}</td>
                            <td className="py-1 font-mono">{r.distances.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <BarSeries
                  labels={run.crack.kasiski.factorCounts.map((_, i) => String(i + 2))}
                  values={run.crack.kasiski.factorCounts}
                  highlight={analysis.top3}
                  ariaLabel="Quantas distâncias entre repetições cada fator de 2 a 20 divide"
                  categoryLabel="Fator"
                  valueLabel="Distâncias divisíveis"
                  highlightLabel="os três fatores mais frequentes"
                />
                <p className="text-lg">
                  O tamanho da chave está entre os fatores mais frequentes, mas divisores pequenos (2, 3, 4...) dividem muitas distâncias por acaso: <strong>o Kasiski sozinho costuma ser ambíguo</strong>.
                  Os três mais frequentes aqui são {run.crack.kasiski.rankedFactors.slice(0, 3).join(', ')}.
                </p>
              </section>

              <section aria-labelledby="vg-eva-3" className="space-y-3">
                <h3 id="vg-eva-3" className="text-xl font-bold">
                  5.3 Índice de coincidência médio por tamanho de chave
                </h3>
                <p className="text-lg">
                  Para cada tamanho m, Eva separa a cifra em m colunas e mede o IC médio delas. No tamanho certo, cada coluna é um César simples e o IC volta a ficar perto de{' '}
                  {num(IC_PORTUGUESE)}. Nos tamanhos errados, fica perto de {num(IC_RANDOM)}.
                </p>
                <BarSeries
                  labels={run.crack.ics.map((_, i) => String(i + 1))}
                  values={run.crack.ics}
                  highlight={[run.crack.keyLength - 1]}
                  ariaLabel="Índice de coincidência médio das colunas para cada tamanho de chave"
                  categoryLabel="Tamanho m"
                  valueLabel="IC médio"
                  formatValue={(v) => num(v)}
                  highlightLabel={`tamanho escolhido por Eva: m = ${run.crack.keyLength} (o menor cujo IC médio é compatível com o português)`}
                />
                <p className="text-lg">
                  Múltiplos do tamanho verdadeiro também têm IC alto, e Eva escolhe o menor. Estimativa grosseira de Friedman, só pelo IC global: m ≈ {Number.isFinite(run.crack.friedman) ? num(run.crack.friedman, 1) : 'indefinida'}.
                </p>
              </section>

              <section aria-labelledby="vg-eva-4" className="space-y-3">
                <h3 id="vg-eva-4" className="text-xl font-bold">
                  5.4 Frequência de cada coluna: as letras da chave
                </h3>
                <p className="text-lg">
                  Com m = {run.crack.keyLength}, cada coluna é uma cifra de César. O deslocamento que deixa a coluna mais parecida com português (menor χ²) é a letra da chave.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-left text-base">
                    <caption className="mb-2 text-left text-lg font-semibold">Chave deduzida por Eva, coluna a coluna</caption>
                    <thead>
                      <tr className="border-b border-line">
                        <th scope="col" className="py-2 pr-3">Coluna</th>
                        <th scope="col" className="py-2 pr-3">Letras</th>
                        <th scope="col" className="py-2 pr-3">Letra deduzida</th>
                        <th scope="col" className="py-2 pr-3">Letra real da chave</th>
                        <th scope="col" className="py-2">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.crack.columns.map((c, j) => {
                        const real = analysis.realKey[j % analysis.realKey.length];
                        const ok = c.letter === real;
                        return (
                          <tr key={j} className="border-b border-line">
                            <td className="py-1 pr-3">{j + 1}</td>
                            <td className="py-1 pr-3">{c.length}</td>
                            <th scope="row" className="py-1 pr-3 font-mono font-bold">{c.letter}</th>
                            <td className="py-1 pr-3 font-mono">{real}</td>
                            <td className={`py-1 font-semibold ${ok ? 'text-k-secret' : 'text-danger'}`}>{ok ? 'correta' : 'errada'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor="vg-col" className="text-base font-semibold">
                    Ver o histograma da coluna
                  </label>
                  <select id="vg-col" value={column} onChange={(e) => setColumn(Number(e.target.value))} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-lg">
                    {analysis.cols.map((_, j) => (
                      <option key={j} value={j}>
                        {j + 1}
                      </option>
                    ))}
                  </select>
                </div>
                <FrequencyChart
                  observed={letterPercentages(analysis.cols[Math.min(column, analysis.cols.length - 1)] ?? '')}
                  expected={PT_FREQUENCY}
                  observedLabel={`coluna ${column + 1} da cifra`}
                  expectedLabel="língua portuguesa"
                />
                <p className="text-lg">
                  O histograma da coluna é o do português <strong>deslocado</strong> pela letra da chave: aquele deslocamento é o que Eva procura.
                </p>
              </section>

              <section aria-labelledby="vg-eva-5" className="space-y-3">
                <h3 id="vg-eva-5" className="text-xl font-bold">
                  5.5 Resultado
                </h3>
                <TextDiff guess={run.crack.plaintext} truth={run.plainLetters} label={`Texto deduzido por Eva: ${pct(run.flow.finalPct)} corretas`} />
              </section>
            </div>
          </LabSection>

          <LabSection id="vg-results" title="6. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultados da cifragem e da criptoanálise</caption>
                <tbody>
                  <Row label="Chave de Alice e Bob" value={`${run.key} (${run.key.length} ${run.key.length === 1 ? 'letra' : 'letras'})`} />
                  <Row label="Letras na mensagem" value={String(run.flow.nLetters)} />
                  <Row label="Texto cifrado" value={run.flow.cipherText} mono />
                  {run.flow.tampered && <Row label="Cifra recebida por Bob (alterada por Eva)" value={run.flow.receivedText} mono />}
                  <Row label="Mensagem recuperada por Bob" value={run.flow.recovered} mono />
                  <Row label="Tamanho da chave deduzido por Eva" value={`m = ${run.crack.keyLength}`} />
                  <Row label="Chave deduzida por Eva" value={run.crack.key} mono />
                  <Row label="Letras acertadas por Eva" value={pct(run.flow.finalPct)} />
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Eva quebrou a cifra?</th>
                    <td className={`py-2 font-semibold ${run.flow.level === 'falha' ? 'text-k-cipher' : 'text-danger'}`}>
                      {run.flow.level === 'total' ? 'Sim: chave e mensagem, sem conhecê-las' : run.flow.level === 'parcial' ? 'Em parte' : 'Não nesta tentativa (pouco texto por coluna), mas a cifra continua fraca'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </LabSection>
        </>
      )}

      <LabSection id="vg-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={VIGENERE_QUESTIONS} />
      </LabSection>
    </div>
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
