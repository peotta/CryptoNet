import { useEffect, useMemo, useState } from 'react';
import { AlphabetStrip } from '../../animations/CipherDisk';
import { LetterCard, LetterHistory } from '../../animations/LetterPairs';
import { FrequencyChart } from '../../animations/FrequencyChart';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { ALPHABET, letterCounts, letterPercentages, PT_FREQUENCY } from '../../crypto/classical';
import { engines } from '../../crypto/local/classical';
import { CryptoInputError } from '../../crypto/bigmath';
import { indexOfCoincidence, IC_PORTUGUESE, IC_RANDOM, invertKey, randomSubstitutionKey, SUBSTITUTION_KEY_SPACE, validateSubstitutionKey } from '../../crypto/substitution';
import { useDebounced } from '../../hooks/useDebounced';
import { Callout, Field, LabSection, ReviewQuestions, buttonClass } from '../../components/ui';
import { TextDiff } from '../classica/TextDiff';
import { SUBSTITUTION_OBJECTIVES, SUBSTITUTION_QUESTIONS } from './content';
import { buildSubstitutionProtocol } from './flows';
import { MAX_LETTERS, runSubstitution, type SubstitutionRun } from './run';

const EXAMPLE_KEY = 'QWERTYUIOPASDFGHJKLZXCVBNM';
const EXAMPLE_TEXT = 'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma.';

const num = (v: number, d = 4) => v.toFixed(d).replace('.', ',');
const pct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

function keyProblem(key: string): string | null {
  try {
    validateSubstitutionKey(key);
    return null;
  } catch (e) {
    return e instanceof CryptoInputError ? e.message : 'Chave inválida.';
  }
}

function LetterStepper({ run, index, onIndex }: { run: SubstitutionRun; index: number | null; onIndex: (i: number | null) => void }) {
  const n = run.plainLetters.length;
  const p = index === null ? 0 : ALPHABET.indexOf(run.plainLetters[index]);
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
      <div aria-live="polite" className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-line bg-surface-2 p-3">
        {index === null ? (
          <p className="text-lg">Use os botões para ver a consulta à tabela de cada letra.</p>
        ) : (
          <>
            <LetterCard plain={run.plainLetters} cipher={run.cipherLetters} index={index} />
            <p className="text-lg">
              Letra {index + 1} de {n}: <span className="font-mono">{run.plainLetters[index]}</span> está na posição {p} do alfabeto; a posição {p} da chave é{' '}
              <span className="font-mono">{run.key[p]}</span>.
            </p>
          </>
        )}
      </div>
      <LetterHistory plain={run.plainLetters} cipher={run.cipherLetters} index={index} />
    </div>
  );
}

