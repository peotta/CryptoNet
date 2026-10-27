import { useEffect, useMemo, useState } from 'react';
import { engines } from '../../crypto/local/rc4';
import { toHex, fromHex } from '../../crypto/encoding';
import { randomBytes } from '../../crypto/random';
import { prgaTrace, type KsaStep, type PrgaStep } from '../../crypto/rc4';
import { Callout, Field, LabSection, buttonClass } from '../../components/ui';

const PRESETS = [
  { id: 'key', label: 'Usar a chave "Key" (4b6579)', hex: '4b6579', expected: 'eb9f7781b734ca72a719', note: 'O fluxo começa por EB 9F 77 81 B7 34 CA 72 A7 19, o que dá BBF316E8D940AF0AD3 ao cifrar "Plaintext" (exemplo clássico).' },
  { id: 'rfc', label: 'Usar o vetor da RFC 6229 (0102030405)', hex: '0102030405', expected: 'b2396305f03dc027ccc3524a0a1118a8', note: 'Os 16 primeiros bytes são B2 39 63 05 F0 3D C0 27 CC C3 52 4A 0A 11 18 A8, como no vetor da RFC 6229 (deslocamento 0).' },
];
const OUT = 16;
const KSA = 256;
const TOTAL = KSA + OUT;
const HEX_KEY = /^([0-9a-fA-F]{2}){1,256}$/;

const h = (n: number) => n.toString(16).padStart(2, '0');

