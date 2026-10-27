import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { engines } from '../../crypto/local/rc4';
import { utf8Encode } from '../../crypto/encoding';
import { randomBytes } from '../../crypto/random';
import { Callout, LabSection, Tabs, buttonClass } from '../../components/ui';
import { buildRc4Protocol, buildWepProtocol, MAX_BYTES, runRc4, runWep, type Rc4Run, type WepRun } from './flows';

const TEXT = 'PAGAR R$ 1000,00 PARA BOB';
const PAYLOAD = 'GET /saldo HTTP/1.1';

export function PartB() {
  const [scenario, setScenario] = useState<'sessao' | 'wep'>('sessao');
  return (
    <>
      <LabSection id="rc4-cenario" title="3. Parte B: Alice, Bob e Eva">
        <Tabs
          label="Cenário"
          value={scenario}
          onChange={setScenario}
          tabs={[
            { id: 'sessao', label: 'Cifra de fluxo com chave de sessão' },
            { id: 'wep', label: 'WEP: Eva recupera a chave (ataque FMS)' },
          ]}
        />
        {scenario === 'sessao' ? (
          <Callout variant="info" title="O que se espera">
            <p>
              Alice cifra com o RC4 e Bob decifra. Eva vê bytes sem padrão aparente. Marque a adulteração para ver que a cifra de fluxo não detecta alterações, e escolha descartar o início do fluxo para ver a
              defesa clássica contra os primeiros bytes enviesados.
            </p>
          </Callout>
        ) : (
          <Callout variant="danger" title="Um erro de uso que quebrou uma rede inteira">
            <p>
              O WEP monta a chave de cada quadro como IV (3 bytes, em claro) seguido da chave raiz. Eva escuta o rádio, colhe quadros com IV fracos e, por votação, descobre a chave raiz byte a byte, sem testar
              as 2^40 possibilidades.
            </p>
          </Callout>
        )}
      </LabSection>
      {scenario === 'sessao' ? <SessionPanel key="sessao" /> : <WepPanel key="wep" />}
    </>
  );
}

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

function useRun<T>(fn: () => Promise<T>, deps: unknown[]): { run: T | null; error: string | null } {
  const [run, setRun] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fn()
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setRun(null);
          setError(e instanceof Error ? e.message : 'Falha ao executar.');
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { run, error };
}

function TextInput({ id, label, text, onChange }: { id: string; label: string; text: string; onChange: (v: string) => void }) {
  const n = utf8Encode(text).length;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-semibold">
        {label}
      </label>
      <textarea id={id} value={text} onChange={(e) => onChange(e.target.value)} rows={2} aria-describedby={`${id}-hint`} className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
      <p id={`${id}-hint`} className="mt-1 text-base text-muted">
        Até {MAX_BYTES} bytes (UTF-8). O conteúdo tem {n} {n === 1 ? 'byte' : 'bytes'}.
      </p>
    </div>
  );
}

