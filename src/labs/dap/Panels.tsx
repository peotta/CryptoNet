import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { QrCode, qrMatrix } from '../../animations/QrCode';
import { Callout, LabSection, Tabs, buttonClass } from '../../components/ui';
import { MAX_ATTEMPTS, TTL_SECONDS } from '../../crypto/dap';
import { toHex } from '../../crypto/encoding';
import { engines } from '../../crypto/local/dap';
import { randomBytes } from '../../crypto/random';
import { useDebounced } from '../../hooks/useDebounced';
import type { ProtocolDefinition } from '../../simulation/types';
import type { QrItem } from './common';
import { buildProvisionProtocol, runProvision, type ProvisionFlow, type ProvisionPhase, type ProvisionScenario } from './provision';
import { makeSeeds, type DapSeeds } from './seeds';
import { buildTransactionProtocol, runTransaction, type TxFlow, type TxScenario } from './transaction';

function Err({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
      {children}
    </p>
  );
}

function Row({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <tr className="border-b border-line">
      <th scope="row" className="py-2 pr-4 font-semibold">
        {label}
      </th>
      <td className={`break-all py-2 ${mono ? 'font-mono text-base' : ''}`}>{value}</td>
    </tr>
  );
}

function NumberField({ id, label, value, onChange, min, max, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; min: number; max: number; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-semibold">
        {label}
      </label>
      <input id={id} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 font-mono text-lg" />
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

function TextField({ id, label, value, onChange, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-semibold">
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg" />
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

/** Valores aleatórios novos e o instante de geração (em segundos inteiros). */
function freshSeeds(): { seeds: DapSeeds; t0: number } {
  return { seeds: makeSeeds(randomBytes), t0: Math.floor(Date.now() / 1000) * 1000 };
}

const toInt = (s: string) => (s.trim() === '' || !/^-?\d+$/.test(s.trim()) ? Number.NaN : Number(s));

/** Mostra, abaixo do player, o QR code do último passo concluído que exibe um. */
function qrFooter(definition: ProtocolDefinition, qrs: QrItem[]) {
  const ids = definition.steps.map((s) => s.id);
  return function Footer({ index }: { index: number; total: number }) {
    const shown = qrs.filter((q) => {
      const i = ids.indexOf(q.stepId);
      return i >= 0 && i < index;
    });
    const q = shown[shown.length - 1];
    if (!q) return null;
    return (
      <div data-testid="qr-footer" className="mt-3 flex flex-wrap items-start gap-4 rounded-xl border border-line bg-surface p-3">
        <QrCode text={q.text} title={q.title} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">Conteúdo do QR code</p>
          <p className="mt-1 break-all font-mono text-sm" data-testid="qr-text">
            {q.text}
          </p>
          <p className="mt-1 text-sm text-muted">Quem fotografa a tela lê estes caracteres. O que o DAP protege é a integridade dos dados e o sigilo de r, não o sigilo do trans_data.</p>
        </div>
      </div>
    );
  };
}

function useFooter(definition: ProtocolDefinition | null, qrs: QrItem[] | undefined) {
  return useMemo(() => (definition && qrs ? qrFooter(definition, qrs) : undefined), [definition, qrs]);
}

// ---------------------------------------------------------------- Partes A e B
const PROVISION_SCENARIOS: Record<'chave' | 'ativacao', { id: ProvisionScenario; label: string }[]> = {
  chave: [
    { id: 'normal', label: 'Provisionamento normal' },
    { id: 'substitui', label: 'Eva troca k1 no UC' },
    { id: 've-k2', label: 'Eva vê k2 no ATM' },
  ],
  ativacao: [
    { id: 'normal', label: 'Chave correta' },
    { id: 'substitui', label: 'Chave divergente (Eva trocou k1)' },
    { id: 've-k2', label: 'Eva conhece k (viu o ATM)' },
  ],
};

export function ProvisionPanel({ phase }: { phase: Exclude<ProvisionPhase, 'completo'> }) {
  const [scenario, setScenario] = useState<ProvisionScenario>('normal');
  const [scan, setScan] = useState('12');
  const [type, setType] = useState('30');
  const [fresh, setFresh] = useState(freshSeeds);
  const [run, setRun] = useState<ProvisionFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dScan = useDebounced(scan);
  const dType = useDebounced(type);

  useEffect(() => {
    let cancelled = false;
    runProvision(engines.dap, { scenario, seeds: fresh.seeds, t0: fresh.t0, scanSec: toInt(dScan), typeSec: toInt(dType) })
      .then((r) => !cancelled && (setRun(r), setError(null)))
      .catch((e: unknown) => !cancelled && (setRun(null), setError(e instanceof Error ? e.message : 'Falha no provisionamento.')));
    return () => {
      cancelled = true;
    };
  }, [scenario, fresh, dScan, dType]);

  const definition = useMemo(() => (run ? buildProvisionProtocol(run, phase) : null), [run, phase]);
  const footer = useFooter(definition, run?.qrs);
  return (
    <>
      <LabSection id="dap-params" title="4. Parâmetros configuráveis">
        <Tabs label={phase === 'chave' ? 'Cenário do provisionamento' : 'Cenário da ativação'} value={scenario} onChange={setScenario} tabs={PROVISION_SCENARIOS[phase]} />
        {phase === 'ativacao' && (
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField id="dap-p-scan" label="Segundos até Alice ler o QR de ativação" value={scan} onChange={setScan} min={0} max={600} hint={`O desafio vale ${TTL_SECONDS} s. Acima disso, o MD o recusa.`} />
          <NumberField id="dap-p-type" label="Segundos até o código chegar ao e-Bank" value={type} onChange={setType} min={0} max={600} hint="Contados da geração do desafio, não da leitura." />
        </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={buttonClass} onClick={() => setFresh(freshSeeds())}>
            Sortear novos valores
          </button>
          <p className="font-mono text-base text-muted" data-testid="dap-seeds">
            k1 = {toHex(fresh.seeds.k1).slice(0, 12)}…, MK = {toHex(fresh.seeds.mk).slice(0, 12)}…
          </p>
        </div>
        {scenario === 'substitui' && (
          <Callout variant="warn" title="Troca de k1 pelo UC">
            <p>O QR do código 001 não leva etiqueta, pois o MD ainda não tem chave. A troca só aparece na ativação.</p>
          </Callout>
        )}
        {scenario === 've-k2' && (
          <Callout variant="danger" title="Hipótese do draft violada">
            <p>A segurança vale se Eva obtiver no máximo uma das metades. Aqui ela vê também o ATM e calcula k.</p>
          </Callout>
        )}
        {error && <Err>{error}</Err>}
      </LabSection>
      <LabSection id="dap-viz" title="5. Visualização animada">
        {run && definition ? (
          <ProtocolPlayer definition={definition} resetKey={`prov|${phase}|${scenario}|${toHex(fresh.seeds.k1)}|${run.input.scanSec}|${run.input.typeSec}`} footer={footer} />
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>
      <LabSection id="dap-math" title="6. Explicação matemática">
        {phase === 'ativacao' ? (
          <div className="space-y-3 rounded-xl border border-line bg-surface p-4 text-lg">
            <p className="font-mono">desafio de ativação = Base64( trans_data | r&apos; | y ), com Code = 000</p>
            <ul className="list-disc space-y-1 pl-6 text-base">
              <li>O e-Bank monta o desafio com a chave k que ele recompõe (<strong>k = k₁ ⊕ k₂</strong>). O MD o verifica com a chave k que calculou: se as duas chaves forem diferentes, a etiqueta y não confere.</li>
              <li>O modelo do código 000 não tem campos financeiros: só a mensagem de ativação e o carimbo de geração. O MD mostra a mensagem e, depois da confirmação do usuário, revela o código r_hat.</li>
              <li>
                O e-Bank só marca o MD como habilitado se r_hat chegar em até {TTL_SECONDS} s e for igual a r, com até {MAX_ATTEMPTS} tentativas. Antes disso, o MD não é um autorizador válido.
              </li>
              <li>A ativação detecta a troca de uma metade da chave (o QR 001 não leva etiqueta), mas não detecta que Eva tenha visto as duas metades.</li>
            </ul>
          </div>
        ) : (
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4 text-lg">
          <p className="font-mono"><strong>k = k₁ ⊕ k₂</strong>, com k₂ = HMAC-SHA-512(MK, x)</p>
          <ul className="list-disc space-y-1 pl-6 text-base">
            <li>
              <span className="font-mono">x</span> = &quot;DAP-k2-v1&quot; | key_id (4 octetos) | version (4) | len(ID) (2) | ID | key_timestamp (8), todos os inteiros em ordem de rede.
            </li>
            <li>
              Como <span className="font-mono">k₁</span> é uniforme, <span className="font-mono">Pr[k = x | k₂ = s] = 2⁻⁵¹²</span> para todo x: quem vê só uma das metades nada aprende (argumento do one-time pad de Shannon).
            </li>
            <li>
              A chave é partida em <span className="font-mono">k&apos;₁ = k[0..31]</span> (HMAC-SHA-256) e <span className="font-mono">k&apos;₂ = k[32..63]</span> (AES-256-CBC).
            </li>
            <li>
              O QR de troca de chaves (código 001) tem o formato <span className="font-mono">Version ; 001 ; Share ; Enroll ; Base64(Value) ; Check</span>, em que Check são os 4 primeiros octetos do SHA-256 do texto anterior.
            </li>
          </ul>
        </div>
        )}
      </LabSection>
      {run && (
        <LabSection id="dap-results" title="7. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">{phase === 'chave' ? 'Resultados do provisionamento da chave' : 'Resultados da ativação'}</caption>
              <tbody>
                {phase === 'chave' ? (
                  <>
                    <Row label="Enroll (mesmo nos dois QR)" value={run.enroll} mono />
                    <Row label="QR de k1 (código 001)" value={`${run.qr1.length} caracteres, Check ${run.parse1.ok ? run.parse1.check : 'inválido'}`} />
                    <Row label="QR de k2 (código 001)" value={`${run.qr2.length} caracteres, Check ${run.parse2.ok ? run.parse2.check : 'inválido'}`} />
                    <Row label="Chave k do e-Bank (recomposta no HSM)" value={`${toHex(run.bob.k).slice(0, 24)}…`} mono />
                    <Row label="Chave k do MD" value={`${toHex(run.alice.k).slice(0, 24)}…`} mono />
                    <Row label="As chaves são iguais?" value={toHex(run.bob.k) === toHex(run.alice.k) ? 'Sim' : 'Não: o MD e o e-Bank divergem'} />
                    <Row label="Eva conhece a chave k?" value={run.evaK ? 'Sim: viu as duas metades' : 'Não: viu no máximo uma metade'} />
                  </>
                ) : (
                  <>
                    <Row label="Chaves do MD e do e-Bank" value={toHex(run.bob.k) === toHex(run.alice.k) ? 'Iguais' : 'Diferentes'} />
                    <Row label="Etiqueta do desafio de ativação" value={run.tag.equal ? 'y confere no MD' : "y' ≠ y: o MD rejeita"} />
                    <Row label="Idade do desafio no MD" value={`${run.fresh.ageSeconds} s`} />
                    <Row label="Resultado" value={run.activated ? 'MD habilitado' : 'MD não habilitado'} />
                  </>
                )}
              </tbody>
            </table>
          </div>
        </LabSection>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Parte C
const TX_SCENARIOS: { id: TxScenario; label: string }[] = [
  { id: 'normal', label: 'Transação normal' },
  { id: 'altera', label: 'Eva altera o QR' },
  { id: 'fraude', label: 'Eva troca o pedido (MITB)' },
  { id: 'forca-bruta', label: 'Eva chuta o código' },
  { id: 'replay', label: 'Eva repete o código' },
];

export function TransactionPanel() {
  const [scenario, setScenario] = useState<TxScenario>('normal');
  const [scan, setScan] = useState('20');
  const [type, setType] = useState('45');
  const [offset, setOffset] = useState('0');
  const [payee, setPayee] = useState('Maria Silva');
  const [amount, setAmount] = useState('1500,00');
  const [fresh, setFresh] = useState(freshSeeds);
  const [run, setRun] = useState<TxFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dScan = useDebounced(scan);
  const dType = useDebounced(type);
  const dOffset = useDebounced(offset);
  const dPayee = useDebounced(payee);
  const dAmount = useDebounced(amount);

  useEffect(() => {
    let cancelled = false;
    runTransaction(engines.dap, { scenario, seeds: fresh.seeds, t0: fresh.t0, scanSec: toInt(dScan), typeSec: toInt(dType), mdOffset: toInt(dOffset), payee: dPayee, amount: dAmount })
      .then((r) => !cancelled && (setRun(r), setError(null)))
      .catch((e: unknown) => !cancelled && (setRun(null), setError(e instanceof Error ? e.message : 'Falha na transação.')));
    return () => {
      cancelled = true;
    };
  }, [scenario, fresh, dScan, dType, dOffset, dPayee, dAmount]);

  const definition = useMemo(() => (run ? buildTransactionProtocol(run) : null), [run]);
  const footer = useFooter(definition, run?.qrs);
  const modules = useMemo(() => (run ? qrMatrix(run.ch.base64).length : 0), [run]);
  const alone = scenario === 'forca-bruta';
  return (
    <>
      <LabSection id="dap-params" title="4. Parâmetros configuráveis">
        <Tabs label="Cenário da transação" value={scenario} onChange={setScenario} tabs={TX_SCENARIOS.map((s) => ({ id: s.id, label: s.label }))} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField id="dap-payee" label="Favorecido (até 30 caracteres)" value={payee} onChange={setPayee} hint="O e-Bank converte para maiúsculas ASCII; ';' e pontuação não são aceitos." />
          <TextField id="dap-amount" label="Valor em reais" value={amount} onChange={setAmount} hint="Por exemplo, 1500,00. Vai no desafio em 13 dígitos de centavos." />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField id="dap-scan" label="Segundos até Alice ler o QR" value={scan} onChange={setScan} min={0} max={600} hint={alone ? 'Não se aplica: Alice não participa deste ataque.' : `Acima de ${TTL_SECONDS} s o MD recusa o desafio.`} />
          <NumberField id="dap-type" label="Segundos até o código chegar ao e-Bank" value={type} onChange={setType} min={0} max={600} hint={`Contados da geração. Acima de ${TTL_SECONDS} s o e-Bank cancela.`} />
          <NumberField id="dap-offset" label="Relógio do MD, adiantado (+) ou atrasado (−), em s" value={offset} onChange={setOffset} min={-600} max={600} hint="Um carimbo mais de 60 s à frente do relógio do MD é recusado." />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={buttonClass} onClick={() => setFresh(freshSeeds())}>
            Sortear novos valores
          </button>
          <p className="font-mono text-base text-muted" data-testid="dap-seeds">
            k1 = {toHex(fresh.seeds.k1).slice(0, 12)}…, IV = {toHex(fresh.seeds.tx.iv).slice(0, 8)}…
          </p>
        </div>
        {error && <Err>{error}</Err>}
      </LabSection>
      <LabSection id="dap-viz" title="5. Visualização animada">
        {run && definition ? (
          <ProtocolPlayer
            definition={definition}
            resetKey={`tx|${scenario}|${toHex(fresh.seeds.k1)}|${toHex(fresh.seeds.tx.iv)}|${run.input.scanSec}|${run.input.typeSec}|${run.input.mdOffset}|${dPayee}|${dAmount}`}
            footer={footer}
          />
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>
      <LabSection id="dap-math" title="6. Explicação matemática">
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4 text-lg">
          <p className="font-mono">desafio = Base64( trans_data | r&apos; | y )</p>
          <ul className="list-disc space-y-1 pl-6 text-base">
            <li>
              <span className="font-mono">trans_data = Nonce ; Version ; Code ; Field₁ ; … ; Fieldₙ</span>, ASCII imprimível separado por &quot;;&quot;. O carimbo de geração (YYMMDDHHMMSS, UTC) é um dos campos.
            </li>
            <li>
              <span className="font-mono">r&apos; = IV | AES-256-CBC(k&apos;₂, IV, r)</span>: seis dígitos ASCII, preenchimento PKCS#7, um bloco de 16 octetos. O r&apos; tem 32 octetos.
            </li>
            <li>
              <span className="font-mono">y = HMAC-SHA-256(k&apos;₁, trans_data | r&apos;)</span>, de 32 octetos. O MD recalcula y&apos; e compara em tempo constante antes de decifrar qualquer coisa.
            </li>
            <li>
              Prazos: o MD recusa o desafio com mais de {TTL_SECONDS} s de idade ou com carimbo mais de 60 s à frente do relógio. O e-Bank é a autoridade: cancela depois de {TTL_SECONDS} s e permite no máximo {MAX_ATTEMPTS} tentativas.
            </li>
            <li>Probabilidade de um chute de Eva acertar: 10⁻⁶ por tentativa e, no máximo, 3 × 10⁻⁶ por desafio.</li>
          </ul>
        </div>
      </LabSection>
      {run && (
        <LabSection id="dap-results" title="7. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados da transação</caption>
              <tbody>
                <Row label="Nonce" value={run.nonce} mono />
                <Row label="trans_data" value={run.ch.transData} mono />
                <Row label="Código r (apenas no e-Bank)" value={run.ch.r} mono />
                <Row label="r' = IV | C (32 octetos)" value={toHex(run.ch.rPrime)} mono />
                <Row label="y (32 octetos)" value={toHex(run.ch.y)} mono />
                <Row label="Tamanho do desafio" value={`${run.ch.payload.length} octetos (${run.ch.transData.length} + 32 + 32), ${run.ch.base64.length} caracteres em Base64`} />
                <Row label="QR code" value={`${modules} × ${modules} módulos (correção de erros L)`} />
                {run.tag && <Row label="Etiqueta no MD" value={run.tag.equal ? 'y confere' : "y' ≠ y: rejeitado"} />}
                {run.fresh && <Row label="Idade do desafio no MD" value={`${run.fresh.ageSeconds} s (${run.fresh.state === 'ok' ? 'dentro da janela' : run.fresh.state === 'expired' ? 'vencido' : 'carimbo no futuro'})`} />}
                {run.guesses.length > 0 && <Row label="Chutes de Eva" value={run.guesses.map((g) => g.code).join(', ')} mono />}
                <Row label="Resultado" value={run.executed ? 'Transação executada' : alone ? 'Transação de Eva cancelada' : 'Transação não executada'} />
              </tbody>
            </table>
          </div>
        </LabSection>
      )}
    </>
  );
}
