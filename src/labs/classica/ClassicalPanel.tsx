import { useEffect, useMemo, useState } from 'react';
import { AlphabetStrip, CipherDisk } from '../../animations/CipherDisk';
import { FrequencyChart } from '../../animations/FrequencyChart';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { ALPHABET, letterPercentages, mapLetter, PT_FREQUENCY, VALID_A, type ClassicalCipher, type ClassicalKey } from '../../crypto/classical';
import { engines } from '../../crypto/engines';
import { Callout, Field, LabSection, buttonClass } from '../../components/ui';
import { buildClassicalProtocol } from './flows';
import { MAX_LETTERS, runClassical, type ClassicalRun } from './run';

const DEFAULT_TEXT = 'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma';

function parseInt0(text: string, label: string, max: number): { value: number | null; error: string | null } {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return { value: null, error: `${label} deve ser um inteiro entre 0 e ${max}.` };
  const v = Number(t);
  return v > max ? { value: null, error: `${label} deve estar entre 0 e ${max}.` } : { value: v, error: null };
}

const fmt = (n: number) => n.toFixed(1).replace('.', ',');

/** Cifra letra a letra: o estudante confirma cada letra e vê a conta. */
function LetterStepper({ run, cipher, index, onIndex }: { run: ClassicalRun; cipher: ClassicalCipher; index: number | null; onIndex: (i: number | null) => void }) {
  const n = run.plainLetters.length;
  const i = index;
  const { key } = run;
  const p = i === null ? 0 : ALPHABET.indexOf(run.plainLetters[i]);
  const raw = key.a * p + key.b;
  const c = mapLetter(key, p);
  const conta =
    cipher === 'cesar'
      ? `C = (${p} + ${key.b}) mod 26 = ${raw} mod 26 = ${c}`
      : `C = (${key.a} · ${p} + ${key.b}) mod 26 = ${raw} mod 26 = ${c}`;
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-xl font-bold">Cifrar letra a letra</h3>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonClass} disabled={i === null || i === 0} onClick={() => onIndex(i === null || i <= 0 ? null : i - 1)}>
          ← Letra anterior
        </button>
        <button type="button" className={buttonClass} disabled={i !== null && i >= n - 1} onClick={() => onIndex(i === null ? 0 : Math.min(n - 1, i + 1))}>
          {i === null ? 'Começar pela primeira letra' : 'Próxima letra →'}
        </button>
      </div>
      <p aria-live="polite" className="text-lg">
        {i === null ? (
          <>Use os botões para ver a conta de cada letra. O disco e a tira de alfabeto destacam a letra atual.</>
        ) : (
          <>
            Letra {i + 1} de {n}: <span className="font-mono font-bold">{run.plainLetters[i]}</span> = {p}. <span className="font-mono">{conta}</span> →{' '}
            <span className="font-mono font-bold">{ALPHABET[c]}</span>
          </>
        )}
      </p>
      <p className="break-all font-mono text-base text-muted">
        Cifra até aqui: {i === null ? '(vazia)' : run.cipherLetters.slice(0, i + 1)}
      </p>
    </div>
  );
}