export default function SubstituicaoLab() {
  const [keyText, setKeyText] = useState(EXAMPLE_KEY);
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [tamper, setTamper] = useState(false);
  const [letter, setLetter] = useState<number | null>(null);
  const [run, setRun] = useState<SubstitutionRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dKey = useDebounced(keyText);
  const dText = useDebounced(text);
  const keyErr = keyProblem(keyText);

  useEffect(() => {
    if (keyProblem(dKey)) {
      setRun(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    // adia um quadro para que "Eva analisando..." apareça antes do cálculo (cerca de 0,3 s)
    const id = window.setTimeout(() => {
      runSubstitution(engines.classical, { key: dKey, text: dText, tamper })
        .then((r) => {
          if (!cancelled) {
            setRun(r);
            setError(null);
            setLetter(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setRun(null);
            setError(e instanceof Error ? e.message : 'Falha ao cifrar.');
          }
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [dKey, dText, tamper]);

  const definition = useMemo(() => (run ? buildSubstitutionProtocol(run.flow) : null), [run]);
  const stale = keyText !== dKey || text !== dText || busy;
  const highlight = letter !== null && run ? ALPHABET.indexOf(run.plainLetters[letter]) : null;

  const analysis = useMemo(() => {
    if (!run) return null;
    const counts = letterCounts(run.cipherLetters);
    const percents = letterPercentages(run.cipherLetters);
    const cipherRank = [...Array(26).keys()].sort((a, b) => counts[b] - counts[a] || a - b);
    const realInv = invertKey(run.key);
    const evaKey = run.flow.evaKey;
    const unseen = [...ALPHABET].filter((ch) => !run.plainLetters.includes(ch));
    return {
      percents,
      top: cipherRank.slice(0, 8).map((c, i) => ({
        pos: i + 1,
        cipher: ALPHABET[c],
        pct: percents[c],
        guess: run.freqInverse[c],
        right: realInv[c] === run.freqInverse[c],
      })),
      evaKey,
      keyRight: [...evaKey].filter((ch, i) => ch === run.key[i]).length,
      unseen,
      icPlain: indexOfCoincidence(run.plainLetters),
      icCipher: indexOfCoincidence(run.cipherLetters),
    };
  }, [run]);

  return (
    <div className="space-y-10">
      <LabSection id="sb-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {SUBSTITUTION_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="sb-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          Na substituição simples (monoalfabética), a chave é uma <strong>permutação das 26 letras</strong>. Há 26! = {SUBSTITUTION_KEY_SPACE.toString()} ≈ 4,0 × 10²⁶ chaves, um espaço
          enorme para a força bruta, muito maior que o da cifra de César (26) ou da afim (312). Mesmo assim, a cifra é frágil.
        </p>
        <p className="text-lg">
          A razão é que cada letra sempre vira a mesma letra cifrada: <strong>a estatística da língua sobrevive</strong>. Eva atacará em dois passos: a análise de frequência dá um primeiro palpite
          e o refinamento com bigramas (pares de letras) conserta o resto.
        </p>
        <Callout variant="danger" title="Cifra clássica: não oferece segurança">
          <p>O tamanho do espaço de chaves não basta. Uma cifra é segura se resiste à criptoanálise, e não apenas à força bruta.</p>
        </Callout>
      </LabSection>

      <LabSection id="sb-params" title="3. Parâmetros configuráveis">
        <Field
          id="sb-key"
          label="Chave (permutação das 26 letras: a letra de cada posição do alfabeto)"
          value={keyText}
          onChange={(v) => setKeyText(v.toUpperCase())}
          error={keyErr}
          hint="A posição 1 diz em que letra o A vira, a posição 2 o B, e assim por diante."
          inputMode="text"
          maxLength={26}
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => setKeyText(randomSubstitutionKey())}>
            Sortear chave (aleatório seguro)
          </button>
          <button type="button" className={buttonClass} onClick={() => setKeyText(EXAMPLE_KEY)}>
            Usar a chave do exemplo
          </button>
        </div>
        <div>
          <label htmlFor="sb-text" className="mb-1 block text-base font-semibold">
            Mensagem de Alice
          </label>
          <textarea id="sb-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-describedby="sb-text-hint" className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
          <p id="sb-text-hint" className="mt-1 text-base text-muted">
            O texto é normalizado (maiúsculas, sem acentos, espaços ou pontuação; até {MAX_LETTERS} letras). A criptoanálise de Eva precisa de algumas centenas de letras: experimente
            encurtar o texto para ver quando ela falha.
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
        <p aria-live="polite" className="text-base text-muted">
          {stale && !keyErr ? 'Eva está analisando a cifra…' : ''}
        </p>
      </LabSection>

      {run && !keyErr && (
        <LabSection id="sb-exec" title="4. Execução do algoritmo">
          <div className="space-y-6">
            <div className="space-y-4">
              <AlphabetStrip table={run.key} highlight={highlight} tinted />
              <LetterStepper run={run} index={letter} onIndex={setLetter} />
            </div>
          </div>
        </LabSection>
      )}

      <LabSection id="sb-viz" title="5. Visualização animada">
        {run && !keyErr ? (
          definition && <ProtocolPlayer definition={definition} resetKey={`${run.key}|${run.cipherLetters}|${run.flow.tampered}`} />
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>

      {run && analysis && (
        <>
          <LabSection id="sb-eva" title="6. Criptoanálise de Eva">
            <div className="space-y-6">
              <section aria-labelledby="sb-eva-1" className="space-y-2">
                <h3 id="sb-eva-1" className="text-xl font-bold">
                  5.1 O espaço de chaves é enorme, mas isso não protege
                </h3>
                <p className="text-lg">
                  Testar as 26! ≈ 4,0 × 10²⁶ chaves a 1 bilhão por segundo levaria cerca de <strong>12,8 bilhões de anos</strong>. Eva não precisa disso: ela explora a estrutura da língua.
                </p>
              </section>

              <section aria-labelledby="sb-eva-2" className="space-y-2">
                <h3 id="sb-eva-2" className="text-xl font-bold">
                  5.2 O índice de coincidência não muda
                </h3>
                <p className="text-lg">
                  O índice de coincidência (IC) é a probabilidade de duas letras sorteadas do texto serem iguais. Texto em português tem IC próximo de {num(IC_PORTUGUESE)}; uma sequência aleatória, próximo
                  de {num(IC_RANDOM)}.
                </p>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Texto claro', num(analysis.icPlain)],
                    ['Texto cifrado', num(analysis.icCipher)],
                    ['Português (referência)', num(IC_PORTUGUESE)],
                    ['Aleatório (referência)', num(IC_RANDOM)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-line bg-surface p-3">
                      <dt className="text-base text-muted">{k}</dt>
                      <dd className="font-mono text-xl font-bold">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-lg">
                  O IC da cifra é <strong>idêntico</strong> ao do texto claro: a substituição só renomeia as letras. Isso mostra a Eva que a cifra é monoalfabética (e é o que o Vigenère tentará
                  mudar).
                </p>
              </section>

              <section aria-labelledby="sb-eva-3" className="space-y-3">
                <h3 id="sb-eva-3" className="text-xl font-bold">
                  5.3 Análise de frequência
                </h3>
                <FrequencyChart observed={analysis.percents} expected={PT_FREQUENCY} observedLabel="texto cifrado capturado por Eva" expectedLabel="língua portuguesa" />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-base">
                    <caption className="mb-2 text-left text-lg font-semibold">As 8 letras mais frequentes da cifra e o palpite de Eva</caption>
                    <thead>
                      <tr className="border-b border-line">
                        <th scope="col" className="py-2 pr-3">Posição</th>
                        <th scope="col" className="py-2 pr-3">Letra cifrada</th>
                        <th scope="col" className="py-2 pr-3">Frequência</th>
                        <th scope="col" className="py-2 pr-3">Palpite (letra do português na mesma posição)</th>
                        <th scope="col" className="py-2">Palpite está</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.top.map((r) => (
                        <tr key={r.pos} className="border-b border-line">
                          <td className="py-1 pr-3">{r.pos}</td>
                          <th scope="row" className="py-1 pr-3 font-mono font-bold">{r.cipher}</th>
                          <td className="py-1 pr-3">{pct(r.pct)}</td>
                          <td className="py-1 pr-3 font-mono">{r.guess}</td>
                          <td className={`py-1 font-semibold ${r.right ? 'text-k-secret' : 'text-danger'}`}>{r.right ? 'correto' : 'errado'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TextDiff guess={run.freqPlain} truth={run.plainLetters} label={`Só por frequência: ${pct(run.flow.freqPct)} corretas`} />
              </section>

              <section aria-labelledby="sb-eva-4" className="space-y-3">
                <h3 id="sb-eva-4" className="text-xl font-bold">
                  5.4 Refinamento com bigramas
                </h3>
                <p className="text-lg">
                  Eva parte do palpite por frequência e troca pares de letras. A cada troca, mede o quanto o texto decifrado se parece com português usando as frequências dos <strong>pares de
                  letras</strong>. Ela repete enquanto a pontuação melhorar.
                </p>
                <TextDiff guess={run.refinedPlain} truth={run.plainLetters} label={`Depois do refinamento: ${pct(run.flow.finalPct)} corretas`} />
                <div className="overflow-x-auto">
                  <table className="border-separate border-spacing-0.5 font-mono text-base">
                    <caption className="mb-1 text-left font-sans text-lg font-semibold">
                      Chave real e chave deduzida por Eva: {analysis.keyRight} de 26 posições iguais
                    </caption>
                    <tbody>
                      <tr>
                        <th scope="row" className="pr-3 text-left font-sans font-semibold">Letra clara</th>
                        {[...ALPHABET].map((ch) => (
                          <td key={ch} className="min-w-7 rounded border border-line text-center">{ch}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className="pr-3 text-left font-sans font-semibold">Chave real</th>
                        {[...run.key].map((ch, i) => (
                          <td key={i} className="min-w-7 rounded border border-line text-center">{ch}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className="pr-3 text-left font-sans font-semibold">Chave de Eva</th>
                        {[...analysis.evaKey].map((ch, i) => (
                          <td key={i} className={`min-w-7 rounded border text-center ${ch === run.key[i] ? 'border-line' : 'border-danger font-bold text-danger underline decoration-2'}`}>
                            {ch}
                            {ch !== run.key[i] && <span className="sr-only"> (errada)</span>}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                {analysis.unseen.length > 0 && (
                  <p className="text-base text-muted">
                    Letras que não aparecem no texto ({analysis.unseen.join(', ')}) não deixam rastro na cifra: Eva não tem como deduzir a posição delas na chave, e isso não afeta a leitura da mensagem.
                  </p>
                )}
              </section>
            </div>
          </LabSection>

          <LabSection id="sb-results" title="7. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultados da cifragem e da criptoanálise</caption>
                <tbody>
                  <Row label="Letras na mensagem" value={String(run.flow.nLetters)} />
                  <Row label="Texto cifrado" value={run.flow.cipherText} mono />
                  {run.flow.tampered && <Row label="Cifra recebida por Bob (alterada por Eva)" value={run.flow.receivedText} mono />}
                  <Row label="Mensagem recuperada por Bob" value={run.flow.recovered} mono />
                  <Row label="Letras acertadas só por frequência" value={pct(run.flow.freqPct)} />
                  <Row label="Letras acertadas após o refinamento" value={pct(run.flow.finalPct)} />
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Eva quebrou a cifra?</th>
                    <td className={`py-2 font-semibold ${run.flow.level === 'falha' ? 'text-k-cipher' : 'text-danger'}`}>
                      {run.flow.level === 'total' ? 'Sim: quase todo o texto, sem conhecer a chave' : run.flow.level === 'parcial' ? 'Em grande parte' : 'Não nesta tentativa (texto curto), mas a cifra continua fraca'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </LabSection>
        </>
      )}

      <LabSection id="sb-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={SUBSTITUTION_QUESTIONS} />
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
