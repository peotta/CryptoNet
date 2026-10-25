import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { ColumnGrid, RailGrid } from '../../animations/TranspositionViz';
import { CryptoInputError } from '../../crypto/bigmath';
import { normalizeText } from '../../crypto/classical';
import { engines } from '../../crypto/local/classical';
import { IC_PORTUGUESE, randomSubstitutionKey, validateSubstitutionKey } from '../../crypto/substitution';
import { keyOrder, MAX_ATTACK_COLUMNS, MAX_RAILS, validateRails } from '../../crypto/transposition';
import { Callout, Field, LabSection, ReviewQuestions, Tabs, buttonClass } from '../../components/ui';
import { useDebounced } from '../../hooks/useDebounced';
import { TRANSPOSICAO_OBJECTIVES, TRANSPOSICAO_QUESTIONS } from './content';
import { buildTransProtocol, MAX_LETTERS, runTransposition, type TransMode, type TransRun } from './flows';

const EXAMPLE_TEXT =
  'Atacaremos a fortaleza ao amanhecer sem avisar ninguém pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol e esperar o sinal do comandante junto à ponte velha.';
const num = (v: number, d = 3) => v.toFixed(d).replace('.', ',');
const pct = (v: number) => `${v.toFixed(0)}%`;

const problem = (fn: () => void): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof CryptoInputError ? e.message : 'Valor inválido.';
  }
};

export default function TransposicaoLab() {
  const [mode, setMode] = useState<TransMode>('trilhos');
  return (
    <div className="space-y-10">
      <LabSection id="tr-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {TRANSPOSICAO_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="tr-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          Uma cifra de <strong>substituição</strong> troca as letras e mantém suas posições. Uma cifra de <strong>transposição</strong> faz o contrário: mantém as letras e embaralha suas posições.
          Como as letras não mudam, a frequência de cada letra e o índice de coincidência permanecem iguais aos do português, e isso denuncia a transposição. Por outro lado, a ordem das letras fica
          destruída, e é nela que se apoia a análise por pares de letras.
        </p>
        <p className="text-lg">
          Claude Shannon (1949) identificou as duas operações básicas de qualquer cifra: <strong>confusão</strong> (esconder a relação entre chave e cifra, como na substituição) e{' '}
          <strong>difusão</strong> (espalhar a estrutura do texto claro, como na transposição). Combinadas em sequência, formam uma <strong>cifra produto</strong>, a ideia por trás de cada rodada do
          AES.
        </p>
        <Callout variant="danger" title="Cifras clássicas: não oferecem segurança">
          <p>As transposições vistas aqui caem diante de computadores comuns. A cifra produto resiste aos ataques isolados, mas não a ataques conjuntos. Uso estritamente didático.</p>
        </Callout>
        <Tabs
          label="Cifra"
          value={mode}
          onChange={setMode}
          tabs={[
            { id: 'trilhos', label: 'Cerca de trilhos' },
            { id: 'colunar', label: 'Transposição colunar' },
            { id: 'produto', label: 'Cifra produto' },
          ]}
        />
      </LabSection>

      <ModePanel key={mode} mode={mode} />

      <LabSection id="tr-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={TRANSPOSICAO_QUESTIONS} />
      </LabSection>
    </div>
  );
}

