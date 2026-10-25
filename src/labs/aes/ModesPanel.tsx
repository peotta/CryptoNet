import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { BLOCK, padWithSpaces, type AesMode } from '../../crypto/aes';
import { engines } from '../../crypto/local/aes';
import { utf8Encode } from '../../crypto/encoding';
import { randomBytes } from '../../crypto/random';
import { Callout, LabSection, Tabs, buttonClass } from '../../components/ui';
import { BlockViz } from './BlockViz';
import { buildAesProtocol } from './flows';
import { runAes, type AesRun } from './run';

const DEFAULT_TEXT = 'PAGAR R$ 1000,00PAGAR R$ 1000,00CONFIRMADO POR B';
const MAX_BYTES = 160;

const MODES: { id: AesMode; label: string }[] = [
  { id: 'ECB', label: 'ECB (inseguro)' },
  { id: 'CBC', label: 'CBC' },
  { id: 'CTR', label: 'CTR' },
  { id: 'GCM', label: 'GCM (autenticado)' },
];

const COMPARE: { mode: AesMode; patterns: string; integrity: string; note: string }[] = [
  { mode: 'ECB', patterns: 'Vazam (blocos iguais, cifras iguais)', integrity: 'Não', note: 'Não use. Serve apenas para fins didáticos.' },
  { mode: 'CBC', patterns: 'Não, com IV aleatório', integrity: 'Não (maleável no bloco seguinte)', note: 'Exige preenchimento e é vulnerável a oráculos de preenchimento se mal usado.' },
  { mode: 'CTR', patterns: 'Não, com nonce nunca repetido', integrity: 'Não (bit a bit maleável)', note: 'Cifra de fluxo; paralelizável. Reutilizar o nonce é desastroso.' },
  { mode: 'GCM', patterns: 'Não, com nonce nunca repetido', integrity: 'Sim (etiqueta de 128 bits)', note: 'Recomendado: criptografia autenticada (AEAD), usada no TLS 1.3.' },
];

