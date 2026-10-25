import { useEffect, useMemo, useState } from 'react';
import { CurvePlot } from '../../animations/CurvePlot';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { showPoint, TOY_CURVE as C, type RealSigAlgo } from '../../crypto/ecc';
import { engines } from '../../crypto/local/ecc';
import { Callout, Field, LabSection, Tabs, buttonClass } from '../../components/ui';
import { useDebounced } from '../../hooks/useDebounced';
import { buildEcdhProtocol, buildEcdsaProtocol, buildRealProtocol, runEcdh, runEcdsa, runRealSignature, type EcdhFlow, type EcdsaFlow, type RealFlow } from './flows';

const N = Number(C.n);
const asBig = (v: string): bigint | null => (/^\d{1,3}$/.test(v) ? BigInt(v) : null);
const keyErr = (v: string) => {
  const b = asBig(v);
  return b === null || b < 1n || b >= C.n ? `Use um inteiro de 1 a ${N - 1}.` : null;
};

function Err({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
      {children}
    </p>
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

// ---------------------------------------------------------------- ECDH
export function EcdhPanel() {
  const [a, setA] = useState('11');
  const [b, setB] = useState('7');
  const [run, setRun] = useState<EcdhFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const da = useDebounced(a);
  const db = useDebounced(b);
  const errA = keyErr(a);
  const errB = keyErr(b);

  useEffect(() => {
    if (keyErr(da) || keyErr(db)) {
      setRun(null);
      return;
    }
    let cancelled = false;
    runEcdh(engines.ecc, { a: asBig(da)!, b: asBig(db)! })
      .then((r) => !cancelled && (setRun(r), setError(null)))
      .catch((e: unknown) => !cancelled && (setRun(null), setError(e instanceof Error ? e.message : 'Falha no ECDH.')));
    return () => {
      cancelled = true;
    };
  }, [da, db]);

  const definition = useMemo(() => (run ? buildEcdhProtocol(run) : null), [run]);
  return (
    <>
      <LabSection id="ec-params" title="4. Parâmetros configuráveis">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ecdh-a" label={`Chave privada de Alice a (1 a ${N - 1})`} value={a} onChange={(v) => setA(v.trim())} error={errA} />
          <Field id="ecdh-b" label={`Chave privada de Bob b (1 a ${N - 1})`} value={b} onChange={(v) => setB(v.trim())} error={errB} />
        </div>
        {error && <Err>{error}</Err>}
      </LabSection>
      <LabSection id="ec-viz" title="5. Visualização animada">
        {run && definition ? (
          <div className="space-y-6">
            <ProtocolPlayer definition={definition} resetKey={`${run.a}|${run.b}`} />
            <CurvePlot
              curve={C}
              marks={[
                { point: C.G, label: 'G', tone: 'p' },
                { point: run.A, label: 'A', tone: 'q' },
                { point: run.B, label: 'B', tone: 'r' },
              ]}
            />
          </div>
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>
      {run && (
        <LabSection id="ec-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados do ECDH didático</caption>
              <tbody>
                <Row label="Curva" value={run.curveName} />
                <Row label="Chave pública de Alice A = a·G" value={showPoint(run.A)} mono />
                <Row label="Chave pública de Bob B = b·G" value={showPoint(run.B)} mono />
                <Row label="Ponto compartilhado a·B = b·A" value={showPoint(run.S)} mono />
                <Row label="Chave privada de Alice achada por Eva" value={`${run.evaA} (após ${run.tries} somas)`} />
                <Row label="Ponto calculado por Eva" value={showPoint(run.evaS)} mono />
                <tr>
                  <th scope="row" className="py-2 pr-4 font-semibold">Eva obteve o segredo?</th>
                  <td className={`py-2 font-semibold ${run.broken ? 'text-danger' : 'text-k-secret'}`}>{run.broken ? 'Sim: a curva é pequena demais' : 'Não'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout variant="danger" title="O que isto mostra">
            <p>{run.verdictText}</p>
          </Callout>
        </LabSection>
      )}
    </>
  );
}

// ---------------------------------------------------------------- ECDSA
export function EcdsaPanel() {
  const [reuse, setReuse] = useState(false);
  const [tamper, setTamper] = useState(false);
  const [d, setD] = useState('7');
  const [k, setK] = useState('9');
  const [m1, setM1] = useState('PAGAR R$ 100 A BOB');
  const [m2, setM2] = useState('PAGAR R$ 900 A BOB');
  const [run, setRun] = useState<EcdsaFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dd = useDebounced(d);
  const dk = useDebounced(k);
  const dm1 = useDebounced(m1);
  const dm2 = useDebounced(m2);
  const errD = keyErr(d);
  const errK = keyErr(k);

  useEffect(() => {
    if (keyErr(dd) || keyErr(dk)) {
      setRun(null);
      return;
    }
    let cancelled = false;
    runEcdsa(engines.ecc, { d: asBig(dd)!, k: asBig(dk)!, m1: dm1, m2: dm2, reuse, tamper })
      .then((r) => !cancelled && (setRun(r), setError(null)))
      .catch((e: unknown) => !cancelled && (setRun(null), setError(e instanceof Error ? e.message : 'Falha no ECDSA.')));
    return () => {
      cancelled = true;
    };
  }, [dd, dk, dm1, dm2, reuse, tamper]);

  const definition = useMemo(() => (run ? buildEcdsaProtocol(run) : null), [run]);
  return (
    <>
      <LabSection id="ec-params" title="4. Parâmetros configuráveis">
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={reuse} onChange={(e) => setReuse(e.target.checked)} />
          Alice reutiliza o mesmo nonce k em duas mensagens (erro)
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ecdsa-d" label={`Chave privada de Alice d (1 a ${N - 1})`} value={d} onChange={(v) => setD(v.trim())} error={errD} />
          <Field id="ecdsa-k" label={`Nonce k (1 a ${N - 1}; deve ser novo a cada assinatura)`} value={k} onChange={(v) => setK(v.trim())} error={errK} />
        </div>
        <div>
          <label htmlFor="ecdsa-m1" className="mb-1 block text-base font-semibold">
            Mensagem 1
          </label>
          <input id="ecdsa-m1" value={m1} onChange={(e) => setM1(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg" />
        </div>
        {reuse ? (
          <div>
            <label htmlFor="ecdsa-m2" className="mb-1 block text-base font-semibold">
              Mensagem 2
            </label>
            <input id="ecdsa-m2" value={m2} onChange={(e) => setM2(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg" />
          </div>
        ) : (
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
            Eva altera a mensagem em trânsito
          </label>
        )}
        {error && <Err>{error}</Err>}
      </LabSection>
      <LabSection id="ec-viz" title="5. Visualização animada">
        {run && definition ? <ProtocolPlayer definition={definition} resetKey={`${run.d}|${run.k}|${run.reuse}|${run.tamper}|${run.m1}|${run.m2}`} /> : <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>}
      </LabSection>
      {run && (
        <LabSection id="ec-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados do ECDSA didático</caption>
              <tbody>
                <Row label="Chave pública Q = d·G" value={showPoint(run.Q)} mono />
                <Row label="Assinatura da mensagem 1 (r, s)" value={`(${run.r}, ${run.s1}), com hash z = ${run.z1}`} mono />
                {run.reuse && <Row label="Assinatura da mensagem 2 (r, s)" value={`(${run.r}, ${run.s2}), com hash z = ${run.z2}`} mono />}
                {run.reuse && run.recovered && <Row label="Nonce e chave recuperados por Eva" value={`k = ${run.recovered.k}, d = ${run.recovered.d}`} mono />}
                {run.reuse && run.forged && <Row label={`Assinatura forjada de "${run.forgedMessage}"`} value={`(${run.forged.r}, ${run.forged.s}): Bob ${run.bobAcceptsForged ? 'aceita' : 'rejeita'}`} mono />}
                {!run.reuse && <Row label="Mensagem recebida por Bob" value={`"${run.received1}"`} />}
                {!run.reuse && <Row label="Verificação de Bob" value={run.bobAccepts1 ? 'assinatura válida' : 'assinatura inválida'} />}
                <tr>
                  <th scope="row" className="py-2 pr-4 font-semibold">Eva comprometeu a chave?</th>
                  <td className={`py-2 font-semibold ${run.reuse ? 'text-danger' : 'text-k-secret'}`}>{run.reuse ? 'Sim: a reutilização de k revelou d' : 'Não'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {run.ok ? (
            <Callout variant="ok" title="Resultado">
              <p>{run.verdictText}</p>
            </Callout>
          ) : (
            <p role="status" className="rounded-xl border-2 border-danger bg-danger/10 p-4 text-lg font-semibold text-danger">
              {run.verdictText}
            </p>
          )}
        </LabSection>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Assinaturas reais
const COMPARE = [
  ['Curva', 'NIST P-256 (Weierstrass)', 'Curve25519 (forma de Edwards)'],
  ['Chave pública', '65 bytes (ponto não comprimido)', '32 bytes'],
  ['Assinatura', '64 bytes (r, s)', '64 bytes (R, S)'],
  ['Nonce', 'k aleatório (ou determinístico, RFC 6979); repetir k revela a chave', 'derivado por hash da chave e da mensagem: determinístico'],
  ['Hash', 'SHA-256 sobre a mensagem', 'SHA-512 interno'],
  ['Uso típico', 'TLS, certificados X.509, WebAuthn', 'SSH, WireGuard (troca X25519), certificados modernos'],
];

export function RealPanel() {
  const [algo, setAlgo] = useState<RealSigAlgo>('ECDSA-P256');
  const [message, setMessage] = useState('Transferir R$ 100 para Bob');
  const [tamper, setTamper] = useState(false);
  const [seed, setSeed] = useState(0);
  const [run, setRun] = useState<RealFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dMessage = useDebounced(message);

  useEffect(() => {
    let cancelled = false;
    runRealSignature(engines.ecc, { algo, message: dMessage, tamper })
      .then((r) => !cancelled && (setRun(r), setError(null)))
      .catch((e: unknown) => !cancelled && (setRun(null), setError(e instanceof Error ? e.message : 'Falha na assinatura.')));
    return () => {
      cancelled = true;
    };
  }, [algo, dMessage, tamper, seed]);

  const definition = useMemo(() => (run ? buildRealProtocol(run) : null), [run]);
  return (
    <>
      <LabSection id="ec-params" title="4. Parâmetros configuráveis">
        <Tabs
          label="Algoritmo"
          value={algo}
          onChange={setAlgo}
          tabs={[
            { id: 'ECDSA-P256', label: 'ECDSA P-256' },
            { id: 'Ed25519', label: 'Ed25519' },
          ]}
        />
        <div>
          <label htmlFor="real-msg" className="mb-1 block text-base font-semibold">
            Mensagem de Alice
          </label>
          <input id="real-msg" value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg" />
        </div>
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
          Eva inverte um bit da mensagem em trânsito
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => setSeed((s) => s + 1)}>
            Novo par de chaves (aleatório seguro)
          </button>
        </div>
        {error && <Err>{error}</Err>}
      </LabSection>
      <LabSection id="ec-viz" title="5. Visualização animada">
        {run && definition ? <ProtocolPlayer definition={definition} resetKey={`${run.run.algo}|${run.run.publicHex}|${run.tamper}`} /> : <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>}
      </LabSection>
      {run && (
        <LabSection id="ec-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados da assinatura real</caption>
              <tbody>
                <Row label="Algoritmo" value={run.run.algo === 'Ed25519' ? 'Ed25519' : 'ECDSA P-256 com SHA-256'} />
                <Row label={`Chave pública (${run.run.publicBytes} bytes)`} value={run.run.publicHex} mono />
                <Row label={`Assinatura (${run.run.signatureBytes} bytes)`} value={run.run.signatureHex} mono />
                <Row label="Segunda assinatura da mesma mensagem" value={run.run.secondSignatureHex} mono />
                <Row label="As duas assinaturas são iguais?" value={run.run.deterministic ? 'Sim: assinatura determinística' : 'Não: o nonce aleatório muda a assinatura a cada vez'} />
                <Row label="Verificação de Bob" value={run.run.valid ? 'assinatura válida' : 'assinatura inválida'} />
              </tbody>
            </table>
          </div>
          <Callout variant="ok" title="Resultado">
            <p>{run.verdictText}</p>
          </Callout>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-base">
              <caption className="mb-1 text-left text-base text-muted">Comparação entre os dois algoritmos</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-4">Característica</th>
                  <th scope="col" className="py-2 pr-4">ECDSA P-256</th>
                  <th scope="col" className="py-2">Ed25519</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([k, x, y]) => (
                  <tr key={k} className="border-b border-line align-top">
                    <th scope="row" className="py-1 pr-4 font-semibold">{k}</th>
                    <td className="py-1 pr-4">{x}</td>
                    <td className="py-1">{y}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LabSection>
      )}
    </>
  );
}

