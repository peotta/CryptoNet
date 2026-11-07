import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { engines } from '../../crypto/local/otpAuth';
import { OTP_ALGOS, RFC_SECRET, type OtpAlgo, type VectorCheck } from '../../crypto/otpAuth';
import { Callout, LabSection, Tabs, buttonClass } from '../../components/ui';
import { buildAlgoProtocol, clock, runAlgo, type AlgoFlowData } from './flows';

function Err({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
      {children}
    </p>
  );
}

const inputClass = 'min-h-11 rounded-lg border border-line bg-surface px-3 text-lg';

export function AlgorithmPanel() {
  const [mode, setMode] = useState<'hotp' | 'totp'>('hotp');
  const [secret, setSecret] = useState(RFC_SECRET);
  const [counter, setCounter] = useState(0);
  const [time, setTime] = useState(59);
  const [digits, setDigits] = useState(6);
  const [algo, setAlgo] = useState<OtpAlgo>('SHA-1');
  const [data, setData] = useState<AlgoFlowData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vectors, setVectors] = useState<VectorCheck[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    runAlgo(engines.otpAuth, { mode, secret, counter, time, digits, algo })
      .then((r) => {
        if (!cancelled) {
          setData(r);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : 'Falha ao calcular o código.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, secret, counter, time, digits, algo]);

  const definition = useMemo(() => (data ? buildAlgoProtocol(data) : null), [data]);

  return (
    <>
      <LabSection id="ot-algo" title="3. Parte A: do segredo ao código">
        <Tabs
          label="Variante"
          value={mode}
          onChange={setMode}
          tabs={[
            { id: 'hotp', label: 'HOTP (contador de eventos)' },
            { id: 'totp', label: 'TOTP (contador de tempo)' },
          ]}
        />
        <Callout variant="info" title="Vetores das RFCs">
          <p>
            Os valores iniciais são os do apêndice das RFCs: segredo <code>{RFC_SECRET}</code>, contador 0 no HOTP (código 755224) e tempo 59 s no TOTP (com 8 dígitos, 94287082).
          </p>
        </Callout>
      </LabSection>

      <LabSection id="ot-params" title="4. Parâmetros configuráveis">
        <div>
          <label htmlFor="ot-secret" className="mb-1 block text-base font-semibold">
            Segredo compartilhado K (texto, até 64 caracteres)
          </label>
          <input id="ot-secret" value={secret} onChange={(e) => setSecret(e.target.value)} maxLength={64} className={`${inputClass} w-full font-mono`} />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {mode === 'hotp' ? (
            <div>
              <label htmlFor="ot-counter" className="mb-1 block text-base font-semibold">
                Contador C
              </label>
              <input id="ot-counter" type="number" min={0} value={counter} onChange={(e) => setCounter(Number(e.target.value))} className={`${inputClass} w-32`} />
            </div>
          ) : (
            <div>
              <label htmlFor="ot-time" className="mb-1 block text-base font-semibold">
                Tempo Unix T (segundos)
              </label>
              <input id="ot-time" type="number" min={0} value={time} onChange={(e) => setTime(Number(e.target.value))} aria-describedby="ot-time-hint" className={`${inputClass} w-48`} />
              <p id="ot-time-hint" className="mt-1 text-base text-muted">
                Equivale a {clock(time)}.
              </p>
            </div>
          )}
          {mode === 'totp' && (
            <button type="button" className={buttonClass} onClick={() => setTime(Math.floor(Date.now() / 1000))}>
              Usar o horário atual
            </button>
          )}
          <div>
            <label htmlFor="ot-digits" className="mb-1 block text-base font-semibold">
              Dígitos
            </label>
            <select id="ot-digits" value={digits} onChange={(e) => setDigits(Number(e.target.value))} className={`${inputClass} w-24`}>
              {[6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ot-algo-sel" className="mb-1 block text-base font-semibold">
              Função hash do HMAC
            </label>
            <select id="ot-algo-sel" value={algo} onChange={(e) => setAlgo(e.target.value as OtpAlgo)} className={`${inputClass} w-36`}>
              {OTP_ALGOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <Err>{error}</Err>}
      </LabSection>

      <LabSection id="ot-viz" title="5. Visualização animada">
        {data && definition ? (
          <ProtocolPlayer definition={definition} resetKey={`${mode}|${data.keyHex}|${data.counterValue}|${data.digits}|${data.algo}`} />
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para ver a animação.</p>
        )}
      </LabSection>

      {data && (
        <LabSection id="ot-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados do cálculo do código</caption>
              <tbody>
                <Row label="Segredo K (hex)" value={data.keyHex} mono />
                <Row label="Segredo K (Base32)" value={data.keyB32} mono />
                <Row label="Contador C" value={`${data.counterValue} = 0x${data.counterHex}`} mono />
                <Row label={`HMAC-${data.algo} (hex)`} value={data.hmacHex} mono />
                <Row label="Deslocamento" value={String(data.offset)} />
                <Row label="Quatro bytes extraídos" value={`0x${data.fourHex}`} mono />
                <Row label="Inteiro de 31 bits" value={`0x${data.maskedHex} = ${data.truncated}`} mono />
                <Row label={`Código (${data.digits} dígitos)`} value={data.code} mono />
              </tbody>
            </table>
          </div>
          <div className="space-y-3">
            <button type="button" className={buttonClass} onClick={() => engines.otpAuth.checkVectors().then(setVectors)}>
              Conferir os vetores de teste das RFCs
            </button>
            {vectors && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-base">
                  <caption className="sr-only">Conferência dos vetores de teste das RFCs 4226 e 6238</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="py-1 pr-4">
                        Vetor
                      </th>
                      <th scope="col" className="py-1 pr-4">
                        Esperado
                      </th>
                      <th scope="col" className="py-1 pr-4">
                        Obtido
                      </th>
                      <th scope="col" className="py-1">
                        Resultado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vectors.map((v) => (
                      <tr key={v.label}>
                        <th scope="row" className="py-1 pr-4 font-normal">
                          {v.label}
                        </th>
                        <td className="py-1 pr-4 font-mono">{v.expected}</td>
                        <td className="py-1 pr-4 font-mono">{v.obtained}</td>
                        <td className={`py-1 font-semibold ${v.ok ? 'text-k-secret' : 'text-danger'}`}>{v.ok ? 'Confere' : 'Diverge'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-base font-semibold" role="status">
                  {vectors.every((v) => v.ok) ? `Os ${vectors.length} vetores conferem.` : 'Há vetores divergentes.'}
                </p>
              </div>
            )}
          </div>
        </LabSection>
      )}
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <tr className="border-b border-line align-top">
      <th scope="row" className="w-1/3 py-2 pr-4 font-semibold">
        {label}
      </th>
      <td className={`break-all py-2 ${mono ? 'font-mono text-base' : ''}`}>{value}</td>
    </tr>
  );
}
