import { useEffect, useState } from 'react';
import { engines } from '../../crypto/engines';
import { toHex, utf8Encode } from '../../crypto/encoding';
import { bitDifference, HASH_ALGOS, HASH_INFO, type AvalancheStats, type BitDifference, type HashAlgo } from '../../crypto/hash';
import { Callout, LabSection, buttonClass } from '../../components/ui';

interface Result {
  hex1: string;
  hex2: string;
  diff: BitDifference;
}

const pct = (f: number) => `${(f * 100).toFixed(1).replace('.', ',')}%`;

/** Cada quadrado é um bit do resumo: preenchido = difere do outro resumo; vazado = igual. */
function BitGrid({ diff }: { diff: BitDifference }) {
  return (
    <div aria-hidden="true" className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(32, minmax(0, 1fr))' }}>
      {diff.mask.map((changed, i) => (
        <span key={i} className={`aspect-square rounded-[3px] border ${changed ? 'border-k-private bg-k-private' : 'border-line bg-transparent'}`} />
      ))}
    </div>
  );
}

export function HashPanel() {
  const [algo, setAlgo] = useState<HashAlgo>('SHA-256');
  const [t1, setT1] = useState('CryptoNet');
  const [t2, setT2] = useState('CryptoNeu');
  const [result, setResult] = useState<Result | null>(null);
  const [stats, setStats] = useState<AvalancheStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const b1 = utf8Encode(t1);
  const b2 = utf8Encode(t2);
  const inputDiff = bitDifference(b1, b2);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d1, d2] = await Promise.all([engines.hash.digest(algo, utf8Encode(t1)), engines.hash.digest(algo, utf8Encode(t2))]);
        if (!cancelled) {
          setResult({ hex1: toHex(d1), hex2: toHex(d2), diff: bitDifference(d1, d2) });
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao calcular o hash.');
      }
    })();
    setStats(null);
    return () => {
      cancelled = true;
    };
  }, [algo, t1, t2]);

  async function measure() {
    setBusy(true);
    try {
      setStats(await engines.hash.avalanche(algo, 100));
    } finally {
      setBusy(false);
    }
  }

  const info = HASH_INFO[algo];
  return (
    <>
      <LabSection id="hash-params" title="3. Parâmetros configuráveis">
        <div className="grid gap-4 md:grid-cols-[14rem_1fr_1fr]">
          <div>
            <label htmlFor="hash-algo" className="mb-1 block text-base font-semibold">
              Função hash
            </label>
            <select id="hash-algo" value={algo} onChange={(e) => setAlgo(e.target.value as HashAlgo)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg">
              {HASH_ALGOS.map((a) => (
                <option key={a} value={a}>
                  {HASH_INFO[a].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hash-t1" className="mb-1 block text-base font-semibold">
              Entrada A
            </label>
            <input id="hash-t1" value={t1} onChange={(e) => setT1(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 font-mono text-lg" />
          </div>
          <div>
            <label htmlFor="hash-t2" className="mb-1 block text-base font-semibold">
              Entrada B
            </label>
            <input id="hash-t2" value={t2} onChange={(e) => setT2(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 font-mono text-lg" />
          </div>
        </div>
        <p className="text-lg" aria-live="polite">
          As entradas diferem em <strong>{inputDiff.differing}</strong> {inputDiff.differing === 1 ? 'bit' : 'bits'} de {inputDiff.total}.{' '}
          O par inicial ("CryptoNet" e "CryptoNeu") difere em um único bit: t = 0x74 e u = 0x75.
        </p>
        {info.legacy && (
          <Callout variant="warn" title="SHA-1 é legado">
            <p>Colisões práticas do SHA-1 foram demonstradas em 2017 (ataque SHAttered). Não use SHA-1 em assinaturas ou em novas aplicações. Ele aparece aqui apenas para comparação.</p>
          </Callout>
        )}
        {error && (
          <p role="alert" className="font-semibold text-danger">
            {error}
          </p>
        )}
      </LabSection>

      {result && (
        <>
          <LabSection id="hash-viz" title="4. Visualização: efeito avalanche">
            <p className="text-lg">
              Cada quadrado representa um bit do resumo de {info.bits} bits. Quadrados <strong>preenchidos</strong> são bits diferentes entre o resumo de A e o de B; quadrados{' '}
              <strong>vazados</strong> são iguais.
            </p>
            <BitGrid diff={result.diff} />
            <p role="status" className="rounded-xl border-2 border-k-private bg-k-private/10 p-4 text-lg font-semibold">
              {result.diff.differing} de {result.diff.total} bits diferem ({pct(result.diff.differing / result.diff.total)}). Em uma boa função hash, o esperado é cerca de 50%.
            </p>
          </LabSection>

          <LabSection id="hash-math" title="5. Explicação matemática">
            <ul className="list-disc space-y-2 pl-6 text-lg">
              <li>
                Uma função hash criptográfica <span className="font-mono">H</span> mapeia entradas de tamanho arbitrário em um resumo de tamanho fixo ({info.bits} bits para{' '}
                {HASH_INFO[algo].label}).
              </li>
              <li>
                <strong>Determinismo:</strong> a mesma entrada sempre gera o mesmo resumo. Por isso o hash, sozinho, não tem sigilo nem autenticidade.
              </li>
              <li>
                <strong>Resistência à pré-imagem:</strong> dado <span className="font-mono">h</span>, é inviável achar <span className="font-mono">m</span> com{' '}
                <span className="font-mono">H(m) = h</span> (esforço da ordem de 2<sup>{info.bits}</sup>).
              </li>
              <li>
                <strong>Resistência a colisões:</strong> é inviável achar <span className="font-mono">m1 ≠ m2</span> com o mesmo resumo. Pelo paradoxo do aniversário, o esforço é da
                ordem de 2<sup>{info.bits / 2}</sup>.
              </li>
              <li>
                <strong>Efeito avalanche:</strong> trocar 1 bit da entrada altera cerca de metade dos bits do resumo.
              </li>
            </ul>
            <Callout variant="info" title="Hash não é cifragem">
              <p>Não existe &quot;decifrar&quot; um hash: a função descarta informação. Para guardar senhas, use funções de derivação lentas (Argon2, scrypt, PBKDF2), e não um hash simples.</p>
            </Callout>
          </LabSection>

          <LabSection id="hash-results" title="6. Painel de resultados">
            <dl className="space-y-3 text-base">
              <div>
                <dt className="font-semibold">
                  {info.label}(A), {info.bits} bits
                </dt>
                <dd className="break-all rounded-lg bg-surface2 p-3 font-mono text-lg">{result.hex1}</dd>
              </div>
              <div>
                <dt className="font-semibold">
                  {info.label}(B), {info.bits} bits
                </dt>
                <dd className="break-all rounded-lg bg-surface2 p-3 font-mono text-lg">{result.hex2}</dd>
              </div>
            </dl>
            <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
              <h3 className="text-xl font-bold">Medição estatística</h3>
              <p className="text-base">
                Gera 100 mensagens aleatórias de 32 bytes (Web Crypto), inverte um bit sorteado de cada uma e mede quantos bits do resumo mudam.
              </p>
              <button type="button" className={buttonClass} disabled={busy} onClick={measure}>
                {busy ? 'Medindo…' : 'Medir em 100 alterações de 1 bit'}
              </button>
              {stats && (
                <p role="status" className="text-lg">
                  Média: <strong>{pct(stats.meanFraction)}</strong> dos bits mudaram (mínimo {pct(stats.minFraction)}, máximo {pct(stats.maxFraction)}) em {stats.trials} execuções.
                </p>
              )}
            </div>
          </LabSection>
        </>
      )}
    </>
  );
}
