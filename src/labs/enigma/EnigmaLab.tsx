import { useEffect, useMemo, useState } from 'react';
import { EnigmaViz } from '../../animations/EnigmaViz';
import { FrequencyChart } from '../../animations/FrequencyChart';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { ALPHABET, letterPercentages, PT_FREQUENCY } from '../../crypto/classical';
import { CryptoInputError } from '../../crypto/bigmath';
import { engines } from '../../crypto/engines';
import { ROTOR_NAMES, REFLECTOR_NAMES, validateConfig, type EnigmaConfig, type ReflectorName, type RotorName } from '../../crypto/enigma';
import { randomBigIntBelow } from '../../crypto/random';
import { IC_PORTUGUESE, IC_RANDOM } from '../../crypto/substitution';
import { Callout, Field, LabSection, ReviewQuestions, buttonClass } from '../../components/ui';
import { ENIGMA_OBJECTIVES, ENIGMA_QUESTIONS } from './content';
import { bigText, buildEnigmaProtocol, MAX_LETTERS, runEnigmaFlow, type EnigmaRun } from './flows';

const EXAMPLE_TEXT = 'Relatório do tempo sem novidades. Nada a reportar nesta madrugada. Mantenha a posição até nova ordem. Aguardamos a confirmação do comando no horário combinado';
const DEFAULT_PLUGS = 'AV BS CG DL FU HZ IN KM OW RX';
const num = (v: number, d = 4) => v.toFixed(d).replace('.', ',');

interface Form {
  left: RotorName;
  middle: RotorName;
  right: RotorName;
  reflector: ReflectorName;
  positions: string;
  rings: string;
  plugs: string;
}

const DEFAULT_FORM: Form = { left: 'I', middle: 'II', right: 'III', reflector: 'B', positions: 'KLM', rings: 'AAA', plugs: DEFAULT_PLUGS };
const CLASSIC_FORM: Form = { left: 'I', middle: 'II', right: 'III', reflector: 'B', positions: 'AAA', rings: 'AAA', plugs: '' };

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
  return { left, middle, right, reflector: rnd(2) ? 'B' : 'C', positions: randLetters(3), rings: randLetters(3), plugs };
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

function KeyStepper({ run, index, onIndex }: { run: EnigmaRun; index: number | null; onIndex: (i: number | null) => void }) {
  const n = run.encryption.trace.length;
  const t = index === null ? null : run.encryption.trace[index];
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-xl font-bold">Cifrar tecla a tecla</h3>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonClass} disabled={index === null || index === 0} onClick={() => onIndex(index === null || index <= 0 ? null : index - 1)}>
          ← Tecla anterior
        </button>
        <button type="button" className={buttonClass} disabled={index !== null && index >= n - 1} onClick={() => onIndex(index === null ? 0 : Math.min(n - 1, index + 1))}>
          {index === null ? 'Começar pela primeira tecla' : 'Próxima tecla →'}
        </button>
      </div>
      <p aria-live="polite" className="text-lg">
        {t ? (
          <>
            Tecla {index! + 1} de {n}: <span className="font-mono font-bold">{t.input}</span> → <span className="font-mono font-bold">{t.output}</span>. Rotores: <span className="font-mono">{t.before}</span> →{' '}
            <span className="font-mono">{t.after}</span>
            {t.stepped[0] ? ' (o rotor esquerdo avançou)' : ''}
            {t.stepped[1] ? ' (o rotor do meio avançou)' : ''}.
          </>
        ) : (
          'Use os botões para ver o sinal atravessar a máquina, uma tecla de cada vez.'
        )}
      </p>
      <p className="break-all font-mono text-base text-muted">Cifra até aqui: {index === null ? '(vazia)' : run.cipherLetters.slice(0, index + 1)}</p>
    </div>
  );
}