/** Parte B: modos de operação com Alice, Bob e Eva. */
export function ModesPanel() {
  const [mode, setMode] = useState<AesMode>('ECB');
  const [keyBits, setKeyBits] = useState(128);
  const [text, setText] = useState(DEFAULT_TEXT);
  const [tamper, setTamper] = useState(false);
  const [tamperBlock, setTamperBlock] = useState(2);
  const [material, setMaterial] = useState(() => ({ key: randomBytes(32), iv: randomBytes(16) }));
  const [run, setRun] = useState<AesRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bytes = utf8Encode(text).length;
  const nBlocks = padWithSpaces(utf8Encode(text)).length / BLOCK;
  const tooLong = bytes > MAX_BYTES;
  const empty = text.length === 0;

  useEffect(() => {
    if (tooLong || empty) {
      setRun(null);
      return;
    }
    let cancelled = false;
    const key = material.key.slice(0, keyBits / 8);
    const iv = mode === 'ECB' ? null : mode === 'CBC' ? material.iv : material.iv.slice(0, 12);
    runAes(engines.aes, { mode, key, iv, text, tamper, tamperBlock })
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setRun(null);
          setError(e instanceof Error ? e.message : 'Falha na operação criptográfica.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, keyBits, text, tamper, tamperBlock, material, tooLong, empty]);

  const definition = useMemo(() => (run ? buildAesProtocol(run.flow) : null), [run]);

  return (
    <>
      <Callout variant="warn" title="Neste laboratório, ECB, CBC e CTR usam a implementação didática do AES">
        <p>
          A Web Crypto do navegador não oferece o ECB e não permite decifrar sem validar o preenchimento, então o núcleo do AES foi implementado aqui para o experimento e conferido
          contra a Web Crypto e o <em>node:crypto</em> nos testes. O <strong>AES-GCM</strong> usa diretamente a Web Crypto. Em aplicações reais, use sempre a biblioteca nativa.
        </p>
      </Callout>

      <LabSection id="aes-b-params" title="3. Parâmetros configuráveis">
        <Tabs label="Modo de operação" value={mode} onChange={setMode} tabs={MODES} />
        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <div>
            <label htmlFor="aes-bits" className="mb-1 block text-base font-semibold">
              Tamanho da chave
            </label>
            <select id="aes-bits" value={keyBits} onChange={(e) => setKeyBits(Number(e.target.value))} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg">
              {[128, 192, 256].map((b) => (
                <option key={b} value={b}>
                  AES-{b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="aes-text" className="mb-1 block text-base font-semibold">
              Mensagem de Alice
            </label>
            <input
              id="aes-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-describedby="aes-text-hint"
              aria-invalid={tooLong || empty ? true : undefined}
              className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 font-mono text-lg"
            />
            <p id="aes-text-hint" className={`mt-1 text-base ${tooLong || empty ? 'font-semibold text-danger' : 'text-muted'}`} role={tooLong || empty ? 'alert' : undefined}>
              {empty ? 'Digite uma mensagem. ' : ''}
              {bytes} bytes, {nBlocks} {nBlocks === 1 ? 'bloco' : 'blocos'} de 16 bytes (máximo {MAX_BYTES} bytes). O padrão tem dois blocos iguais, para revelar o vazamento do ECB.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
            Eva inverte 1 bit da cifra em trânsito
          </label>
          {tamper && (
            <label className="flex items-center gap-2 text-base">
              no bloco
              <select
                value={Math.min(tamperBlock, nBlocks)}
                onChange={(e) => setTamperBlock(Number(e.target.value))}
                className="min-h-11 rounded-lg border border-line bg-surface px-2 text-base"
              >
                {Array.from({ length: nBlocks }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className={buttonClass} onClick={() => setMaterial({ key: randomBytes(32), iv: randomBytes(16) })}>
            Nova chave e novo IV (aleatório seguro)
          </button>
        </div>
        {error && (
          <p role="alert" className="font-semibold text-danger">
            {error}
          </p>
        )}
      </LabSection>

      <LabSection id="aes-b-viz" title="4. Visualização animada">
        {definition && run ? (
          <ProtocolPlayer definition={definition} resetKey={`${run.flow.mode}|${run.flow.keyHex}|${run.flow.ctHex}|${run.flow.tampered}|${run.flow.tamperBlock}`} />
        ) : (
          <p className="text-lg text-muted">Informe uma mensagem válida para iniciar a animação.</p>
        )}
      </LabSection>

      {run && (
        <>
          <LabSection id="aes-b-blocks" title="5. Os blocos, vistos de perto">
            <BlockViz plain={run.plainBlocks} sent={run.sentBlocks} received={run.receivedBlocks} recovered={run.recoveredBlocks} status={run.status} tampered={run.flow.tampered} />
            <p role="status" className="rounded-xl border border-line bg-surface p-4 text-lg">
              <strong>O que Eva vê na cifra:</strong> {run.flow.pattern}.
            </p>
            {run.flow.tampered && (
              <p role="status" className={`rounded-xl border-2 p-4 text-lg font-semibold ${run.flow.authFailed ? 'border-k-secret bg-k-secret/10 text-k-secret' : 'border-danger bg-danger/10 text-danger'}`}>
                {run.flow.verdictText}
              </p>
            )}
          </LabSection>

          <LabSection id="aes-b-math" title="6. Comparação dos modos de operação">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-base">
                <caption className="sr-only">Comparação entre ECB, CBC, CTR e GCM</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-3">Modo</th>
                    <th scope="col" className="py-2 pr-3">Padrões do texto claro</th>
                    <th scope="col" className="py-2 pr-3">Integridade</th>
                    <th scope="col" className="py-2">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r.mode} className={`border-b border-line align-top ${r.mode === mode ? 'bg-accent/10' : ''}`}>
                      <th scope="row" className="py-2 pr-3 font-semibold">{r.mode}</th>
                      <td className="py-2 pr-3">{r.patterns}</td>
                      <td className="py-2 pr-3">{r.integrity}</td>
                      <td className="py-2">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LabSection>

          <LabSection id="aes-b-results" title="7. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Parâmetros e resultados da cifragem</caption>
                <tbody>
                  <tr className="border-b border-line">
                    <th scope="row" className="py-2 pr-4 font-semibold">Algoritmo</th>
                    <td className="py-2">AES-{run.flow.keyBits}-{run.flow.mode}</td>
                  </tr>
                  {run.flow.ivHex && (
                    <tr className="border-b border-line">
                      <th scope="row" className="py-2 pr-4 font-semibold">{run.flow.mode === 'CBC' ? 'IV (16 bytes)' : 'Nonce (12 bytes)'}</th>
                      <td className="break-all py-2 font-mono text-base">{run.flow.ivHex}</td>
                    </tr>
                  )}
                  <tr className="border-b border-line">
                    <th scope="row" className="py-2 pr-4 font-semibold">Cifra enviada (hex)</th>
                    <td className="break-all py-2 font-mono text-base">{run.flow.ctHex}</td>
                  </tr>
                  {run.tagHex && (
                    <tr className="border-b border-line">
                      <th scope="row" className="py-2 pr-4 font-semibold">Etiqueta GCM (128 bits)</th>
                      <td className="break-all py-2 font-mono text-base">{run.tagHex}</td>
                    </tr>
                  )}
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Resultado em Bob</th>
                    <td className={`py-2 font-semibold ${run.flow.ok ? 'text-k-secret' : run.flow.authFailed ? 'text-k-secret' : 'text-danger'}`}>
                      {run.flow.ok ? 'Mensagem original recuperada' : run.flow.authFailed ? 'Adulteração detectada e mensagem rejeitada' : 'Mensagem alterada, sem detecção'}
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
