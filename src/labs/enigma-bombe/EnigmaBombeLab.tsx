import { useEffect, useMemo, useState } from 'react';
import { MenuGraph } from '../../animations/BombeViz';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { permsFor, propagate } from '../../crypto/bombe';
import { ALPHABET } from '../../crypto/classical';
import { CryptoInputError } from '../../crypto/bigmath';
import { engines } from '../../crypto/engines';
import { REFLECTOR_NAMES, ROTOR_NAMES, validateConfig, type EnigmaConfig, type ReflectorName, type RotorName } from '../../crypto/enigma';
import { keySpace } from '../../crypto/enigma';
import { randomBigIntBelow } from '../../crypto/random';
import { Callout, Field, LabSection, ReviewQuestions, buttonClass } from '../../components/ui';
import { useDebounced } from '../../hooks/useDebounced';
import { BOMBE_OBJECTIVES, BOMBE_QUESTIONS } from './content';
import { bigText, buildBombeProtocol, MAX_LETTERS, runBombeLab, type BombeRun } from './flows';

const EXAMPLE_TEXT =
  'Relatório do tempo sem novidades. Nada a reportar nesta madrugada. Mantenha a posição até nova ordem. Aguardamos a confirmação do comando no horário combinado e seguiremos as instruções recebidas ontem à noite pelo rádio';
const DEFAULT_PLUGS = 'AV BS CG DL FU HZ IN KM OW RX';

interface Form {
  left: RotorName;
  middle: RotorName;
  right: RotorName;
  reflector: ReflectorName;
  positions: string;
  rings: string;
  plugs: string;
}
const DEFAULT_FORM: Form = { left: 'I', middle: 'II', right: 'III', reflector: 'B', positions: 'QDV', rings: 'AAA', plugs: DEFAULT_PLUGS };
const toConfig = (f: Form): EnigmaConfig => ({ rotors: [f.left, f.middle, f.right], reflector: f.reflector, positions: f.positions, rings: f.rings, plugs: f.plugs });

function configProblem(f: Form): string | null {
  try {
    validateConfig(toConfig(f));
    return null;
  } catch (e) {
    return e instanceof CryptoInputError ? e.message : 'Configuração inválida.';
  }
}

const rnd = (n: number) => Number(randomBigIntBelow(BigInt(n)));
const randLetters = (n: number) => Array.from({ length: n }, () => ALPHABET[rnd(26)]).join('');
function randomForm(): Form {
  const pool = [...ROTOR_NAMES];
  const [left, middle, right] = [0, 1, 2].map(() => pool.splice(rnd(pool.length), 1)[0]);
  const alpha = [...ALPHABET];
  for (let i = alpha.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [alpha[i], alpha[j]] = [alpha[j], alpha[i]];
  }
  const plugs = Array.from({ length: 10 }, (_, k) => alpha[2 * k] + alpha[2 * k + 1]).join(' ');
  return { left, middle, right, reflector: rnd(2) ? 'B' : 'C', positions: randLetters(3), rings: 'AAA', plugs };
}

