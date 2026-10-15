import { useEffect, useMemo, useState } from 'react';
import { MatrixView } from '../../animations/MatrixView';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { ALPHABET } from '../../crypto/classical';
import { determinant, isInvertibleMod26, type Matrix } from '../../crypto/hill';
import { engines } from '../../crypto/engines';
import { randomBigIntBelow } from '../../crypto/random';
import { Callout, LabSection, buttonClass } from '../../components/ui';
import { buildHillProtocol, matrixText, MAX_LETTERS, runHill, type HillRun } from './hill';

const EXAMPLES: Record<2 | 3, Matrix> = {
  2: [[3, 3], [2, 5]],
  3: [[6, 24, 1], [13, 16, 10], [20, 17, 15]],
};
const EXAMPLE_TEXT = 'Atacar a ponte ao amanhecer sem avisar ninguém pois a surpresa é a nossa melhor arma e a nossa melhor defesa';
const mod26 = (n: number) => ((n % 26) + 26) % 26;

function toStrings(m: Matrix): string[][] {
  return m.map((r) => r.map(String));
}

function parseMatrix(cells: string[][]): { matrix: Matrix | null; error: string | null } {
  const out: Matrix = [];
  for (let r = 0; r < cells.length; r++) {
    const row: number[] = [];
    for (let c = 0; c < cells.length; c++) {
      const t = cells[r][c].trim();
      if (!/^\d+$/.test(t) || Number(t) > 25) return { matrix: null, error: `O elemento da linha ${r + 1}, coluna ${c + 1} deve ser um inteiro entre 0 e 25.` };
      row.push(Number(t));
    }
    out.push(row);
  }
  if (!isInvertibleMod26(out)) {
    const det = mod26(determinant(out));
    return { matrix: null, error: `A matriz não é inversível módulo 26: o determinante é ${det} e deve ser coprimo com 26 (nem par, nem múltiplo de 13).` };
  }
  return { matrix: out, error: null };
}

