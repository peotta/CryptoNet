import { useEffect, useMemo, useState } from 'react';
import { Formula } from '../../animations/Formula';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { CryptoInputError, parseDecimal, primeFactors, modInverse } from '../../crypto/bigmath';
import { engines } from '../../crypto/local/rsa';
import { RSA_LIMITS, randomDidacticPrimes, suggestPublicExponent } from '../../crypto/rsaDidactic';
import { Callout, Field, LabSection, Tabs, buttonClass } from '../../components/ui';
import { buildRsaProtocol, type RsaScenario } from './flows';
import { runDidactic, type DidacticRun } from './run';

function tryParse(text: string, label: string, digits: number): { value: bigint | null; error: string | null } {
  try {
    return { value: parseDecimal(text, label, digits), error: null };
  } catch (e) {
    return { value: null, error: e instanceof CryptoInputError ? e.message : 'Valor inválido.' };
  }
}

export function DidacticPanel() {
  const [p, setP] = useState('61');
  const [q, setQ] = useState('53');
  const [e, setE] = useState('17');
  const [m, setM] = useState('65');
  const [scenario, setScenario] = useState<RsaScenario>('cifragem');
  const [tamper, setTamper] = useState(false);
  const [run, setRun] = useState<DidacticRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pp = tryParse(p, 'p', RSA_LIMITS.maxDigits);
  const qq = tryParse(q, 'q', RSA_LIMITS.maxDigits);
  const ee = tryParse(e, 'e', 13);
  const mm = tryParse(m, 'm', 13);
  const fieldErrors = { p: pp.error, q: qq.error, e: ee.error, m: mm.error };

  useEffect(() => {
    if (pp.value === null || qq.value === null || ee.value === null || mm.value === null) {
      setRun(null);
      setError(null);
      return;
    }
    let cancelled = false;
    runDidactic(engines.rsaDidactic, { p: pp.value, q: qq.value, e: ee.value, m: mm.value, scenario, tamper })
      .then((r) => {
        if (cancelled) return;
        setRun(r);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRun(null);
        setError(err instanceof CryptoInputError ? err.message : 'Não foi possível calcular com estes valores.');
      });
    return () => {
      cancelled = true;
    };
  }, [p, q, e, m, scenario, tamper]);

  const definition = useMemo(() => (run ? buildRsaProtocol(run.flow) : null), [run]);

  function randomize() {
    const r = randomDidacticPrimes();
    setP(r.p.toString());
    setQ(r.q.toString());
    const phi = (r.p - 1n) * (r.q - 1n);
    setE(suggestPublicExponent(phi).toString());
    setM('42');
  }

  function suggestE() {
    if (pp.value === null || qq.value === null) return;
    try {
      setE(suggestPublicExponent((pp.value - 1n) * (qq.value - 1n)).toString());
    } catch {
      /* p ou q inválidos: a mensagem de erro já aparece no formulário */
    }
  }

  return (
    <>
      <Callout variant="danger" title="RSA didático sem padding: inseguro para aplicações reais">
        <p>
          Este modo executa a matemática do RSA com <strong>BigInt</strong> e primos pequenos (até {RSA_LIMITS.maxPrime.toString()}). Não há padding, hash nem aleatoriedade.
          Nunca use esta construção para proteger dados. O modo real utiliza RSA-OAEP e RSA-PSS.
        </p>
      </Callout>

      <LabSection id="rsa-d-params" title="3. Parâmetros configuráveis">
        <Tabs
          label="Cenário"
          value={scenario}
          onChange={setScenario}
          tabs={[
            { id: 'cifragem', label: 'Cifragem e decifragem' },
            { id: 'assinatura', label: 'Assinatura digital' },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="rsa-p" label="Primo p" value={p} onChange={setP} error={fieldErrors.p} hint="Primo entre 3 e 1000003." />
          <Field id="rsa-q" label="Primo q" value={q} onChange={setQ} error={fieldErrors.q} hint="Primo distinto de p." />
          <Field id="rsa-e" label="Expoente público e" value={e} onChange={setE} error={fieldErrors.e} hint="1 < e < φ(n) e mdc(e, φ(n)) = 1." />
          <Field id="rsa-m" label="Mensagem m (inteiro)" value={m} onChange={setM} error={fieldErrors.m} hint="0 ≤ m < n." />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={buttonClass} onClick={randomize}>
            Sortear primos (aleatório seguro)
          </button>
          <button type="button" className={buttonClass} onClick={suggestE}>
            Sugerir e
          </button>
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(ev) => setTamper(ev.target.checked)} />
            {scenario === 'cifragem' ? 'Adulterar a cifra em trânsito (Eva)' : 'Adulterar a mensagem em trânsito (Eva)'}
          </label>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {error}
          </p>
        )}
        {run?.keys.warnings.map((w) => (
          <Callout key={w} variant="warn">
            <p>{w}</p>
          </Callout>
        ))}
      </LabSection>

      <LabSection id="rsa-d-viz" title="4. Visualização animada">
        {definition ? (
          <ProtocolPlayer definition={definition} resetKey={`${p}|${q}|${e}|${m}|${scenario}|${tamper}`} />
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros acima para iniciar a animação.</p>
        )}
      </LabSection>

      {run && (
        <>
          <LabSection id="rsa-d-math" title="5. Explicação matemática completa">
            <DidacticMath run={run} m={mm.value ?? 0n} />
          </LabSection>
          <LabSection id="rsa-d-results" title="6. Painel de resultados">
            <ResultTable run={run} scenario={scenario} />
            <FactoringDemo n={run.keys.n} e={run.keys.e} d={run.keys.d} />
          </LabSection>
        </>
      )}
    </>
  );
}