export default function EnigmaLab() {
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [crib, setCrib] = useState('RELATORIO');
  const [tamper, setTamper] = useState(false);
  const [key, setKey] = useState<number | null>(null);
  const [run, setRun] = useState<EnigmaRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cfgError = configProblem(form);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (cfgError) {
      setRun(null);
      return;
    }
    let cancelled = false;
    runEnigmaFlow(engines.classical, { config: toConfig(form), text, crib, tamper })
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
          setKey(null);
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
  }, [form, text, crib, tamper, cfgError]);

  const definition = useMemo(() => (run ? buildEnigmaProtocol(run.flow) : null), [run]);
  const trace = run && key !== null ? run.encryption.trace[key] : null;
  const percents = useMemo(() => (run ? letterPercentages(run.cipherLetters) : null), [run]);

  const years = (n: bigint) => {
    const perSecond = 1e9;
    const y = Number(n) / perSecond / (365.25 * 24 * 3600);
    return y >= 1e6 ? `${(y / 1e6).toFixed(1).replace('.', ',')} milhões de anos` : `${Math.round(y).toLocaleString('pt-BR')} anos`;
  };

  return (
    <div className="space-y-10">
      <LabSection id="en-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {ENIGMA_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="en-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          A Enigma foi a máquina de cifra elétrico-mecânica usada pelas forças armadas alemãs na Segunda Guerra Mundial. Cada tecla fecha um circuito que atravessa o <strong>painel de plugues</strong>,
          três <strong>rotores</strong>, o <strong>refletor</strong> e volta, acendendo a letra cifrada. Como os rotores giram a cada tecla, a mesma letra é cifrada de formas diferentes: é uma cifra
          polialfabética com período enorme.
        </p>
        <p className="text-lg">
          Duas propriedades definem a Enigma e foram decisivas para a sua quebra: ela é <strong>recíproca</strong> (cifrar e decifrar são a mesma operação) e <strong>nenhuma letra se cifra em si
          mesma</strong>.
        </p>
        <Callout variant="danger" title="Cifra histórica: não oferece segurança">
          <p>A Enigma foi quebrada durante a guerra. Aqui ela serve para estudar criptografia mecânica, a criptoanálise por texto provável e o valor do espaço de chaves.</p>
        </Callout>
      </LabSection>

      <LabSection id="en-params" title="3. Parâmetros configuráveis">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RotorSelect id="en-left" label="Rotor da esquerda" value={form.left} onChange={(v) => set('left', v)} />
          <RotorSelect id="en-middle" label="Rotor do meio" value={form.middle} onChange={(v) => set('middle', v)} />
          <RotorSelect id="en-right" label="Rotor da direita" value={form.right} onChange={(v) => set('right', v)} />
          <div>
            <label htmlFor="en-refl" className="mb-1 block text-base font-semibold">
              Refletor
            </label>
            <select id="en-refl" value={form.reflector} onChange={(e) => set('reflector', e.target.value as ReflectorName)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg">
              {REFLECTOR_NAMES.map((r) => (
                <option key={r} value={r}>
                  Refletor {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="en-pos" label="Posições iniciais (3 letras, esquerda para direita)" value={form.positions} onChange={(v) => set('positions', v.toUpperCase())} hint="As letras visíveis nas janelas." inputMode="text" maxLength={3} />
          <Field id="en-rings" label="Anéis (3 letras, esquerda para direita)" value={form.rings} onChange={(v) => set('rings', v.toUpperCase())} hint="Ringstellung: AAA equivale a não deslocar os anéis." inputMode="text" maxLength={3} />
        </div>
        <Field id="en-plugs" label="Painel de plugues (até 10 pares)" value={form.plugs} onChange={(v) => set('plugs', v.toUpperCase())} hint='Exemplo: "AV BS CG". Cada letra aparece em no máximo um par; vazio = sem plugues.' inputMode="text" maxLength={40} />
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
          <button type="button" className={buttonClass} onClick={() => setForm(CLASSIC_FORM)}>
            Configuração de verificação (I-II-III, B, AAA)
          </button>
        </div>
        <div>
          <label htmlFor="en-text" className="mb-1 block text-base font-semibold">
            Mensagem de Alice
          </label>
          <textarea id="en-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-describedby="en-text-hint" className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
          <p id="en-text-hint" className="mt-1 text-base text-muted">
            O texto é normalizado (maiúsculas, sem acentos, espaços ou pontuação; até {MAX_LETTERS} letras). Com a configuração de verificação, "AAAAA" vira "BDZGO".
          </p>
        </div>
        <Field id="en-crib" label="Texto provável de Eva (crib)" value={crib} onChange={(v) => setCrib(v.toUpperCase())} hint="Um trecho que Eva suspeita estar na mensagem, como um cabeçalho. Ao menos 3 letras." inputMode="text" maxLength={30} />
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

      <LabSection id="en-viz" title="4. Visualização animada">
        {run && !cfgError ? (
          <div className="space-y-6">
            <EnigmaViz config={run.config} trace={trace} />
            <KeyStepper run={run} index={key} onIndex={setKey} />
            {definition && <ProtocolPlayer definition={definition} resetKey={`${run.flow.configText}|${run.cipherLetters}|${run.flow.tampered}|${run.flow.crib}`} />}
          </div>
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>

      {run && percents && (
        <>
          <LabSection id="en-eva" title="5. Criptoanálise de Eva">
            <div className="space-y-6">
              <section aria-labelledby="en-eva-1" className="space-y-3">
                <h3 id="en-eva-1" className="text-xl font-bold">
                  5.1 O espaço de chaves
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-left text-lg">
                    <caption className="sr-only">Composição do espaço de chaves da Enigma I</caption>
                    <thead>
                      <tr className="border-b border-line">
                        <th scope="col" className="py-2 pr-4">Componente</th>
                        <th scope="col" className="py-2">Possibilidades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Ordem dos 3 rotores (de 5): 5 · 4 · 3', bigText(run.space.rotorOrders)],
                        ['Posições iniciais: 26³', bigText(run.space.positions)],
                        ['Painel de plugues com 10 pares', bigText(run.space.plugboard)],
                        ['Total (sem contar os anéis)', bigText(run.space.withoutRings)],
                        ['Anéis (o do rotor esquerdo é redundante): 26²', bigText(run.space.rings)],
                        ['Total com os anéis', bigText(run.space.withRings)],
                      ].map(([k, v]) => (
                        <tr key={k} className="border-b border-line">
                          <th scope="row" className="py-1 pr-4 font-semibold">{k}</th>
                          <td className="py-1 font-mono text-base">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-lg">
                  Testar todas as configurações (sem os anéis) a 1 bilhão por segundo levaria cerca de <strong>{years(run.space.withoutRings)}</strong>; com os anéis, cerca de{' '}
                  <strong>{years(run.space.withRings)}</strong>. Por isso a força bruta direta nunca foi o caminho.
                </p>
              </section>

              <section aria-labelledby="en-eva-2" className="space-y-3">
                <h3 id="en-eva-2" className="text-xl font-bold">
                  5.2 O que a estatística de letras mostra
                </h3>
                <p className="text-lg">Como os rotores giram, a mesma letra vira letras diferentes e o IC da cifra fica perto do aleatório.</p>
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
              </section>

              <section aria-labelledby="en-eva-3" className="space-y-3">
                <h3 id="en-eva-3" className="text-xl font-bold">
                  5.3 Texto provável e a fraqueza do refletor
                </h3>
                <p className="text-lg">
                  Eva alinha o texto provável <span className="font-mono font-bold">{run.flow.crib}</span> com a cifra em cada posição. Como a Enigma nunca cifra uma letra em si mesma, um
                  alinhamento em que uma letra do texto provável coincide com a cifrada na mesma posição é <strong>impossível</strong>.
                </p>
                <p role="status" className="rounded-xl border-2 border-line bg-surface p-4 text-lg font-semibold">
                  {run.flow.offsetsImpossible} de {run.flow.offsetsTotal} alinhamentos descartados; restam {run.flow.offsetsPossible}.
                </p>
                <div className="max-h-72 overflow-auto rounded-xl border border-line">
                  <table className="w-full min-w-[30rem] text-left text-base">
                    <caption className="sr-only">Alinhamentos do texto provável com a cifra</caption>
                    <thead className="sticky top-0 bg-surface2">
                      <tr className="border-b border-line">
                        <th scope="col" className="px-3 py-2">Posição</th>
                        <th scope="col" className="px-3 py-2">Situação</th>
                        <th scope="col" className="px-3 py-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.offsets.map((o) => (
                        <tr key={o.offset} className={`border-b border-line ${o.offset === run.flow.cribTrueOffset ? 'bg-k-secret/15 font-semibold' : ''}`}>
                          <th scope="row" className="px-3 py-1 font-mono font-normal">{o.offset + 1}</th>
                          <td className={`px-3 py-1 ${o.possible ? 'text-k-secret' : 'text-danger'}`}>{o.possible ? 'possível' : 'impossível'}</td>
                          <td className="px-3 py-1">
                            {o.possible
                              ? o.offset === run.flow.cribTrueOffset
                                ? 'posição real (Eva não sabe; só aparece aqui para estudo)'
                                : 'nenhuma letra coincide'
                              : `a letra ${o.conflictLetter} do texto provável coincide com a cifrada (letra ${o.conflictAt! + 1})`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-lg">A posição real nunca é descartada, mas muitas outras são. Com o texto provável alinhado, as Bombes de Turing testavam as configurações compatíveis.</p>
                <Callout variant="info" title="O que esta simulação não faz">
                  <p>
                    Eva aqui só elimina alinhamentos. A Bombe, que procurava a configuração testando as consequências do texto provável nos circuitos da máquina, não está implementada. Os erros dos
                    operadores (chaves repetidas, textos previsíveis como "nada a reportar") também foram decisivos na história.
                  </p>
                </Callout>
              </section>
            </div>
          </LabSection>

          <LabSection id="en-results" title="6. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultados da cifragem e da análise de Eva</caption>
                <tbody>
                  <Row label="Configuração do dia" value={run.flow.configText} />
                  <Row label="Plugues" value={form.plugs || '(nenhum)'} mono />
                  <Row label="Posições finais dos rotores" value={run.encryption.finalPositions} mono />
                  <Row label="Texto cifrado" value={run.flow.cipherText} mono />
                  {run.flow.tampered && <Row label="Cifra recebida por Bob (alterada por Eva)" value={run.flow.receivedText} mono />}
                  <Row label="Mensagem recuperada por Bob" value={run.flow.recovered} mono />
                  <Row label="Alinhamentos do texto provável descartados" value={`${run.flow.offsetsImpossible} de ${run.flow.offsetsTotal}`} />
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Eva leu a mensagem?</th>
                    <td className="py-2 font-semibold text-k-cipher">Não: apenas reduziu hipóteses; a configuração continua desconhecida</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </LabSection>
        </>
      )}

      <LabSection id="en-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={ENIGMA_QUESTIONS} />
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
