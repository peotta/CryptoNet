import { useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { engines, type RealKeyPair } from '../../crypto/engines';
import { abbreviateHex } from '../../crypto/encoding';
import { HASH_BYTES, oaepMaxMessageBytes, PSS_SALT_BYTES, RSA_KEY_SIZES, type RsaKeySize } from '../../crypto/rsaWebCrypto';
import { Callout, LabSection, Tabs, buttonClass, primaryButtonClass } from '../../components/ui';
import { buildRsaProtocol, type RsaScenario } from './flows';
import { runReal, type RealRun } from './run';

export function RealPanel() {
  const [scenario, setScenario] = useState<RsaScenario>('cifragem');
  const [size, setSize] = useState<RsaKeySize>(2048);
  const [text, setText] = useState('Olá, Bob! Esta mensagem é confidencial.');
  const [tamper, setTamper] = useState(false);
  const [keys, setKeys] = useState<{ scenario: RsaScenario; size: RsaKeySize; pair: RealKeyPair } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RealRun | null>(null);

  const bytes = new TextEncoder().encode(text).length;
  const maxBytes = oaepMaxMessageBytes(size);
  const tooLong = scenario === 'cifragem' && bytes > maxBytes;
  const keysFit = keys && keys.scenario === scenario && keys.size === size;

  async function generate(): Promise<RealKeyPair | null> {
    setBusy(`Gerando o par de chaves RSA de ${size} bits (pode levar alguns segundos)…`);
    setError(null);
    try {
      const pair = scenario === 'cifragem' ? await engines.rsaReal.generateEncryptionKeys(size) : await engines.rsaReal.generateSigningKeys(size);
      setKeys({ scenario, size, pair });
      return pair;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar as chaves.');
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function execute(forceNewKeys: boolean) {
    const pair = !forceNewKeys && keysFit ? keys.pair : await generate();
    if (!pair) return;
    setBusy('Executando a operação criptográfica…');
    setError(null);
    try {
      setRun(await runReal(engines.rsaReal, pair, { text, scenario, tamper }));
    } catch (e) {
      setRun(null);
      setError(e instanceof Error ? e.message : 'Falha na operação.');
    } finally {
      setBusy(null);
    }
  }

  const definition = useMemo(() => (run ? buildRsaProtocol(run.flow) : null), [run]);
  const info = keys?.pair.info;

  return (
    <>
      <Callout variant="ok" title="RSA criptográfico real (Web Crypto API)">
        <p>
          Cifragem com <strong>RSA-OAEP</strong> e assinatura com <strong>RSA-PSS</strong>, ambos com SHA-256, executados pelo navegador. As chaves privadas são criadas
          como não extraíveis. Os dados digitados não saem do seu computador.
        </p>
      </Callout>

      <LabSection id="rsa-r-params" title="3. Parâmetros configuráveis">
        <Tabs
          label="Cenário"
          value={scenario}
          onChange={(s) => {
            setScenario(s);
            setRun(null);
          }}
          tabs={[
            { id: 'cifragem', label: 'Cifragem RSA-OAEP' },
            { id: 'assinatura', label: 'Assinatura RSA-PSS' },
          ]}
        />
        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <div>
            <label htmlFor="rsa-size" className="mb-1 block text-base font-semibold">
              Tamanho da chave
            </label>
            <select
              id="rsa-size"
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value) as RsaKeySize);
                setRun(null);
              }}
              className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg"
            >
              {RSA_KEY_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} bits
                </option>
              ))}
            </select>
            <p className="mt-1 text-base text-muted">2048 bits é o mínimo atual; 3072 e 4096 são mais lentos.</p>
          </div>
          <div>
            <label htmlFor="rsa-text" className="mb-1 block text-base font-semibold">
              Mensagem
            </label>
            <textarea
              id="rsa-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              aria-describedby="rsa-text-hint"
              className="w-full rounded-lg border border-line bg-surface p-3 text-lg"
            />
            <p id="rsa-text-hint" className={`mt-1 text-base ${tooLong ? 'font-semibold text-danger' : 'text-muted'}`}>
              {bytes} bytes (UTF-8).{' '}
              {scenario === 'cifragem'
                ? `Máximo para RSA-OAEP com SHA-256 e chave de ${size} bits: ${maxBytes} bytes (k - 2·hLen - 2 = ${size / 8} - ${2 * HASH_BYTES} - 2).`
                : 'O RSA-PSS assina o hash SHA-256 da mensagem; não há limite prático de tamanho.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={primaryButtonClass} disabled={!!busy || tooLong || bytes === 0} onClick={() => execute(false)}>
            {keysFit ? 'Executar fluxo com as chaves atuais' : 'Gerar chaves e executar fluxo'}
          </button>
          <button type="button" className={buttonClass} disabled={!!busy || tooLong || bytes === 0} onClick={() => execute(true)}>
            Gerar novo par de chaves
          </button>
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
            {scenario === 'cifragem' ? 'Teste de falha: Eva adultera 1 bit da cifra' : 'Teste de falha: Eva adultera a mensagem assinada'}
          </label>
        </div>
        <p aria-live="polite" className="text-base text-muted">
          {busy}
        </p>
        {error && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {error}
          </p>
        )}
      </LabSection>

      <LabSection id="rsa-r-viz" title="4. Visualização animada">
        {definition ? (
          <ProtocolPlayer definition={definition} resetKey={`${run?.payloadHex}|${run?.flow.tampered}`} />
        ) : (
          <p className="text-lg text-muted">Execute o fluxo para gerar a animação com valores reais.</p>
        )}
      </LabSection>

      {info && keysFit && (
        <LabSection id="rsa-r-results" title="5. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Parâmetros do par de chaves RSA real</caption>
              <tbody>
                <tr className="border-b border-line">
                  <th scope="row" className="py-2 pr-4">Algoritmo</th>
                  <td className="py-2">{scenario === 'cifragem' ? 'RSA-OAEP, SHA-256, MGF1-SHA-256, rótulo vazio' : `RSA-PSS, SHA-256, sal de ${PSS_SALT_BYTES} bytes`}</td>
                </tr>
                <tr className="border-b border-line">
                  <th scope="row" className="py-2 pr-4">Módulo n</th>
                  <td className="py-2">{info.modulusBits} bits</td>
                </tr>
                <tr className="border-b border-line">
                  <th scope="row" className="py-2 pr-4">Expoente público e</th>
                  <td className="py-2">{info.exponent}</td>
                </tr>
                <tr className="border-b border-line">
                  <th scope="row" className="py-2 pr-4">Expoente privado d</th>
                  <td className="py-2">não extraível (não é exibido nem exportado)</td>
                </tr>
                {run && (
                  <>
                    <tr className="border-b border-line">
                      <th scope="row" className="py-2 pr-4">{scenario === 'cifragem' ? 'Cifra (hex)' : 'Assinatura (hex)'}</th>
                      <td className="break-all py-2 font-mono text-base">{abbreviateHex(run.payloadHex, 32)} ({run.payloadHex.length / 2} bytes)</td>
                    </tr>
                    <tr>
                      <th scope="row" className="py-2 pr-4">Resultado</th>
                      <td className={`py-2 font-semibold ${run.flow.ok ? 'text-k-secret' : 'text-danger'}`}>{run.flow.ok ? 'Sucesso' : 'Falha detectada'}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          <details>
            <summary className="cursor-pointer text-base font-semibold text-accent">Ver o módulo n completo (hexadecimal)</summary>
            <p className="mt-2 break-all rounded-lg bg-surface2 p-3 font-mono text-base">{info.modulusHex}</p>
          </details>
        </LabSection>
      )}
    </>
  );
}