function SessionPanel() {
  const [text, setText] = useState(TEXT);
  const [drop, setDrop] = useState<0 | 256>(0);
  const [tamper, setTamper] = useState(false);
  const [tamperByte, setTamperByte] = useState(10);
  const [key, setKey] = useState(() => randomBytes(16));
  const { run, error } = useRun<Rc4Run>(() => runRc4(engines.rc4, { key, text, drop, tamper, tamperByte }), [key, text, drop, tamper, tamperByte]);
  const definition = useMemo(() => (run ? buildRc4Protocol(run.flow) : null), [run]);
  const n = utf8Encode(text).length;

  return (
    <>
      <LabSection id="rc4-params" title="4. Parâmetros configuráveis">
        <TextInput id="rc4-text" label="Mensagem de Alice" text={text} onChange={setText} />
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="rc4-drop" className="mb-1 block text-base font-semibold">
              Início do fluxo
            </label>
            <select id="rc4-drop" value={drop} onChange={(e) => setDrop(Number(e.target.value) as 0 | 256)} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-lg">
              <option value={0}>usar desde o primeiro byte (RC4 puro)</option>
              <option value={256}>descartar os 256 primeiros bytes (RC4-drop[256])</option>
            </select>
          </div>
          <button type="button" className={buttonClass} onClick={() => setKey(randomBytes(16))}>
            Sortear nova chave (aleatório seguro)
          </button>
        </div>
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
          Eva inverte um bit da cifra em trânsito
        </label>
        {tamper && (
          <div>
            <label htmlFor="rc4-byte" className="mb-1 block text-base font-semibold">
              Byte atingido (1 a {Math.max(1, n)})
            </label>
            <input id="rc4-byte" type="number" min={1} max={Math.max(1, n)} value={tamperByte} onChange={(e) => setTamperByte(Number(e.target.value))} className="min-h-11 w-28 rounded-lg border border-line bg-surface px-3 text-lg" />
          </div>
        )}
        {error && <Err>{error}</Err>}
      </LabSection>

      <LabSection id="rc4-viz" title="5. Visualização animada">
        {run && definition ? <ProtocolPlayer definition={definition} resetKey={`${run.flow.ctHex}|${run.flow.tampered}|${run.flow.tamperByte}|${run.flow.drop}`} /> : <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>}
      </LabSection>

      {run && (
        <LabSection id="rc4-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados da cifragem com RC4</caption>
              <tbody>
                <Row label="Chave (16 bytes)" value={run.flow.keyHex} mono />
                <Row label="Bytes descartados do fluxo" value={String(run.flow.drop)} />
                <Row label="Mensagem" value={run.flow.message} />
                <Row label="Fluxo de chaves (hex)" value={run.flow.ksHex} mono />
                <Row label="Cifra (hex)" value={run.flow.ctHex} mono />
                {run.flow.tampered && <Row label="Cifra recebida por Bob (alterada por Eva)" value={run.flow.receivedHex} mono />}
                <Row label="Mensagem recuperada por Bob" value={run.flow.recovered} />
                <tr>
                  <th scope="row" className="py-2 pr-4 font-semibold">Eva leu a mensagem?</th>
                  <td className="py-2 font-semibold text-k-secret">Não, sem a chave</td>
                </tr>
                <tr>
                  <th scope="row" className="py-2 pr-4 font-semibold">Eva alterou a mensagem?</th>
                  <td className={`py-2 font-semibold ${run.flow.tampered ? 'text-danger' : ''}`}>{run.flow.tampered ? `Sim: um bit do byte ${run.flow.tamperByte}, e Bob não percebeu` : 'Não nesta execução'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout variant={run.flow.ok ? 'info' : 'danger'} title="Leitura do resultado">
            <p>{run.flow.verdictText}</p>
          </Callout>
        </LabSection>
      )}
    </>
  );
}

function WepPanel() {
  const [payload, setPayload] = useState(PAYLOAD);
  const [material, setMaterial] = useState(() => ({ root: randomBytes(5), iv: randomBytes(3) }));
  const { run, error } = useRun<WepRun>(() => runWep(engines.rc4, { ...material, payload }), [material, payload]);
  const definition = useMemo(() => (run ? buildWepProtocol(run.flow) : null), [run]);
  const f = run?.flow;

  return (
    <>
      <LabSection id="rc4-params" title="4. Parâmetros configuráveis">
        <TextInput id="rc4-payload" label="Conteúdo do quadro de Alice (depois do cabeçalho AA AA 03 00 00 00)" text={payload} onChange={setPayload} />
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => setMaterial({ root: randomBytes(5), iv: randomBytes(3) })}>
            Sortear nova chave raiz e novo IV (aleatório seguro)
          </button>
        </div>
        {error && <Err>{error}</Err>}
      </LabSection>

      <LabSection id="rc4-viz" title="5. Visualização animada">
        {run && definition ? <ProtocolPlayer definition={definition} resetKey={`${run.flow.rootHex}|${run.flow.ivHex}`} /> : <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>}
      </LabSection>

      {f && (
        <>
          <LabSection id="rc4-eva" title="6. Criptoanálise de Eva">
            <div className="space-y-4">
              <p className="text-lg">
                Para cada byte da chave raiz, Eva conta votos entre os quadros com IV (B+3, 255, X). Só votam os quadros que satisfazem a condição de resolução (uma fração deles), e cerca de 5% dos IV fracos indicam
                o valor certo, enquanto os demais se espalham pelos outros 255 valores. O candidato certo se destaca.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-base">
                  <caption className="mb-1 text-left text-base text-muted">Votação byte a byte da chave raiz</caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="py-2 pr-4">Byte da chave</th>
                      <th scope="col" className="py-2 pr-4">Quadros</th>
                      <th scope="col" className="py-2 pr-4">Votantes</th>
                      <th scope="col" className="py-2 pr-4">Mais votado (hex)</th>
                      <th scope="col" className="py-2 pr-4">Votos</th>
                      <th scope="col" className="py-2 pr-4">Segundo (votos)</th>
                      <th scope="col" className="py-2">Confere com a chave real?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.bytes.map((b) => (
                      <tr key={b.index} className="border-b border-line">
                        <th scope="row" className="py-2 pr-4 font-semibold">{b.index + 1}</th>
                        <td className="py-2 pr-4">{b.packets}</td>
                        <td className="py-2 pr-4">{b.voters}</td>
                        <td className="py-2 pr-4 font-mono">{b.recovered.toString(16).padStart(2, '0')}</td>
                        <td className="py-2 pr-4">{b.votes}</td>
                        <td className="py-2 pr-4">{b.secondVotes}</td>
                        <td className={`py-2 font-semibold ${b.correct ? 'text-danger' : ''}`}>{b.correct ? 'Sim' : 'Não (precisou de combinações)'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {f.ok ? (
                <Callout variant="info" title="Resultado do ataque">
                  <p>{f.verdictText}</p>
                </Callout>
              ) : (
                <p role="status" className="rounded-xl border-2 border-danger bg-danger/10 p-4 text-lg font-semibold text-danger">
                  {f.verdictText}
                </p>
              )}
            </div>
          </LabSection>

          <LabSection id="rc4-results" title="7. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultados do ataque FMS contra o WEP</caption>
                <tbody>
                  <Row label="Chave raiz de Alice e Bob (40 bits)" value={f.rootHex} mono />
                  <Row label="IV do quadro de exemplo" value={f.ivHex} mono />
                  <Row label="Quadro cifrado (hex)" value={f.frameHex} mono />
                  <Row label="Quadros colhidos por Eva" value={f.nPackets.toLocaleString('pt-BR')} />
                  <Row label="Chave recuperada por Eva" value={f.recoveredHex} mono />
                  <Row label="Chaves testadas na conferência" value={f.tested.toLocaleString('pt-BR')} />
                  <Row label="Quadro lido por Eva" value={f.decrypted} />
                  <Row label="Espaço da busca exaustiva evitada" value="2^40 = 1.099.511.627.776 chaves" />
                </tbody>
              </table>
            </div>
          </LabSection>
        </>
      )}
    </>
  );
}
