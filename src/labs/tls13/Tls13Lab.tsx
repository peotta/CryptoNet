import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { engines } from '../../crypto/engines';
import type { TlsScenario } from '../../crypto/tls13';
import { Callout, Field, LabSection, ReviewQuestions, Tabs, buttonClass } from '../../components/ui';
import { useDebounced } from '../../hooks/useDebounced';
import { TLS_OBJECTIVES, TLS_QUESTIONS } from './content';
import { buildTlsProtocol, hex, MAX_MESSAGE, runTls, type TlsRun } from './flows';

const DEFAULT_MESSAGE = 'GET /saldo?conta=12345';

export default function Tls13Lab() {
  const [scenario, setScenario] = useState<TlsScenario>('normal');
  return (
    <div className="space-y-10">
      <LabSection id="tls-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {TLS_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="tls-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          O <em>Transport Layer Security</em> (TLS 1.3, RFC 8446) protege quase todo o tráfego da web. O handshake faz três coisas: <strong>acorda chaves</strong> (ECDHE), <strong>autentica o
          servidor</strong> (certificado e assinatura) e <strong>confirma tudo</strong> (Finished), usando uma só ida e volta. Depois, os dados da aplicação seguem em registros AES-GCM.
        </p>
        <p className="text-lg">
          Este laboratório reúne o que foi visto nos anteriores: o Diffie-Hellman (agora em curva elíptica), o HKDF, o HMAC, a assinatura digital e o AES-GCM. As operações são reais (Web Crypto) e
          o cronograma de chaves segue a seção 7.1 da RFC, conferido com os vetores da RFC 8448.
        </p>
        <Callout variant="info" title="Simplificações deste laboratório">
          <ul className="list-disc space-y-1 pl-6">
            <li>Mensagens com campos reduzidos (sem as extensões completas); os valores de hash da transcrição, portanto, diferem dos de uma conexão real.</li>
            <li>Um único grupo (P-256), uma única suíte (TLS_AES_128_GCM_SHA256) e um único registro por voo.</li>
            <li>O "certificado" é didático: nome e chave pública assinados por uma autoridade fictícia, sem formato X.509 nem revogação.</li>
            <li>Sem retomada de sessão, 0-RTT, autenticação do cliente ou renegociação.</li>
          </ul>
        </Callout>
        <Tabs
          label="Cenário"
          value={scenario}
          onChange={setScenario}
          tabs={[
            { id: 'normal', label: 'Handshake normal (Eva observa)' },
            { id: 'mitm', label: 'Eva no meio do caminho (homem do meio)' },
          ]}
        />
      </LabSection>

      <HandshakePanel key={scenario} scenario={scenario} />

      <LabSection id="tls-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={TLS_QUESTIONS} />
      </LabSection>
    </div>
  );
}