export function ClassicalPanel({ cipher }: { cipher: ClassicalCipher }) {
  const caesar = cipher === 'cesar';
  const [kText, setK] = useState('3');
  const [aText, setA] = useState('5');
  const [bText, setB] = useState('8');
  const [text, setText] = useState(DEFAULT_TEXT);
  const [tamper, setTamper] = useState(false);
  const [letter, setLetter] = useState<number | null>(null);
  const [run, setRun] = useState<ClassicalRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kP = parseInt0(kText, 'k', 25);
  const bP = parseInt0(bText, 'b', 25);
  const a = Number(aText);
  const keyError = caesar ? kP.error : bP.error;
  const key: ClassicalKey | null = caesar ? (kP.value === null ? null : { a: 1, b: kP.value }) : bP.value === null ? null : { a, b: bP.value };

  useEffect(() => {
    if (!key) {
      setRun(null);
      return;
    }
    let cancelled = false;
    runClassical(engines.classical, { cipher, key, text, tamper })
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
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cipher, kText, aText, bText, text, tamper]);

  const definition = useMemo(() => (run ? buildClassicalProtocol(run.flow) : null), [run]);
  const highlight = letter !== null && run ? ALPHABET.indexOf(run.plainLetters[letter]) : null;
  const observed = useMemo(() => (run ? letterPercentages(run.cipherLetters) : null), [run]);
  const rows = run ? (caesar ? [...run.candidates].sort((x, y) => x.key.b - y.key.b) : run.candidates.slice(0, 8)) : [];

  return (
    <>
      <Callout variant="danger" title={`A cifra ${caesar ? 'de César' : 'afim'} é uma cifra clássica: não oferece segurança`}>
        <p>
          Ela existe para ensinar substituição e criptoanálise. Com apenas {caesar ? '26' : '312'} chaves possíveis, Eva a quebra por força bruta em um instante, e mesmo uma cifra com
          muitas chaves cairia diante da análise de frequência das letras.
        </p>
      </Callout>

      <LabSection id="cl-params" title="3. Parâmetros configuráveis">
        <div className="grid gap-4 sm:grid-cols-3">
          {caesar ? (
            <Field id="cl-k" label="Deslocamento k" value={kText} onChange={setK} error={kP.error} hint="Inteiro de 0 a 25 (k = 13 é o ROT13)." />
          ) : (
            <>
              <div>
                <label htmlFor="cl-a" className="mb-1 block text-base font-semibold">
                  Multiplicador a
                </label>
                <select id="cl-a" value={aText} onChange={(e) => setA(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 font-mono text-lg">
                  {VALID_A.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-base text-muted">Somente valores com mdc(a, 26) = 1: são 12.</p>
              </div>
              <Field id="cl-b" label="Deslocamento b" value={bText} onChange={setB} error={bP.error} hint="Inteiro de 0 a 25." />
            </>
          )}
        </div>
        <div>
          <label htmlFor="cl-text" className="mb-1 block text-base font-semibold">
            Mensagem de Alice
          </label>
          <textarea
            id="cl-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            aria-describedby="cl-text-hint"
            className="w-full rounded-lg border border-line bg-surface p-3 text-lg"
          />
          <p id="cl-text-hint" className="mt-1 text-base text-muted">
            O texto é normalizado: maiúsculas, sem acentos, espaços ou pontuação (até {MAX_LETTERS} letras). Textos com menos de 25 letras dificultam a análise de frequência.
          </p>
        </div>
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
          Eva altera uma letra da cifra em trânsito
        </label>
        {(error || keyError) && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {error ?? keyError}
          </p>
        )}
      </LabSection>

      <LabSection id="cl-viz" title="4. Visualização animada">
        {run && key ? (
          <div className="space-y-6">
            <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
              {caesar ? <CipherDisk shift={key.b} highlight={highlight} /> : <div />}
              <div className="space-y-4">
                <AlphabetStrip cipherKey={key} highlight={highlight} />
                <LetterStepper run={run} cipher={cipher} index={letter} onIndex={setLetter} />
              </div>
            </div>
            {definition && <ProtocolPlayer definition={definition} resetKey={`${cipher}|${run.flow.keyText}|${run.cipherLetters}|${run.flow.tampered}`} />}
          </div>
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>

      {run && observed && (
        <>
          <LabSection id="cl-eva" title="5. Criptoanálise de Eva">
            <p className="text-lg">
              Eva conhece apenas o texto cifrado e sabe que a mensagem está em português. Ela usa dois fatos: o <strong>espaço de chaves é minúsculo</strong> ({run.flow.keyCount}{' '}
              chaves) e a <strong>frequência das letras sobrevive à cifra</strong>.
            </p>
            <FrequencyChart observed={observed} expected={PT_FREQUENCY} observedLabel="texto cifrado capturado por Eva" expectedLabel="língua portuguesa" />
            <p className="text-lg">
              {caesar
                ? `Observe que as barras cheias reproduzem o desenho das barras vazadas deslocado ${run.key.b} posições: o César apenas desloca o alfabeto. O A (a letra mais comum em português) aparece na cifra como ${ALPHABET[run.key.b]}.`
                : 'A substituição afim embaralha as letras, mas cada letra sempre vira a mesma outra: as alturas das barras continuam as mesmas, apenas em outras posições.'}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-base">
                <caption className="mb-2 text-left text-lg font-semibold">
                  {caesar ? 'Todas as 26 chaves testadas por Eva' : 'As 8 chaves mais prováveis entre as 312 testadas por Eva'}
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-3">Chave</th>
                    <th scope="col" className="py-2 pr-3">Texto candidato (início)</th>
                    <th scope="col" className="py-2">χ² (menor = mais parecido com português)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const best = c === run.candidates[0];
                    const real = c.key.a === run.key.a && c.key.b === run.key.b;
                    return (
                      <tr key={`${c.key.a}-${c.key.b}`} className={`border-b border-line align-top ${best ? 'bg-k-secret/15 font-semibold' : ''}`}>
                        <th scope="row" className="py-1 pr-3 font-mono font-normal">
                          {caesar ? `k = ${c.key.b}` : `a = ${c.key.a}, b = ${c.key.b}`}
                        </th>
                        <td className="py-1 pr-3 font-mono">{c.plaintext.slice(0, 32)}</td>
                        <td className="py-1">
                          {fmt(c.chi2)}
                          {best && ' (menor: chave mais provável)'}
                          {real && ' (chave real de Alice e Bob)'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Callout variant="info" title="Comparação do espaço de chaves">
              <p>
                {caesar ? '26' : '312'} chaves: Eva testa todas em milissegundos. O AES-128 tem 2<sup>128</sup> ≈ 3,4 × 10<sup>38</sup> chaves. Mas o tamanho do espaço de chaves não basta: a substituição
                simples, com 26! ≈ 4 × 10<sup>26</sup> chaves, ainda cai diante da análise de frequência (próximo laboratório).
              </p>
            </Callout>
          </LabSection>

          <LabSection id="cl-results" title="6. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultados da cifragem e da criptoanálise</caption>
                <tbody>
                  <Row label="Chave de Alice e Bob" value={run.flow.keyText} />
                  <Row label="Texto claro (normalizado)" value={run.flow.plain} mono />
                  <Row label="Texto cifrado" value={run.flow.cipherText} mono />
                  {run.flow.tampered && <Row label="Cifra recebida por Bob (alterada por Eva)" value={run.flow.receivedText} mono />}
                  <Row label="Mensagem recuperada por Bob" value={run.flow.recovered} mono />
                  <Row label="Chave deduzida por Eva" value={run.flow.evaKeyText} />
                  <Row label="Texto deduzido por Eva" value={run.flow.evaPlain} mono />
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Eva quebrou a cifra?</th>
                    <td className={`py-2 font-semibold ${run.flow.evaSuccess ? 'text-danger' : 'text-k-cipher'}`}>
                      {run.flow.evaSuccess ? 'Sim, sem conhecer a chave' : 'Não nesta tentativa (texto curto), mas a cifra continua fraca'}
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