/** Cifra bloco a bloco: mostra, linha por linha, a conta módulo 26. */
function BlockStepper({ run, index, onIndex }: { run: HillRun; index: number | null; onIndex: (i: number | null) => void }) {
  const n = run.key.length;
  const total = run.blocks.length;
  const b = index === null ? null : run.blocks[index];
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-xl font-bold">Cifrar bloco a bloco</h3>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonClass} disabled={index === null || index === 0} onClick={() => onIndex(index === null || index <= 0 ? null : index - 1)}>
          ← Bloco anterior
        </button>
        <button type="button" className={buttonClass} disabled={index !== null && index >= total - 1} onClick={() => onIndex(index === null ? 0 : Math.min(total - 1, index + 1))}>
          {index === null ? 'Começar pelo primeiro bloco' : 'Próximo bloco →'}
        </button>
      </div>
      <div aria-live="polite" className="text-lg">
        {b ? (
          <>
            <p>
              Bloco {index! + 1} de {total}: <span className="font-mono font-bold">{b.plain.map((v) => ALPHABET[v]).join('')}</span> = ({b.plain.join(', ')}). C = K · P (mod 26):
            </p>
            <ul className="mt-1 space-y-1 font-mono text-base">
              {run.key.map((row, r) => {
                const raw = row.reduce((s, v, i) => s + v * b.plain[i], 0);
                return (
                  <li key={r}>
                    linha {r + 1}: {row.map((v, i) => `${v}·${b.plain[i]}`).join(' + ')} = {raw}; {raw} mod 26 = {mod26(raw)} → <strong>{ALPHABET[mod26(raw)]}</strong>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p>Use os botões para ver a multiplicação da matriz-chave por cada bloco, linha por linha.</p>
        )}
      </div>
      <p className="break-all font-mono text-base text-muted">Cifra até aqui: {index === null ? '(vazia)' : run.blocks.slice(0, index + 1).map((x) => x.cipher.map((v) => ALPHABET[v]).join('')).join('')}</p>
      <p className="text-base text-muted">Cada letra do texto claro influencia as {n} letras do bloco cifrado (difusão).</p>
    </div>
  );
}

export function HillPanel() {
  const [size, setSize] = useState<2 | 3>(2);
  const [cells, setCells] = useState<string[][]>(toStrings(EXAMPLES[2]));
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [known, setKnown] = useState('24');
  const [tamper, setTamper] = useState(false);
  const [block, setBlock] = useState<number | null>(null);
  const [run, setRun] = useState<HillRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseMatrix(cells), [cells]);
  const knownError = /^\d+$/.test(known.trim()) ? null : 'Informe um número inteiro de letras conhecidas (0 ou mais).';

  useEffect(() => {
    if (!parsed.matrix || knownError) {
      setRun(null);
      return;
    }
    let cancelled = false;
    runHill(engines.classical, { key: parsed.matrix, text, knownLetters: Number(known), tamper })
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
          setBlock(null);
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
  }, [parsed, text, known, tamper, knownError]);

  const definition = useMemo(() => (run ? buildHillProtocol(run.flow) : null), [run]);

  function changeSize(n: 2 | 3) {
    setSize(n);
    setCells(toStrings(EXAMPLES[n]));
  }

  function randomMatrix() {
    for (let i = 0; i < 1000; i++) {
      const m = Array.from({ length: size }, () => Array.from({ length: size }, () => Number(randomBigIntBelow(26n))));
      if (isInvertibleMod26(m)) {
        setCells(toStrings(m));
        return;
      }
    }
  }

  const known2 = run ? run.flow.knownPlain : '';
  return (
    <>
      <Callout variant="danger" title="Cifra clássica: não oferece segurança">
        <p>A cifra de Hill é linear: conhecendo um pouco do texto claro, Eva resolve a chave com álgebra. Ela existe para ensinar aritmética de matrizes módulo 26.</p>
      </Callout>

      <LabSection id="hl-params" title="3. Parâmetros configuráveis">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <label htmlFor="hl-size" className="mb-1 block text-base font-semibold">
              Tamanho da matriz-chave
            </label>
            <select id="hl-size" value={size} onChange={(e) => changeSize(Number(e.target.value) as 2 | 3)} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-lg">
              <option value={2}>2 × 2 (blocos de 2 letras)</option>
              <option value={3}>3 × 3 (blocos de 3 letras)</option>
            </select>
          </div>
          <fieldset>
            <legend className="mb-1 text-base font-semibold">Matriz-chave K (inteiros de 0 a 25)</legend>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${size}, 4.5rem)` }}>
              {cells.map((row, r) =>
                row.map((v, c) => (
                  <input
                    key={`${r}-${c}`}
                    aria-label={`Elemento da linha ${r + 1}, coluna ${c + 1}`}
                    inputMode="numeric"
                    value={v}
                    maxLength={2}
                    onChange={(e) => setCells((prev) => prev.map((rr, ri) => (ri === r ? rr.map((cc, ci) => (ci === c ? e.target.value : cc)) : rr)))}
                    className="min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-center font-mono text-lg"
                  />
                )),
              )}
            </div>
          </fieldset>
        </div>
        {parsed.error && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {parsed.error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={randomMatrix}>
            Sortear matriz inversível (aleatório seguro)
          </button>
          <button type="button" className={buttonClass} onClick={() => setCells(toStrings(EXAMPLES[size]))}>
            Usar a matriz do exemplo
          </button>
        </div>
        <div>
          <label htmlFor="hl-text" className="mb-1 block text-base font-semibold">
            Mensagem de Alice
          </label>
          <textarea id="hl-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-describedby="hl-text-hint" className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
          <p id="hl-text-hint" className="mt-1 text-base text-muted">
            O texto é normalizado (maiúsculas, sem acentos, espaços ou pontuação; até {MAX_LETTERS} letras) e completado com X até um múltiplo de {size}.
          </p>
        </div>
        <div className="max-w-xs">
          <label htmlFor="hl-known" className="mb-1 block text-base font-semibold">
            Letras do início da mensagem que Eva conhece
          </label>
          <input
            id="hl-known"
            inputMode="numeric"
            value={known}
            onChange={(e) => setKnown(e.target.value)}
            aria-describedby="hl-known-hint"
            aria-invalid={knownError ? true : undefined}
            className={`min-h-11 w-full rounded-lg border bg-surface px-3 font-mono text-lg ${knownError ? 'border-danger' : 'border-line'}`}
          />
          <p id="hl-known-hint" className="mt-1 text-base text-muted">
            Por exemplo, um cabeçalho padronizado. Eva precisa de pelo menos {size * size} letras ({size} blocos) independentes.
          </p>
          {knownError && (
            <p role="alert" className="mt-1 text-base font-semibold text-danger">
              {knownError}
            </p>
          )}
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

      <LabSection id="hl-viz" title="4. Visualização animada">
        {run ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start gap-8 rounded-xl border border-line bg-surface p-4">
              <div>
                <p className="mb-1 text-base font-semibold">Chave K</p>
                <MatrixView matrix={run.key} label="Matriz-chave K" />
              </div>
              <div>
                <p className="mb-1 text-base font-semibold">Inversa K⁻¹ (módulo 26)</p>
                <MatrixView matrix={run.inverse} label="Inversa da matriz-chave" />
              </div>
              <p className="max-w-xs text-base text-muted">
                det K = {mod26(determinant(run.key))} (módulo 26), coprimo com 26. K⁻¹ = (det K)⁻¹ · adj(K).
              </p>
            </div>
            <BlockStepper run={run} index={block} onIndex={setBlock} />
            {definition && <ProtocolPlayer definition={definition} resetKey={`${run.flow.keyText}|${run.flow.cipherText}|${run.flow.tampered}|${run.flow.knownLetters}`} />}
          </div>
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>

      {run && (
        <>
          <LabSection id="hl-eva" title="5. Criptoanálise de Eva: texto claro conhecido">
            <div className="space-y-4">
              <p className="text-lg">
                Cada bloco satisfaz <span className="font-mono">C = K · P</span>. Se Eva conhece {run.key.length} blocos de texto claro <strong>independentes</strong>, ela monta P e C (blocos nas
                colunas) e resolve <span className="font-mono">K = C · P⁻¹</span> módulo 26: um sistema linear, sem nenhuma busca.
              </p>
              <p className="text-lg">
                Eva conhece {run.flow.knownLetters} letras do início: <span className="font-mono font-bold">{known2 || '(nenhuma)'}</span>.
              </p>
              {run.attack && run.system ? (
                <div className="space-y-3">
                  <p className="text-lg">
                    Ela usou os blocos {run.attack.usedBlocks.join(' e ')} (de {run.attack.totalBlocks} conhecidos), cuja matriz P é inversível módulo 26.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4">
                    <div>
                      <p className="mb-1 text-base font-semibold">C (cifra)</p>
                      <MatrixView matrix={run.system.C} label="Matriz C da cifra" />
                    </div>
                    <span aria-hidden="true" className="text-2xl">·</span>
                    <div>
                      <p className="mb-1 text-base font-semibold">P⁻¹ (inversa do texto claro)</p>
                      <MatrixView matrix={run.system.Pinv} label="Inversa da matriz P" />
                    </div>
                    <span aria-hidden="true" className="text-2xl">=</span>
                    <div>
                      <p className="mb-1 text-base font-semibold">K (chave de Eva)</p>
                      <MatrixView matrix={run.attack.key} label="Chave deduzida por Eva" />
                    </div>
                  </div>
                  <p role="status" className={`rounded-xl border-2 p-4 text-lg font-semibold ${run.flow.success ? 'border-danger bg-danger/10 text-danger' : 'border-k-cipher'}`}>
                    {run.flow.success ? `A chave de Eva é idêntica à de Alice e Bob: ${matrixText(run.attack.key)}.` : 'A chave de Eva difere da real.'}
                  </p>
                </div>
              ) : (
                <p role="status" className="rounded-xl border-2 border-k-cipher bg-k-cipher/10 p-4 text-lg font-semibold">
                  {run.flow.failureReason}.
                </p>
              )}
              <Callout variant="info" title="Por que às vezes são necessárias mais letras">
                <p>
                  Os blocos conhecidos precisam formar uma matriz P inversível módulo 26. Dependendo das letras, o determinante pode ser par ou múltiplo de 13, e P não tem inversa (por exemplo,
                  blocos repetidos). Experimente reduzir as letras conhecidas até o mínimo e acompanhe quando o ataque falha.
                </p>
              </Callout>
            </div>
          </LabSection>

          <LabSection id="hl-results" title="6. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultados da cifragem e do ataque de Eva</caption>
                <tbody>
                  <Row label="Chave K" value={run.flow.keyText} mono />
                  <Row label="Inversa K⁻¹ (módulo 26)" value={run.flow.invText} mono />
                  <Row label="Texto cifrado" value={run.flow.cipherText} mono />
                  {run.flow.tampered && <Row label="Cifra recebida por Bob (alterada por Eva)" value={run.flow.receivedText} mono />}
                  <Row label="Mensagem recuperada por Bob" value={run.flow.recovered} mono />
                  <Row label="Chave deduzida por Eva" value={run.flow.attackKeyText ?? 'não obtida'} mono />
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Eva quebrou a cifra?</th>
                    <td className={`py-2 font-semibold ${run.flow.success ? 'text-danger' : 'text-k-cipher'}`}>
                      {run.flow.success ? 'Sim: a chave exata, com texto claro conhecido' : 'Não nesta tentativa (poucas letras conhecidas), mas a cifra continua fraca'}
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