function HandshakePanel({ scenario }: { scenario: TlsScenario }) {
  const mitm = scenario === 'mitm';
  const [serverName, setServerName] = useState('banco.exemplo');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [verifies, setVerifies] = useState(true);
  const [seed, setSeed] = useState(0);
  const [run, setRun] = useState<TlsRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dName = useDebounced(serverName);
  const dMessage = useDebounced(message);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    runTls(engines.tls, { serverName: dName, message: dMessage, scenario, clientVerifies: verifies })
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setRun(null);
          setError(e instanceof Error ? e.message : 'Falha no handshake.');
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dName, dMessage, scenario, verifies, seed]);

  const definition = useMemo(() => (run ? buildTlsProtocol(run.hs) : null), [run]);
  const h = run?.hs;
  const stale = serverName !== dName || message !== dMessage || busy;
  const bytes = new TextEncoder().encode(message).length;

  return (
    <>
      <LabSection id="tls-params" title="3. Parâmetros configuráveis">
        <Field id="tls-name" label="Nome do servidor (que Alice quer alcançar)" value={serverName} onChange={setServerName} hint="O nome entra no certificado assinado pela autoridade certificadora." inputMode="text" maxLength={63} />
        <div>
          <label htmlFor="tls-msg" className="mb-1 block text-base font-semibold">
            Mensagem de aplicação de Alice
          </label>
          <textarea id="tls-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} aria-describedby="tls-msg-hint" className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
          <p id="tls-msg-hint" className="mt-1 text-base text-muted">
            Até {MAX_MESSAGE} bytes (UTF-8). A mensagem tem {bytes} {bytes === 1 ? 'byte' : 'bytes'}.
          </p>
        </div>
        {mitm && (
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" className="h-5 w-5" checked={verifies} onChange={(e) => setVerifies(e.target.checked)} />
            Alice verifica o certificado e o CertificateVerify (desmarque para simular um cliente mal configurado)
          </label>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => setSeed((s) => s + 1)}>
            Novo handshake (chaves efêmeras novas, aleatório seguro)
          </button>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {error}
          </p>
        )}
        <p aria-live="polite" className="text-base text-muted">
          {stale && !error ? 'Calculando o handshake…' : ''}
        </p>
      </LabSection>

      <LabSection id="tls-viz" title="4. Visualização animada">
        {run && definition && h ? <ProtocolPlayer definition={definition} resetKey={`${h.scenario}|${h.clientPub}|${h.responderPub}|${h.clientVerifies}`} /> : <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>}
      </LabSection>

      {run && h && (
        <>
          <LabSection id="tls-eva" title="5. O que Eva vê e o que ela não consegue">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <section aria-labelledby="tls-eva-seen" className="space-y-2 rounded-xl border border-line bg-surface p-4">
                  <h3 id="tls-eva-seen" className="text-xl font-bold">
                    Visível no canal
                  </h3>
                  <ul className="list-disc space-y-1 pl-6 text-base">
                    <li>Os valores aleatórios do ClientHello e do ServerHello.</li>
                    <li>As chaves públicas efêmeras: A = {hex(h.clientPub, 8)}, {mitm ? 'E (de Eva)' : 'B'} = {hex(h.responderPub, 8)}.</li>
                    <li>Registros cifrados, com o comprimento e o momento de cada um.</li>
                  </ul>
                </section>
                <section aria-labelledby="tls-eva-hidden" className="space-y-2 rounded-xl border border-line bg-surface p-4">
                  <h3 id="tls-eva-hidden" className="text-xl font-bold">
                    {mitm ? 'O que depende de autenticação' : 'Fora do alcance de Eva'}
                  </h3>
                  <ul className="list-disc space-y-1 pl-6 text-base">
                    {mitm ? (
                      <>
                        <li>Eva obteve o segredo ECDHE <em>com Alice</em>, pois ela mesma é uma ponta do ECDHE.</li>
                        <li>O certificado verdadeiro é público e ela o repetiu: {h.certificateValid ? 'válido' : 'inválido'}.</li>
                        <li>O CertificateVerify de Eva é {h.certVerifyValid ? 'válido' : 'INVÁLIDO'}: ela não tem a chave privada do servidor.</li>
                        <li>O Finished de Eva é {h.finishedValid ? 'válido' : 'inválido'}: prova conhecimento das chaves, e não identidade.</li>
                      </>
                    ) : (
                      <>
                        <li>As chaves privadas a e b e, portanto, o segredo ECDHE.</li>
                        <li>As chaves de tráfego e o conteúdo de todos os registros, inclusive o certificado.</li>
                        <li>A mensagem de Alice.</li>
                      </>
                    )}
                  </ul>
                </section>
              </div>
              {h.ok ? (
                <Callout variant="ok" title={mitm ? 'O ataque falha' : 'Eva não obtém nada'}>
                  <p>{run.verdictText}</p>
                </Callout>
              ) : (
                <p role="status" className="rounded-xl border-2 border-danger bg-danger/10 p-4 text-lg font-semibold text-danger">
                  Eva leu: "{h.received}". {run.verdictText}
                </p>
              )}
            </div>
          </LabSection>

          <LabSection id="tls-results" title="6. Painel de resultados: cronograma de chaves">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base">
                <caption className="mb-1 text-left text-base text-muted">
                  Cronograma de chaves do TLS 1.3 (RFC 8446, seção 7.1). Cada segredo é derivado do anterior por HKDF.
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-4">Segredo</th>
                    <th scope="col" className="py-2 pr-4">Como é obtido</th>
                    <th scope="col" className="py-2">Valor (hexadecimal)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Early Secret', 'HKDF-Extract(0, 0), sem chave pré-compartilhada', h.early],
                    ['derived', 'Derive-Secret(Early, "derived", "")', h.derivedEarly],
                    ['Segredo ECDHE', 'x(a · B), em P-256', h.sharedSecret],
                    ['Handshake Secret', 'HKDF-Extract(derived, ECDHE)', h.handshakeSecret],
                    ['c hs traffic', 'Derive-Secret(HS, "c hs traffic", H(CH..SH))', h.clientHs],
                    ['s hs traffic', 'Derive-Secret(HS, "s hs traffic", H(CH..SH))', h.serverHs],
                    ['Master Secret', 'HKDF-Extract(Derive-Secret(HS, "derived"), 0)', h.masterSecret],
                    ['c ap traffic', 'Derive-Secret(Master, "c ap traffic", H(CH..Finished))', h.clientAp],
                    ['s ap traffic', 'Derive-Secret(Master, "s ap traffic", H(CH..Finished))', h.serverAp],
                  ].map(([k, how, v]) => (
                    <tr key={k} className="border-b border-line align-top">
                      <th scope="row" className="py-1 pr-4 font-semibold">{k}</th>
                      <td className="py-1 pr-4">{how}</td>
                      <td className="break-all py-1 font-mono text-sm">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultado do handshake</caption>
                <tbody>
                  <Row label="Cenário" value={mitm ? 'Eva entre Alice e Bob' : 'Eva apenas observa'} />
                  <Row label="Nome do servidor" value={h.serverName} />
                  <Row label="Certificado verificado" value={mitm && !verifies ? 'não verificado' : h.certificateValid ? 'válido' : 'inválido'} />
                  <Row label="CertificateVerify" value={mitm && !verifies ? 'não verificado' : h.certVerifyValid ? 'válido' : 'inválido'} />
                  <Row label="Finished do servidor" value={h.finishedValid ? 'válido' : 'inválido'} />
                  <Row label="Handshake" value={h.aborted ? `interrompido: ${h.abortReason}` : 'concluído'} />
                  {h.appRecord && <Row label="Registro de aplicação (hex)" value={h.appRecord} mono />}
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Eva leu a mensagem?</th>
                    <td className={`py-2 font-semibold ${h.evaReads ? 'text-danger' : 'text-k-secret'}`}>{h.evaReads ? 'Sim' : 'Não'}</td>
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