function RotorSelect({ id, label, value, onChange }: { id: string; label: string; value: RotorName; onChange: (v: RotorName) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-semibold">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as RotorName)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg">
        {ROTOR_NAMES.map((r) => (
          <option key={r} value={r}>
            Rotor {r}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Inspetor: acompanha, uma dedução por vez, a propagação de uma hipótese de plugue em uma posição inicial. */
function Inspector({ run }: { run: BombeRun }) {
  const { edges, stats } = run.attack;
  const [start, setStart] = useState('AAA');
  const [assumed, setAssumed] = useState('A');
  const [step, setStep] = useState(0);
  const startOk = /^[A-Z]{3}$/.test(start);
  const setup = useMemo(() => ({ rotors: run.config.rotors, reflector: run.config.reflector, rings: run.config.rings }), [run.config]);
  const prop = useMemo(() => {
    if (!startOk) return null;
    return propagate(edges, permsFor(setup, start, edges), stats.testLetter, assumed, true);
  }, [edges, setup, start, startOk, stats.testLetter, assumed]);
  const total = prop ? prop.log.length : 0;
  const shown = prop ? prop.log.slice(0, step) : [];
  const done = prop !== null && step >= total;
  const knownLetters = shown.flatMap((l) => [l.to, l.value]);

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-xl font-bold">Inspetor: uma posição, uma hipótese</h3>
      <p className="text-lg">
        Escolha uma posição inicial dos rotores e um plugue hipotético para a letra de teste <strong className="font-mono">{stats.testLetter}</strong> e acompanhe as deduções, uma por vez. Experimente a
        posição verdadeira (aparece nos parâmetros, mas Eva não a conhece) e uma posição errada.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="bm-start"
          label="Posições iniciais dos rotores (3 letras)"
          value={start}
          onChange={(v) => {
            setStart(v.toUpperCase());
            setStep(0);
          }}
          error={startOk ? null : 'Use exatamente 3 letras (A a Z).'}
          inputMode="text"
          maxLength={3}
        />
        <div>
          <label htmlFor="bm-assumed" className="mb-1 block text-base font-semibold">
            Hipótese: {stats.testLetter} está ligada no painel à letra
          </label>
          <select
            id="bm-assumed"
            value={assumed}
            onChange={(e) => {
              setAssumed(e.target.value);
              setStep(0);
            }}
            className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg"
          >
            {[...ALPHABET].map((l) => (
              <option key={l} value={l}>
                {l}
                {l === stats.testLetter ? ' (a própria letra: sem plugue)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      {prop && (
        <>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonClass} disabled={step === 0} onClick={() => setStep(step - 1)}>
              ← Voltar
            </button>
            <button type="button" className={buttonClass} disabled={done} onClick={() => setStep(step + 1)}>
              {step === 0 ? 'Iniciar: aplicar a hipótese' : 'Próxima dedução →'}
            </button>
            <button type="button" className={buttonClass} disabled={step === 0} onClick={() => setStep(0)}>
              Reiniciar
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <MenuGraph edges={edges} test={stats.testLetter} known={knownLetters} />
            <ol aria-label="Deduções" aria-live="polite" className="space-y-2 text-lg">
              {shown.length === 0 && <li className="text-muted">Nenhuma dedução ainda. Pressione o botão para aplicar a hipótese.</li>}
              {shown.map((l, i) => (
                <li key={i}>
                  {l.step === 0 ? (
                    <>
                      <strong>Hipótese:</strong> <span className="font-mono">{l.to}</span> ligada a <span className="font-mono">{l.value}</span> (e, por simetria, <span className="font-mono">{l.value}</span> ligada a{' '}
                      <span className="font-mono">{l.to}</span>).
                    </>
                  ) : (
                    <>
                      Tecla {l.step}: de <span className="font-mono">{l.from}</span> segue que <span className="font-mono">{l.to}</span> está ligada a <span className="font-mono">{l.value}</span>.
                    </>
                  )}
                </li>
              ))}
              {done && (
                <li className={`rounded-lg border-2 p-3 font-semibold ${prop.contradiction ? 'border-danger bg-danger/10 text-danger' : 'border-k-secret bg-k-secret/10'}`}>
                  {prop.contradiction && prop.conflict
                    ? `Contradição: pela tecla ${prop.conflict.step}, ${prop.conflict.to} deveria estar ligada a ${prop.conflict.value}, mas já estava ligada a ${prop.conflict.existing}. A hipótese é impossível.`
                    : `Sem contradição: com as posições ${start} e esta hipótese, a Bombe pararia aqui (${prop.log.length} deduções).`}
                </li>
              )}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}

export default function EnigmaBombeLab() {
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [crib, setCrib] = useState('RELATORIODOTEMPO');
  const [cribPos, setCribPos] = useState(1);
  const [run, setRun] = useState<BombeRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dForm = useDebounced(form);
  const dText = useDebounced(text);
  const dCrib = useDebounced(crib);
  const dPos = useDebounced(cribPos);
  const cfgError = configProblem(form);
  const dCfgError = configProblem(dForm);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (dCfgError) {
      setRun(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    // adia um quadro para que "Eva operando a Bombe..." apareça antes do cálculo (cerca de 2 s)
    const id = window.setTimeout(() => {
      runBombeLab(engines.classical, { config: toConfig(dForm), text: dText, crib: dCrib, cribPosition: dPos })
        .then((r) => {
          if (!cancelled) {
            setRun(r);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setRun(null);
            setError(e instanceof Error ? e.message : 'Falha ao executar a Bombe.');
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
  }, [dForm, dText, dCrib, dPos, dCfgError]);

  const definition = useMemo(() => (run ? buildBombeProtocol(run.flow) : null), [run]);
  const stale = form !== dForm || text !== dText || crib !== dCrib || cribPos !== dPos || busy;
  const space = useMemo(() => keySpace(10), []);

  return (
    <div className="space-y-10">
      <LabSection id="bb-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {BOMBE_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="bb-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          <strong>Pré-requisito:</strong> o laboratório da Enigma (fase 1). Como o espaço de chaves da Enigma é grande demais para a força bruta, os criptoanalistas de Bletchley Park (Alan Turing e
          Gordon Welchman) construíram a <strong>Bombe</strong>: uma máquina que, a partir de um <strong>texto provável</strong> (<em>crib</em>) alinhado à cifra, descarta quase todas as posições
          iniciais dos rotores por <strong>contradição lógica</strong>.
        </p>
        <p className="text-lg">
          A ideia: a cifra liga, em cada tecla, a letra suposta do texto claro à letra cifrada, e essas ligações formam um <strong>menu</strong> (grafo). Supondo que a letra de teste esteja ligada a
          certa letra no painel de plugues, as consequências se propagam pelo menu. Se alguma letra acabar com dois plugues diferentes, a hipótese é impossível. Se as 26 hipóteses falharem, a posição
          dos rotores está errada.
        </p>
        <Callout variant="info" title="Hipóteses desta simulação (Eva já sabe ou supõe)">
          <ul className="list-disc space-y-1 pl-6">
            <li>A ordem dos rotores, o refletor e os anéis são conhecidos de Eva; ela procura as posições iniciais e o painel de plugues.</li>
            <li>Eva sabe em que tecla começa o texto provável. Na prática, repetia-se a Bombe para cada alinhamento possível.</li>
            <li>O avanço dos rotores é simulado exatamente; a máquina física exigia que o rotor do meio não girasse durante o texto provável.</li>
          </ul>
        </Callout>
        <Callout variant="danger" title="Cifra histórica: não oferece segurança">
          <p>A Enigma foi quebrada durante a guerra. Aqui ela serve para estudar a criptoanálise por texto provável.</p>
        </Callout>
      </LabSection>

      <LabSection id="bb-params" title="3. Parâmetros configuráveis">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RotorSelect id="bb-left" label="Rotor da esquerda" value={form.left} onChange={(v) => set('left', v)} />
          <RotorSelect id="bb-middle" label="Rotor do meio" value={form.middle} onChange={(v) => set('middle', v)} />
          <RotorSelect id="bb-right" label="Rotor da direita" value={form.right} onChange={(v) => set('right', v)} />
          <div>
            <label htmlFor="bb-refl" className="mb-1 block text-base font-semibold">
              Refletor
            </label>
            <select id="bb-refl" value={form.reflector} onChange={(e) => set('reflector', e.target.value as ReflectorName)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg">
              {REFLECTOR_NAMES.map((r) => (
                <option key={r} value={r}>
                  Refletor {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="bb-pos" label="Posições iniciais do dia (a incógnita de Eva)" value={form.positions} onChange={(v) => set('positions', v.toUpperCase())} inputMode="text" maxLength={3} />
          <Field id="bb-rings" label="Anéis (conhecidos de Eva)" value={form.rings} onChange={(v) => set('rings', v.toUpperCase())} inputMode="text" maxLength={3} />
        </div>
        <Field id="bb-plugs" label="Painel de plugues (a outra incógnita, até 10 pares)" value={form.plugs} onChange={(v) => set('plugs', v.toUpperCase())} hint='Exemplo: "AV BS CG".' inputMode="text" maxLength={40} />
        {cfgError && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {cfgError}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => setForm(randomForm())}>
            Sortear configuração do dia (aleatório seguro)
          </button>
          <button type="button" className={buttonClass} onClick={() => setForm(DEFAULT_FORM)}>
            Usar a configuração do exemplo
          </button>
        </div>
        <div>
          <label htmlFor="bb-text" className="mb-1 block text-base font-semibold">
            Mensagem de Alice
          </label>
          <textarea id="bb-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-describedby="bb-text-hint" className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
          <p id="bb-text-hint" className="mt-1 text-base text-muted">
            Normalizada em letras de A a Z (de 20 a {MAX_LETTERS} letras). Mensagens mais longas ajudam Eva a completar o painel de plugues.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="bb-crib" label="Texto provável de Eva (crib)" value={crib} onChange={(v) => setCrib(v.toUpperCase())} hint="Experimente RELATORIODOTEMPO (com laços) e RELATORIO (sem laços)." inputMode="text" maxLength={30} />
          <div>
            <label htmlFor="bb-cribpos" className="mb-1 block text-base font-semibold">
              Tecla em que o texto provável começa
            </label>
            <input id="bb-cribpos" type="number" min={1} value={cribPos} onChange={(e) => setCribPos(Number(e.target.value))} className="min-h-11 w-28 rounded-lg border border-line bg-surface px-3 text-lg" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setCrib('RELATORIODOTEMPO');
              setCribPos(1);
            }}
          >
            Texto provável com laços
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setCrib('RELATORIO');
              setCribPos(1);
            }}
          >
            Texto provável sem laços
          </button>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {error}
          </p>
        )}
        <p aria-live="polite" className="text-base text-muted">
          {stale && !dCfgError ? 'Eva está operando a Bombe…' : ''}
        </p>
      </LabSection>

      <LabSection id="bb-viz" title="4. Visualização animada">
        {run && !dCfgError ? (
          <div className="space-y-6">
            {definition && <ProtocolPlayer definition={definition} resetKey={`${run.flow.configText}|${run.cipherLetters}|${run.flow.crib}|${run.flow.cribPosition}`} />}
            <Inspector key={`${run.cipherLetters}|${run.flow.crib}|${run.flow.cribPosition}`} run={run} />
          </div>
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>

      {run && (
        <>
          <LabSection id="bb-eva" title="5. Criptoanálise de Eva">
            <div className="space-y-6">
              <section aria-labelledby="bb-eva-1" className="space-y-3">
                <h3 id="bb-eva-1" className="text-xl font-bold">
                  5.1 O menu
                </h3>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Letras no menu', String(run.flow.menuLetters)],
                    ['Componentes conexos', String(run.flow.menuComponents)],
                    ['Laços', String(run.flow.menuLoops)],
                    ['Letra de teste', run.flow.testLetter],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-line bg-surface p-3">
                      <dt className="text-base text-muted">{k}</dt>
                      <dd className="font-mono text-xl font-bold">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-base">
                    <caption className="mb-1 text-left text-base text-muted">Ligações do menu (uma por tecla do texto provável)</caption>
                    <thead>
                      <tr className="border-b border-line">
                        <th scope="col" className="py-1 pr-4">Tecla</th>
                        <th scope="col" className="py-1 pr-4">Letra clara suposta</th>
                        <th scope="col" className="py-1">Letra cifrada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.attack.edges.map((e) => (
                        <tr key={e.step} className="border-b border-line font-mono">
                          <td className="py-1 pr-4">{e.step}</td>
                          <td className="py-1 pr-4">{e.plain}</td>
                          <td className="py-1">{e.cipher}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-lg">
                  Laços são ciclos do grafo (arestas − letras + componentes). Cada laço oferece uma verificação a mais para a propagação: com poucos laços, muitas posições falsas escapam da contradição.
                </p>
              </section>

              <section aria-labelledby="bb-eva-2" className="space-y-3">
                <h3 id="bb-eva-2" className="text-xl font-bold">
                  5.2 A busca nas posições iniciais
                </h3>
                <p role="status" className="rounded-xl border-2 border-line bg-surface p-4 text-lg font-semibold">
                  {run.flow.tested.toLocaleString('pt-BR')} posições testadas, {run.flow.rejected.toLocaleString('pt-BR')} eliminadas por contradição; sobraram{' '}
                  {run.flow.stops.toLocaleString('pt-BR')} {run.flow.stops === 1 ? 'parada' : 'paradas'}.
                </p>
                <p className="text-lg">
                  Custo: {run.flow.tested.toLocaleString('pt-BR')} posições × 26 hipóteses = {(run.flow.tested * 26).toLocaleString('pt-BR')} propagações, para uma ordem de rotores. A força bruta sobre o
                  espaço de chaves sem os anéis exigiria testar {bigText(space.withoutRings)} configurações.
                </p>
                {run.attack.verified.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-base">
                      <caption className="mb-1 text-left text-base text-muted">Paradas verificadas por Eva, da mais para a menos legível</caption>
                      <thead>
                        <tr className="border-b border-line">
                          <th scope="col" className="py-1 pr-4">Posições</th>
                          <th scope="col" className="py-1 pr-4">Plugues deduzidos pela Bombe</th>
                          <th scope="col" className="py-1 pr-4">Legibilidade</th>
                          <th scope="col" className="py-1">Início do texto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {run.attack.verified.slice(0, 8).map((v, i) => (
                          <tr key={v.stop.positions} className={`border-b border-line ${i === 0 ? 'font-bold' : ''}`}>
                            <td className="py-1 pr-4 font-mono">{v.stop.positions}</td>
                            <td className="py-1 pr-4 font-mono">{v.stop.pairs.join(' ') || '(nenhum)'}</td>
                            <td className="py-1 pr-4 font-mono">{v.completion.readability.toFixed(2).replace('.', ',')}</td>
                            <td className="py-1 font-mono">{v.completion.plaintext.slice(0, 24)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {run.flow.level === 'total' ? (
                  <p role="status" className="rounded-xl border-2 border-danger bg-danger/10 p-4 text-lg font-semibold text-danger">
                    {run.flow.verdictText}
                  </p>
                ) : (
                  <Callout variant={run.flow.level === 'muitas-paradas' ? 'danger' : 'info'} title={run.flow.level === 'muitas-paradas' ? 'Paradas falsas demais' : 'Resultado do ataque'}>
                    <p>{run.flow.verdictText}</p>
                  </Callout>
                )}
              </section>
            </div>
          </LabSection>

          <LabSection id="bb-results" title="6. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultados da Bombe</caption>
                <tbody>
                  <Row label="Configuração do dia" value={run.flow.configText} />
                  <Row label="Plugues" value={form.plugs || '(nenhum)'} mono />
                  <Row label="Texto cifrado" value={run.flow.cipherText} mono />
                  <Row label="Texto provável" value={`"${run.flow.crib}" na tecla ${run.flow.cribPosition}`} />
                  <Row label="Laços do menu" value={String(run.flow.menuLoops)} />
                  <Row label="Paradas" value={run.flow.stops.toLocaleString('pt-BR')} />
                  <Row label="Posição verdadeira entre as paradas" value={run.flow.trueStopPresent ? 'sim' : 'não'} />
                  {run.flow.chosenPositions && <Row label="Posições escolhidas por Eva" value={run.flow.chosenPositions} mono />}
                  {run.flow.chosenPlugs && <Row label="Plugues deduzidos" value={run.flow.chosenPlugs} mono />}
                  {run.flow.deducedText && <Row label="Texto deduzido por Eva" value={run.flow.deducedText} mono />}
                  <Row label="Mensagem recuperada por Bob" value={run.flow.recovered} mono />
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Eva leu a mensagem?</th>
                    <td className={`py-2 font-semibold ${run.flow.level === 'total' ? 'text-danger' : 'text-k-secret'}`}>
                      {run.flow.level === 'total' ? `Sim: ${run.flow.pct.toFixed(0)}% do texto` : run.flow.level === 'muitas-paradas' ? 'Não: paradas falsas demais para verificar' : run.flow.level === 'nenhuma-parada' ? 'Não: nenhuma parada' : `Não: ${run.flow.pct.toFixed(0)}% do texto`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </LabSection>
        </>
      )}

      <LabSection id="bb-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={BOMBE_QUESTIONS} />
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