function StateGrid({ state, marks, caption }: { state: Uint8Array; marks: Record<number, 'i' | 'j' | 'out'>; caption: string }) {
  const cols = Array.from({ length: 16 }, (_, c) => c);
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface p-3">
      <table className="border-separate border-spacing-0.5 font-mono text-sm">
        <caption className="mb-1 text-left font-sans text-base text-muted">{caption}</caption>
        <thead>
          <tr>
            <td />
            {cols.map((c) => (
              <th key={c} scope="col" className="px-1 text-center font-sans text-xs font-normal text-muted">
                +{c.toString(16)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cols.map((r) => (
            <tr key={r}>
              <th scope="row" className="pr-2 text-right font-sans text-xs font-normal text-muted">
                {h(16 * r)}
              </th>
              {cols.map((c) => {
                const p = 16 * r + c;
                const m = marks[p];
                return (
                  <td
                    key={c}
                    className={`rounded border px-1 py-0.5 text-center ${m === 'out' ? 'border-k-secret bg-k-secret/25 font-bold' : m ? 'border-accent bg-accent/25 font-bold' : 'border-line'}`}
                  >
                    {h(state[p])}
                    {m && <span className="sr-only"> ({m === 'i' ? 'posição i' : m === 'j' ? 'posição j' : 'byte de saída'})</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-base text-muted">Cada célula é o byte S[p] em hexadecimal; a linha é o início da posição p e a coluna é o deslocamento. Destaque: posições i e j, e o byte de saída.</p>
    </div>
  );
}

export function PartA() {
  const [keyHex, setKeyHex] = useState(PRESETS[0].hex);
  const [step, setStep] = useState(0);
  const [jump, setJump] = useState('');
  const [ksa, setKsa] = useState<{ steps: KsaStep[]; state: Uint8Array } | null>(null);
  const err = HEX_KEY.test(keyHex) ? null : 'A chave tem de 1 a 256 bytes, em dígitos hexadecimais (número par de dígitos).';

  useEffect(() => {
    setStep(0);
    if (err) {
      setKsa(null);
      return;
    }
    let cancelled = false;
    engines.rc4.ksa(fromHex(keyHex)).then((r) => {
      if (!cancelled) setKsa(r);
    });
    return () => {
      cancelled = true;
    };
  }, [keyHex, err]);

  const prga: PrgaStep[] = useMemo(() => (ksa ? prgaTrace(ksa.state, OUT) : []), [ksa]);
  const preset = PRESETS.find((p) => p.hex === keyHex.toLowerCase());
  const jumpN = Number(jump);
  const jumpErr = jump === '' || (Number.isInteger(jumpN) && jumpN >= 0 && jumpN <= TOTAL) ? null : `Informe uma etapa de 0 a ${TOTAL}.`;

  let state: Uint8Array = Uint8Array.from({ length: 256 }, (_, i) => i);
  let marks: Record<number, 'i' | 'j' | 'out'> = {};
  let note = 'Estado inicial: S é a permutação identidade, S[p] = p. A KSA vai percorrer i de 0 a 255, e a cada passo troca S[i] com S[j]. Pressione o botão para executar o primeiro passo.';
  let caption = 'Estado S antes da KSA';
  let outputs = '';

  if (ksa && step >= 1 && step <= KSA) {
    const s = ksa.steps[step - 1];
    const prev = step === 1 ? Uint8Array.from({ length: 256 }, (_, i) => i) : ksa.steps[step - 2].state;
    const jPrev = step === 1 ? 0 : ksa.steps[step - 2].j;
    state = s.state;
    marks = { [s.i]: 'i', [s.j]: 'j' };
    const kLen = keyHex.length / 2;
    note = `KSA, passo ${step} de 256 (i = ${s.i}): j = j + S[i] + K[i mod ${kLen}] = ${jPrev} + ${prev[s.i]} + ${s.keyByte} = ${jPrev + prev[s.i] + s.keyByte} mod 256 = ${s.j}. Em seguida troca S[${s.i}] com S[${s.j}]${s.i === s.j ? ' (mesma posição: nada muda)' : ''}.`;
    caption = `Estado S depois do passo ${step} da KSA`;
  } else if (ksa && step > KSA) {
    const n = step - KSA;
    const s = prga[n - 1];
    const prev = n === 1 ? ksa.state : prga[n - 2].state;
    const jPrev = n === 1 ? 0 : prga[n - 2].j;
    state = s.state;
    marks = { [s.i]: 'i', [s.j]: 'j', [s.t]: 'out' };
    note = `PRGA, byte ${n} do fluxo: i = ${s.i}; j = j + S[i] = ${jPrev} + ${prev[s.i]} = ${(jPrev + prev[s.i]) & 0xff}. Troca S[${s.i}] com S[${s.j}]. Posição de saída t = S[i] + S[j] = ${s.state[s.i]} + ${s.state[s.j]} = ${s.t}. Byte do fluxo: S[${s.t}] = ${h(s.out)} (hexadecimal).`;
    caption = `Estado S depois do byte ${n} do fluxo`;
    outputs = prga.slice(0, n).map((x) => h(x.out)).join('');
  } else if (ksa && step === 0) {
    state = Uint8Array.from({ length: 256 }, (_, i) => i);
  }

  return (
    <LabSection id="rc4-a" title="3. Parte A: o RC4 troca por troca">
      <div className="space-y-4">
        <p className="text-lg">
          O RC4 mantém um estado S de 256 bytes (uma permutação dos valores 0 a 255) e dois índices, i e j. A <strong>KSA</strong> (<em>key-scheduling algorithm</em>) embaralha S com a chave em 256 trocas. A{' '}
          <strong>PRGA</strong> (<em>pseudo-random generation algorithm</em>) faz mais uma troca por byte emitido. Avance uma troca por vez.
        </p>
        <Field id="rc4-key" label="Chave (1 a 256 bytes em hexadecimal)" value={keyHex} onChange={(v) => setKeyHex(v.trim())} error={err} inputMode="text" maxLength={512} />
        <div className="flex flex-wrap gap-3">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={buttonClass} onClick={() => setKeyHex(p.hex)}>
              {p.label}
            </button>
          ))}
          <button type="button" className={buttonClass} onClick={() => setKeyHex(toHex(randomBytes(16)))}>
            Sortear chave de 16 bytes (aleatório seguro)
          </button>
        </div>
        {ksa ? (
          <>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={buttonClass} disabled={step === 0} onClick={() => setStep(step - 1)}>
                ← Voltar
              </button>
              <button type="button" className={buttonClass} disabled={step >= TOTAL} onClick={() => setStep(step + 1)}>
                {step === 0 ? 'Iniciar: primeira troca da KSA' : step === KSA ? 'Gerar o primeiro byte do fluxo →' : step < KSA ? 'Próxima troca →' : 'Próximo byte do fluxo →'}
              </button>
              <button type="button" className={buttonClass} disabled={step === 0} onClick={() => setStep(0)}>
                Reiniciar
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-48">
                <Field id="rc4-jump" label={`Ir para a etapa (0 a ${TOTAL})`} value={jump} onChange={(v) => setJump(v.trim())} error={jumpErr} />
              </div>
              <button type="button" className={buttonClass} disabled={jump === '' || !!jumpErr} onClick={() => setStep(jumpN)}>
                Ir
              </button>
              <button type="button" className={buttonClass} onClick={() => setStep(KSA)}>
                Ir para o fim da KSA (etapa 256)
              </button>
            </div>
            <p aria-live="polite" className="text-lg">{note}</p>
            <StateGrid state={state} marks={marks} caption={caption} />
            {outputs && (
              <p className="break-all rounded-xl border border-line bg-surface p-3 font-mono text-base">
                <span className="font-sans font-semibold">Fluxo de chaves até aqui: </span>
                {outputs}
              </p>
            )}
            {step === TOTAL && preset && outputs.startsWith(preset.expected) && (
              <Callout variant="ok" title="Conferido com o vetor conhecido">
                <p>{preset.note}</p>
              </Callout>
            )}
          </>
        ) : (
          <p className="text-lg text-muted">Corrija a chave para iniciar.</p>
        )}
      </div>
    </LabSection>
  );
}