function ModePanel({ mode }: { mode: TransMode }) {
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [rails, setRails] = useState(4);
  const [keyword, setKeyword] = useState(mode === 'produto' ? 'SEGREDOS' : 'CHAVE');
  const [subKey, setSubKey] = useState(() => randomSubstitutionKey());
  const [tamper, setTamper] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const [run, setRun] = useState<TransRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dText = useDebounced(text);
  const dKeyword = useDebounced(keyword);
  const dSub = useDebounced(subKey);
  const dRails = useDebounced(rails);

  const n = normalizeText(dText).length;
  const railErr = mode === 'trilhos' ? problem(() => validateRails(dRails, Math.max(n, 2))) : null;
  const kwErr = mode !== 'trilhos' ? problem(() => keyOrder(dKeyword)) : null;
  const subErr = mode === 'produto' ? problem(() => validateSubstitutionKey(dSub)) : null;
  const paramErr = railErr ?? kwErr ?? subErr;

  useEffect(() => {
    if (paramErr) {
      setRun(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    // adia um quadro para que "Eva analisando..." apareça antes do cálculo (até cerca de 2 s)
    const id = window.setTimeout(() => {
      runTransposition(engines.classical, { mode, text: dText, rails: dRails, keyword: dKeyword, subKey: dSub, tamper })
        .then((r) => {
          if (!cancelled) {
            setRun(r);
            setError(null);
            setStep(null);
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
  }, [mode, dText, dRails, dKeyword, dSub, tamper, paramErr]);

  const definition = useMemo(() => (run ? buildTransProtocol(run.flow) : null), [run]);
  const stale = text !== dText || keyword !== dKeyword || subKey !== dSub || rails !== dRails || busy;
  const order = useMemo(() => (run && mode !== 'trilhos' ? keyOrder(run.keyword) : []), [run, mode]);
  const nLive = normalizeText(text).length;

  return (
    <>
      <LabSection id="tr-params" title="3. Parâmetros configuráveis">
        <div>
          <label htmlFor="tr-text" className="mb-1 block text-base font-semibold">
            Mensagem de Alice
          </label>
          <textarea id="tr-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-describedby="tr-text-hint" className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
          <p id="tr-text-hint" className="mt-1 text-base text-muted">
            O texto é normalizado (maiúsculas, sem acentos, espaços ou pontuação; até {MAX_LETTERS} letras). A mensagem tem {nLive} {nLive === 1 ? 'letra' : 'letras'}. Eva precisa de algumas dezenas
            de letras por coluna para reconhecer texto legível.
          </p>
        </div>
        {mode === 'trilhos' ? (
          <div>
            <label htmlFor="tr-rails" className="mb-1 block text-base font-semibold">
              Número de trilhos (2 a {MAX_RAILS})
            </label>
            <input
              id="tr-rails"
              type="number"
              min={2}
              max={MAX_RAILS}
              value={rails}
              onChange={(e) => setRails(Number(e.target.value))}
              aria-invalid={railErr ? true : undefined}
              className="min-h-11 w-28 rounded-lg border border-line bg-surface px-3 text-lg"
            />
            {railErr && (
              <p role="alert" className="mt-1 text-base font-semibold text-danger">
                {railErr}
              </p>
            )}
          </div>
        ) : (
          <Field
            id="tr-keyword"
            label="Palavra-chave da transposição (2 a 12 letras)"
            value={keyword}
            onChange={(v) => setKeyword(v.toUpperCase())}
            error={kwErr}
            hint={`O número de letras é o número de colunas; a ordem alfabética das letras dá a ordem de leitura. Eva ataca até ${MAX_ATTACK_COLUMNS} colunas: experimente uma palavra com 9 ou mais letras.`}
            inputMode="text"
            maxLength={12}
          />
        )}
        {mode === 'produto' && (
          <>
            <Field
              id="tr-subkey"
              label="Chave de substituição (permutação das 26 letras)"
              value={subKey}
              onChange={(v) => setSubKey(v.toUpperCase())}
              error={subErr}
              hint="A substituição é aplicada primeiro; a transposição, depois."
              inputMode="text"
              maxLength={26}
            />
            <div className="flex flex-wrap gap-3">
              <button type="button" className={buttonClass} onClick={() => setSubKey(randomSubstitutionKey())}>
                Sortear chave de substituição (aleatório seguro)
              </button>
            </div>
          </>
        )}
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
          {stale && !paramErr ? 'Eva está analisando a cifra…' : ''}
        </p>
      </LabSection>

      <LabSection id="tr-viz" title="4. Visualização animada">
        {run && !paramErr ? (
          <div className="space-y-6">
            {mode === 'trilhos' ? (
              <>
                <RailGrid text={run.plainLetters} rails={run.railCount} index={step} />
                <Stepper
                  title="Escrever em zigue-zague"
                  step={step}
                  total={run.plainLetters.length}
                  unit="letra"
                  onStep={setStep}
                  summary={step === null ? 'Use os botões para ver cada letra cair no seu trilho.' : `Letra ${step + 1} de ${run.plainLetters.length}: ${run.plainLetters[step]} vai para o trilho ${railOf(run, step) + 1}.`}
                />
                <p className="break-all font-mono text-base text-muted">Cifra (leitura trilho por trilho): {run.cipherLetters}</p>
              </>
            ) : (
              <>
                <ColumnGrid
                  text={run.midLetters}
                  keyword={run.keyword}
                  readColumns={order.slice(0, step ?? 0)}
                  caption={mode === 'produto' ? 'Texto já substituído, escrito em linhas sob a palavra-chave' : 'Texto escrito em linhas sob a palavra-chave'}
                />
                <Stepper
                  title="Ler as colunas"
                  step={step === null ? null : step - 1}
                  total={order.length}
                  unit="coluna"
                  onStep={(i) => setStep(i === null ? null : i + 1)}
                  summary={
                    step === null || step === 0
                      ? 'Use os botões para ler as colunas na ordem alfabética das letras da chave.'
                      : `Coluna ${order[step - 1] + 1} (letra ${run.keyword[order[step - 1]]}) é lida em ${step}º lugar.`
                  }
                />
                {mode === 'produto' && (
                  <dl className="space-y-1 rounded-xl border border-line bg-surface p-4 text-base">
                    <div>
                      <dt className="font-semibold">Texto claro</dt>
                      <dd className="break-all font-mono">{run.plainLetters.slice(0, 60)}…</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Depois da substituição (confusão)</dt>
                      <dd className="break-all font-mono">{run.midLetters.slice(0, 60)}…</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Depois da transposição (difusão)</dt>
                      <dd className="break-all font-mono">{run.cipherLetters.slice(0, 60)}…</dd>
                    </div>
                  </dl>
                )}
                <p className="break-all font-mono text-base text-muted">Cifra: {run.cipherLetters}</p>
              </>
            )}
            {definition && <ProtocolPlayer definition={definition} resetKey={`${mode}|${run.cipherLetters}|${run.flow.tampered}`} />}
          </div>
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>

      {run && (
        <>
          <LabSection id="tr-eva" title="5. Criptoanálise de Eva">
            <div className="space-y-6">
              <section aria-labelledby="tr-eva-1" className="space-y-3">
                <h3 id="tr-eva-1" className="text-xl font-bold">
                  5.1 A impressão digital da cifra
                </h3>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['IC do texto claro', num(run.flow.icPlain, 4)],
                    ['IC da cifra', num(run.flow.icCipher, 4)],
                    ['Português (referência)', num(IC_PORTUGUESE, 4)],
                    ['Correlação do histograma com o português', num(run.flow.corrCipher, 2)],
                    ['Legibilidade do texto claro', num(run.flow.readPlain, 2)],
                    ['Legibilidade da cifra', num(run.flow.readCipher, 2)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-line bg-surface p-3">
                      <dt className="text-base text-muted">{k}</dt>
                      <dd className="font-mono text-xl font-bold">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-lg">
                  Conclusão de Eva: <strong>{run.flow.fingerprint}</strong>.
                </p>
              </section>

              <section aria-labelledby="tr-eva-2" className="space-y-3">
                <h3 id="tr-eva-2" className="text-xl font-bold">
                  5.2 O ataque
                </h3>
                {mode === 'trilhos' && run.rails && (
                  <CandidateTable
                    caption="Texto obtido para cada número de trilhos, do mais para o menos legível"
                    head={['Trilhos', 'Legibilidade', 'Início do texto']}
                    rows={run.rails.map((c) => [String(c.rails), num(c.score, 2), c.plaintext.slice(0, 40)])}
                    best={0}
                  />
                )}
                {mode === 'colunar' && run.columns && (
                  <CandidateTable
                    caption="Melhor ordem de colunas para cada número de colunas, do mais para o menos legível"
                    head={['Colunas', 'Ordem de leitura', 'Legibilidade', 'Início do texto']}
                    rows={run.columns.map((c) => [String(c.columns), c.order.map((x) => x + 1).join(' '), num(c.score, 2), c.plaintext.slice(0, 40)])}
                    best={0}
                  />
                )}
                {mode === 'colunar' && !run.columns && (
                  <Callout variant="info" title="Eva não tenta a busca exaustiva">
                    <p>{run.flow.attackResult}. Isso é um limite deste laboratório, e não segurança da cifra.</p>
                  </Callout>
                )}
                {mode === 'produto' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-lg">
                      <caption className="mb-1 text-left text-base text-muted">Letras do texto claro recuperadas pelos ataques isolados</caption>
                      <thead>
                        <tr className="border-b border-line">
                          <th scope="col" className="py-2 pr-4">Ataque</th>
                          <th scope="col" className="py-2">Acerto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {run.flow.compare.map((c) => (
                          <tr key={c.label} className="border-b border-line">
                            <th scope="row" className="py-2 pr-4 font-semibold">{c.label}</th>
                            <td className="py-2 font-mono">{pct(c.pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {run.flow.level === 'total' ? (
                  <p role="status" className="rounded-xl border-2 border-danger bg-danger/10 p-4 text-lg font-semibold text-danger">
                    Eva recuperou {pct(run.flow.attackPct)} da mensagem. {run.flow.verdictText}
                  </p>
                ) : (
                  <Callout variant={mode === 'produto' ? 'ok' : 'info'} title={mode === 'produto' ? 'Os ataques isolados falham' : 'Resultado do ataque'}>
                    <p>{run.flow.verdictText}</p>
                  </Callout>
                )}
              </section>
            </div>
          </LabSection>

          <LabSection id="tr-results" title="6. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultados da cifragem e da análise de Eva</caption>
                <tbody>
                  <Row label="Cifra" value={run.flow.keyText} />
                  <Row label="Mensagem (letras)" value={String(run.flow.nLetters)} />
                  <Row label="Texto claro" value={run.flow.plain} mono />
                  <Row label="Texto cifrado" value={run.flow.cipherText} mono />
                  {run.flow.tampered && <Row label="Cifra recebida por Bob (alterada por Eva)" value={run.flow.receivedText} mono />}
                  <Row label="Mensagem recuperada por Bob" value={run.flow.recovered} mono />
                  <Row label="Resultado do ataque de Eva" value={run.flow.attackResult} />
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Eva leu a mensagem?</th>
                    <td className={`py-2 font-semibold ${run.flow.level === 'total' ? 'text-danger' : 'text-k-secret'}`}>
                      {run.flow.level === 'total' ? `Sim: ${pct(run.flow.attackPct)} do texto` : run.flow.level === 'nao-tentou' ? 'Não tentou neste laboratório' : `Não nesta tentativa (${pct(run.flow.attackPct)})`}
                    </td>
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

function railOf(run: TransRun, i: number): number {
  const period = 2 * (run.railCount - 1);
  const r = i % period;
  return r < run.railCount ? r : period - r;
}

function Stepper({ title, step, total, unit, onStep, summary }: { title: string; step: number | null; total: number; unit: string; onStep: (i: number | null) => void; summary: string }) {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-xl font-bold">{title}</h3>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonClass} disabled={step === null} onClick={() => onStep(step === null || step <= 0 ? null : step - 1)}>
          ← {unit === 'letra' ? 'Letra anterior' : 'Coluna anterior'}
        </button>
        <button type="button" className={buttonClass} disabled={step !== null && step >= total - 1} onClick={() => onStep(step === null ? 0 : Math.min(total - 1, step + 1))}>
          {step === null ? `Começar pela primeira ${unit}` : unit === 'letra' ? 'Próxima letra →' : 'Próxima coluna →'}
        </button>
      </div>
      <p aria-live="polite" className="text-lg">
        {summary}
      </p>
    </div>
  );
}

function CandidateTable({ caption, head, rows, best }: { caption: string; head: string[]; rows: string[][]; best: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-base">
        <caption className="mb-1 text-left text-base text-muted">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th key={h} scope="col" className="py-2 pr-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r[0]} className={`border-b border-line ${i === best ? 'font-bold' : ''}`}>
              {r.map((v, j) => (
                <td key={j} className={`py-2 pr-4 ${j === r.length - 1 ? 'font-mono' : ''}`}>
                  {v}
                  {i === best && j === 0 && <span className="sr-only"> (escolhido por Eva)</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