function DidacticMath({ run, m }: { run: DidacticRun; m: bigint }) {
  const { p, q, n, phi, e, d, euclid } = run.keys;
  const row = 'rounded-lg border border-line bg-surface p-3 text-lg';
  return (
    <ol className="space-y-3">
      <li className={row}>
        <strong>1. Primos escolhidos.</strong> <Formula tex={`p = ${p}`} />, <Formula tex={`q = ${q}`} />. Ambos primos e distintos.
      </li>
      <li className={row}>
        <strong>2. Módulo.</strong> <Formula tex={`n = p × q = ${p} × ${q} = ${n}`} />
      </li>
      <li className={row}>
        <strong>3. Função totiente de Euler.</strong> <Formula tex={`φ(n) = (p - 1)(q - 1) = ${p - 1n} × ${q - 1n} = ${phi}`} />
      </li>
      <li className={row}>
        <strong>4. Expoente público.</strong> <Formula tex={`1 < e = ${e} < φ(n)`} /> e <Formula tex={`mdc(${e}, ${phi}) = 1`} /> (coprimos).
      </li>
      <li className={row}>
        <strong>5. Expoente privado.</strong> <Formula tex={`d = e^{-1} mod φ(n) = ${d}`} />. Verificação:{' '}
        <Formula tex={`e × d = ${e} × ${d} = ${e * d} = ${e * d / phi} × ${phi} + ${(e * d) % phi}`} />, logo <Formula tex="e × d ≡ 1 (mod φ(n))" />.
        <details className="mt-2">
          <summary className="cursor-pointer text-base font-semibold text-accent">Ver o algoritmo de Euclides estendido</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[24rem] text-left font-mono text-base">
              <caption className="mb-1 text-left font-sans text-muted">Cada linha satisfaz r = s·φ(n) + t·e. Na última linha com r = 1, t é o inverso de e (módulo φ(n)).</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="pr-4">q</th>
                  <th scope="col" className="pr-4">r</th>
                  <th scope="col" className="pr-4">s</th>
                  <th scope="col">t</th>
                </tr>
              </thead>
              <tbody>
                {euclid.map((r, i) => (
                  <tr key={i} className="border-b border-line/50">
                    <td className="pr-4">{r.q === null ? '-' : r.q.toString()}</td>
                    <td className="pr-4">{r.r.toString()}</td>
                    <td className="pr-4">{r.s.toString()}</td>
                    <td>{r.t.toString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </li>
      <li className={row}>
        <strong>6. Chave pública.</strong> <Formula tex={`(n, e) = (${n}, ${e})`} />
      </li>
      <li className={row}>
        <strong>7. Chave privada.</strong> <Formula tex={`(n, d) = (${n}, ${d})`} />
      </li>
      <li className={row}>
        <strong>8. Cifragem.</strong> <Formula tex={`c = m^{e} mod n = ${m}^{${e}} mod ${n}`} />
        {run.c !== undefined && (
          <>
            {' '}
            = <strong>{run.c.toString()}</strong>
          </>
        )}
        . A exponenciação usa quadrados repetidos: cerca de log<sub>2</sub>(e) multiplicações modulares, e nunca calcula m^e por inteiro.
      </li>
      <li className={row}>
        <strong>9. Decifragem.</strong> <Formula tex="m = c^{d} mod n" />. Vale porque <Formula tex="c^{d} ≡ m^{e·d} ≡ m^{1 + k·φ(n)} ≡ m (mod n)" /> (Teorema de Euler, para mdc(m, n) = 1; o resultado também vale para os demais m pelo Teorema Chinês dos Restos).
      </li>
    </ol>
  );
}

function ResultTable({ run, scenario }: { run: DidacticRun; scenario: RsaScenario }) {
  const k = run.keys;
  const rows: [string, string][] = [
    ['p, q', `${k.p}, ${k.q}`],
    ['n', k.n.toString()],
    ['φ(n)', k.phi.toString()],
    ['e', k.e.toString()],
    ['d', k.d.toString()],
    ['Chave pública (n, e)', `(${k.n}, ${k.e})`],
    ['Chave privada (n, d)', `(${k.n}, ${k.d})`],
    ['Mensagem m', run.flow.message],
    [scenario === 'cifragem' ? 'Cifra c enviada' : 'Assinatura s', run.flow.payload],
    [scenario === 'cifragem' ? "Resultado da decifragem m'" : 'Verificação', run.flow.outcome],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-lg">
        <caption className="sr-only">Parâmetros e resultados do RSA didático</caption>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-line">
              <th scope="row" className="py-2 pr-4 font-semibold">{label}</th>
              <td className="break-all py-2 font-mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Mostra por que primos pequenos não protegem nada: n é fatorado em instantes e d é recomposto. */
function FactoringDemo({ n, e, d }: { n: bigint; e: bigint; d: bigint }) {
  const [result, setResult] = useState<string | null>(null);
  function attack() {
    const t0 = performance.now();
    const f = primeFactors(n);
    const ms = (performance.now() - t0).toFixed(2).replace('.', ',');
    if (f.length !== 2) {
      setResult('Fatoração inesperada.');
      return;
    }
    const dd = modInverse(e, (f[0] - 1n) * (f[1] - 1n));
    setResult(`Eva fatora n = ${n} em ${f[0]} × ${f[1]} (${ms} ms), recalcula φ(n) e obtém d = ${dd}${dd === d ? ', idêntico à chave privada de Bob' : ''}.`);
  }
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-xl font-bold">Por que primos pequenos não protegem nada</h3>
      <p className="text-base">A segurança do RSA vem da dificuldade de fatorar n. Aqui n é pequeno e a fatoração é instantânea.</p>
      <button type="button" className={buttonClass} onClick={attack}>
        Fatorar n como Eva
      </button>
      {result && (
        <p role="status" className="text-lg">
          {result}
        </p>
      )}
    </div>
  );
}
