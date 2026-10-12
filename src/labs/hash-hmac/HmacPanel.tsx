import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { engines } from '../../crypto/engines';
import { abbreviateHex, toHex, utf8Encode } from '../../crypto/encoding';
import { constantTimeEqual, HASH_ALGOS, HASH_INFO, type HashAlgo, type HmacTrace } from '../../crypto/hash';
import { Callout, LabSection } from '../../components/ui';
import { buildHmacProtocol, type HmacFlowData } from './flows';

interface Run {
  flow: HmacFlowData;
  trace: HmacTrace;
  matchesReference: boolean;
  plainHash: string;
}

export function HmacPanel() {
  const [algo, setAlgo] = useState<HashAlgo>('SHA-256');
  const [key, setKey] = useState('chave-secreta-compartilhada');
  const [message, setMessage] = useState('Transferir R$ 100,00 para Bob');
  const [tamper, setTamper] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);

  const keyError = key.length === 0 ? 'Informe uma chave: o HMAC exige uma chave secreta.' : null;

  useEffect(() => {
    if (keyError) {
      setRun(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const k = utf8Encode(key);
        const received = tamper ? `${message}!` : message;
        const sent = await engines.hash.hmac(algo, k, utf8Encode(message));
        const again = await engines.hash.hmac(algo, k, utf8Encode(received));
        const plain = await engines.hash.digest(algo, utf8Encode(message));
        if (cancelled) return;
        setRun({
          trace: sent.trace,
          matchesReference: sent.matchesReference && again.matchesReference,
          plainHash: toHex(plain),
          flow: {
            algo,
            keyText: key,
            keyBytes: k.length,
            blockBytes: sent.trace.block,
            keyWasHashed: sent.trace.keyWasHashed,
            message,
            receivedMessage: received,
            innerHex: toHex(sent.trace.inner),
            tagHex: toHex(sent.trace.tag),
            recomputedHex: toHex(again.trace.tag),
            tampered: tamper,
            ok: constantTimeEqual(sent.trace.tag, again.trace.tag),
          },
        });
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setRun(null);
          setError(e instanceof Error ? e.message : 'Falha ao calcular o HMAC.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [algo, key, message, tamper, keyError]);

  const definition = useMemo(() => (run ? buildHmacProtocol(run.flow) : null), [run]);
  const info = HASH_INFO[algo];

  return (
    <>
      <LabSection id="hmac-params" title="3. Parâmetros configuráveis">
        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <div>
            <label htmlFor="hmac-algo" className="mb-1 block text-base font-semibold">
              Função hash do HMAC
            </label>
            <select id="hmac-algo" value={algo} onChange={(e) => setAlgo(e.target.value as HashAlgo)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg">
              {HASH_ALGOS.map((a) => (
                <option key={a} value={a}>
                  HMAC-{HASH_INFO[a].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hmac-key" className="mb-1 block text-base font-semibold">
              Chave secreta compartilhada K
            </label>
            <input
              id="hmac-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              aria-invalid={keyError ? true : undefined}
              aria-describedby={keyError ? 'hmac-key-err' : undefined}
              className={`min-h-11 w-full rounded-lg border bg-surface px-3 font-mono text-lg ${keyError ? 'border-danger' : 'border-line'}`}
            />
            {keyError && (
              <p id="hmac-key-err" role="alert" className="mt-1 text-base font-semibold text-danger">
                {keyError}
              </p>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="hmac-msg" className="mb-1 block text-base font-semibold">
            Mensagem
          </label>
          <input id="hmac-msg" value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg" />
        </div>
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
          Adulterar a mensagem em trânsito (Eva, que não conhece a chave)
        </label>
        {info.legacy && (
          <Callout variant="warn" title="SHA-1 é legado">
            <p>O HMAC-SHA-1 ainda não é quebrado, mas é mantido apenas por compatibilidade. Prefira HMAC-SHA-256.</p>
          </Callout>
        )}
        {error && (
          <p role="alert" className="font-semibold text-danger">
            {error}
          </p>
        )}
      </LabSection>

      <LabSection id="hmac-viz" title="4. Visualização animada">
        {definition && run ? (
          <ProtocolPlayer definition={definition} resetKey={`${run.flow.algo}|${run.flow.tagHex}|${run.flow.recomputedHex}|${run.flow.message}|${run.flow.tampered}`} />
        ) : (
          <p className="text-lg text-muted">Informe uma chave para iniciar a animação.</p>
        )}
      </LabSection>

      {run && (
        <>
          <LabSection id="hmac-math" title="5. Explicação matemática">
            <div className="space-y-3 rounded-xl border border-line bg-surface p-4 text-lg">
              <p>
                <span className="font-mono">HMAC(K, m) = H( (K&apos; ⊕ opad) ‖ H( (K&apos; ⊕ ipad) ‖ m ) )</span>
              </p>
              <ul className="list-disc space-y-1 pl-6 text-base">
                <li>
                  <span className="font-mono">H</span> é {info.label}, com bloco de <strong>{run.trace.block}</strong> bytes (B).
                </li>
                <li>
                  <span className="font-mono">K&apos;</span> é a chave ajustada ao bloco: {run.trace.keyWasHashed ? `como a chave excede ${run.trace.block} bytes, é substituída por H(K) e completada com zeros` : `a chave (${utf8Encode(key).length} bytes) é completada com zeros até ${run.trace.block} bytes`}.
                </li>
                <li>
                  <span className="font-mono">ipad</span> = 0x36 repetido B vezes; <span className="font-mono">opad</span> = 0x5c repetido B vezes; <span className="font-mono">⊕</span> é o XOR
                  bit a bit; <span className="font-mono">‖</span> é a concatenação.
                </li>
                <li>Referências: RFC 2104 e FIPS 198-1; vetores de teste na RFC 4231.</li>
              </ul>
            </div>
          </LabSection>

          <LabSection id="hmac-results" title="6. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Valores intermediários e resultado do HMAC</caption>
                <tbody>
                  <Row label="K' (primeiros bytes)" value={abbreviateHex(toHex(run.trace.keyPrime), 12)} />
                  <Row label="K' ⊕ ipad (primeiros bytes)" value={abbreviateHex(toHex(run.trace.ipadKey), 12)} />
                  <Row label="K' ⊕ opad (primeiros bytes)" value={abbreviateHex(toHex(run.trace.opadKey), 12)} />
                  <Row label="Hash interno" value={run.flow.innerHex} />
                  <Row label="HMAC (etiqueta)" value={run.flow.tagHex} />
                  <Row label="Hash simples H(m), sem chave" value={run.plainHash} />
                  <Row label="Conferência com a Web Crypto" value={run.matchesReference ? 'Idêntico ao HMAC nativo do navegador' : 'DIVERGENTE'} plain />
                </tbody>
              </table>
            </div>
            <Callout variant="info" title="Por que o hash simples não autentica">
              <p>
                O hash simples H(m) não depende de segredo: Eva, ao alterar a mensagem de Alice, também recalcula H da nova mensagem, e Bob não percebe. No HMAC, a etiqueta depende de
                K, que Eva não possui.
              </p>
            </Callout>
          </LabSection>
        </>
      )}
    </>
  );
}

function Row({ label, value, plain = false }: { label: string; value: string; plain?: boolean }) {
  return (
    <tr className="border-b border-line">
      <th scope="row" className="py-2 pr-4 font-semibold">
        {label}
      </th>
      <td className={`break-all py-2 ${plain ? '' : 'font-mono text-base'}`}>{value}</td>
    </tr>
  );
}
