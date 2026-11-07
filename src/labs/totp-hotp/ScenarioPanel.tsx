import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { engines } from '../../crypto/local/otpAuth';
import { randomBytes } from '../../crypto/random';
import { Callout, LabSection, Tabs, buttonClass } from '../../components/ui';
import { buildScenarioProtocol, clock, DEFAULT_TIME, runScenario, type Scenario, type ScenarioFlowData } from './flows';

function Err({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
      {children}
    </p>
  );
}

const inputClass = 'min-h-11 rounded-lg border border-line bg-surface px-3 text-lg';

const INTROS: Record<Scenario, { variant: 'info' | 'warn' | 'danger'; title: string; text: string }> = {
  normal: { variant: 'info', title: 'O que se espera', text: 'Eva lê o código no canal, mas só consegue usá-lo se o servidor ainda o aceitar. Passada a janela, o código capturado não vale mais.' },
  replay: { variant: 'warn', title: 'Repetição dentro da janela', text: 'Eva repete o código poucos segundos depois. Marque a opção para ver a defesa: o servidor guardar o último contador aceito.' },
  phishing: { variant: 'danger', title: 'O limite do TOTP', text: 'Alice digita o código em um site falso de Eva, que o repassa ao servidor verdadeiro na hora. O código não prova em qual site foi digitado.' },
  'forca-bruta': { variant: 'info', title: 'Adivinhar o código', text: 'Eva não tem o segredo e tenta códigos de 6 dígitos. O que protege Alice é o limite de tentativas, não o tamanho do código.' },
};

export function ScenarioPanel() {
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [key, setKey] = useState(() => randomBytes(20));
  const [time, setTime] = useState(DEFAULT_TIME);
  const [rejectUsed, setRejectUsed] = useState(false);
  const [limit, setLimit] = useState(5);
  const [data, setData] = useState<ScenarioFlowData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intro = INTROS[scenario];

  useEffect(() => {
    let cancelled = false;
    runScenario(engines.otpAuth, { scenario, key, time, rejectUsed, limit })
      .then((r) => {
        if (!cancelled) {
          setData(r);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : 'Falha ao executar o cenário.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scenario, key, time, rejectUsed, limit]);

  const definition = useMemo(() => (data ? buildScenarioProtocol(data) : null), [data]);

  return (
    <>
      <LabSection id="ot-cenario" title="3. Parte B: Alice, Bob e Eva">
        <Tabs
          label="Cenário"
          value={scenario}
          onChange={setScenario}
          tabs={[
            { id: 'normal', label: 'Código vencido' },
            { id: 'replay', label: 'Repetição do código' },
            { id: 'phishing', label: 'Phishing em tempo real' },
            { id: 'forca-bruta', label: 'Adivinhar o código' },
          ]}
        />
        <Callout variant={intro.variant} title={intro.title}>
          <p>{intro.text}</p>
        </Callout>
      </LabSection>

      <LabSection id="ot-params" title="4. Parâmetros configuráveis">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="ot-time" className="mb-1 block text-base font-semibold">
              Tempo Unix do primeiro acesso (segundos)
            </label>
            <input id="ot-time" type="number" min={0} value={time} onChange={(e) => setTime(Number(e.target.value))} aria-describedby="ot-time-hint" className={`${inputClass} w-48`} />
            <p id="ot-time-hint" className="mt-1 text-base text-muted">
              Equivale a {clock(time)}.
            </p>
          </div>
          <button type="button" className={buttonClass} onClick={() => setTime(Math.floor(Date.now() / 1000))}>
            Usar o horário atual
          </button>
          <button type="button" className={buttonClass} onClick={() => setKey(randomBytes(20))}>
            Sortear novo segredo (aleatório seguro)
          </button>
        </div>
        {scenario === 'replay' && (
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" className="h-5 w-5" checked={rejectUsed} onChange={(e) => setRejectUsed(e.target.checked)} />
            O servidor registra o último contador aceito e recusa a repetição
          </label>
        )}
        {scenario === 'forca-bruta' && (
          <div>
            <label htmlFor="ot-limit" className="mb-1 block text-base font-semibold">
              Tentativas erradas até o bloqueio (1 a 20)
            </label>
            <input id="ot-limit" type="number" min={1} max={20} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={`${inputClass} w-28`} />
          </div>
        )}
        {error && <Err>{error}</Err>}
      </LabSection>

      <LabSection id="ot-viz" title="5. Visualização animada">
        {data && definition ? (
          <ProtocolPlayer definition={definition} resetKey={`${scenario}|${data.keyB32}|${data.time}|${data.rejectUsed}|${data.limit}`} />
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para ver a animação.</p>
        )}
      </LabSection>

      {data && (
        <LabSection id="ot-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados do cenário</caption>
              <tbody>
                <Row label="Segredo (Base32)" value={data.keyB32} mono />
                <Row label="Primeiro acesso" value={clock(data.time)} />
                <Row label="Contador do primeiro acesso" value={data.counter} mono />
                <Row label="Código de Alice" value={data.code} mono />
                {data.scenario !== 'forca-bruta' && <Row label="Segundo acesso (Eva)" value={`${clock(data.evaTime)}, contador ${data.evaCounter}`} />}
                {data.scenario === 'forca-bruta' && <Row label="Palpites de Eva" value={data.guesses.join(', ')} mono />}
                {data.scenario === 'forca-bruta' && <Row label="Chance de acerto até o bloqueio" value={`${(data.probability * 100).toLocaleString('pt-BR', { maximumSignificantDigits: 2 })}%`} />}
                <tr>
                  <th scope="row" className="py-2 pr-4 font-semibold">
                    Eva autenticou como Alice?
                  </th>
                  <td className={`py-2 font-semibold ${data.evaAccepted ? 'text-danger' : 'text-k-secret'}`}>{data.evaAccepted ? 'Sim' : 'Não'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-lg">{data.verdictText}</p>
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
