import { useEffect, useState } from 'react';
import { bitsToHex, type DesTrace, type KeySchedule } from '../../crypto/des';
import { engines } from '../../crypto/local/des';
import { randomBytes } from '../../crypto/random';
import { toHex } from '../../crypto/encoding';
import { Callout, Field, LabSection, buttonClass } from '../../components/ui';
import { BitTable, Stepper, fromHexInput } from './BitsView';

const RFC_KEY = '133457799bbcdff1';
const RFC_BLOCK = '0123456789abcdef';
const RFC_OUT = '85e813540f0ab405';
const HEX16 = /^[0-9a-fA-F]{16}$/;

export function PartA() {
  const [keyHex, setKeyHex] = useState(RFC_KEY);
  const [blockHex, setBlockHex] = useState(RFC_BLOCK);
  const [decrypt, setDecrypt] = useState(false);
  const keyErr = HEX16.test(keyHex) ? null : 'A chave tem 16 dígitos hexadecimais (8 bytes, 64 bits).';
  const blockErr = HEX16.test(blockHex) ? null : 'O bloco tem 16 dígitos hexadecimais (8 bytes, 64 bits).';
  const err = keyErr ?? blockErr;
  const [trace, setTrace] = useState<DesTrace | null>(null);

  useEffect(() => {
    if (err) {
      setTrace(null);
      return;
    }
    let cancelled = false;
    engines.des.trace(fromHexInput(keyHex), fromHexInput(blockHex), decrypt).then((t) => {
      if (!cancelled) setTrace(t);
    });
    return () => {
      cancelled = true;
    };
  }, [keyHex, blockHex, decrypt, err]);

  const isRfc = keyHex.toLowerCase() === RFC_KEY && blockHex.toLowerCase() === RFC_BLOCK && !decrypt;

  return (
    <LabSection id="des-a" title="3. Parte A: o DES operação por operação">
      <div className="space-y-10">
        <div className="space-y-4">
          <p className="text-lg">
            O DES (<em>Data Encryption Standard</em>) cifra blocos de 64 bits com uma chave de 64 bits, dos quais 8 são de paridade e 56 são úteis. É uma <strong>rede de Feistel</strong> de 16
            rodadas: o bloco é dividido em duas metades L e R, e a cada rodada L(i) = R(i-1) e R(i) = L(i-1) ⊕ f(R(i-1), K(i)). Os dados abaixo valem para as três etapas seguintes.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="des-key" label="Chave (8 bytes em hexadecimal)" value={keyHex} onChange={(v) => setKeyHex(v.trim())} error={keyErr} inputMode="text" maxLength={16} />
            <Field id="des-block" label={decrypt ? 'Bloco cifrado (8 bytes em hexadecimal)' : 'Bloco do texto claro (8 bytes em hexadecimal)'} value={blockHex} onChange={(v) => setBlockHex(v.trim())} error={blockErr} inputMode="text" maxLength={16} />
          </div>
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" className="h-5 w-5" checked={decrypt} onChange={(e) => setDecrypt(e.target.checked)} />
            Decifrar (as mesmas 16 rodadas, com as subchaves em ordem inversa)
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setKeyHex(toHex(randomBytes(8)));
                setBlockHex(toHex(randomBytes(8)));
              }}
            >
              Sortear chave e bloco (aleatório seguro)
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setKeyHex(RFC_KEY);
                setBlockHex(RFC_BLOCK);
                setDecrypt(false);
              }}
            >
              Usar o exemplo clássico (133457799BBCDFF1)
            </button>
          </div>
        </div>
        {trace ? (
          <>
            <KeyScheduleViewer schedule={trace.schedule} />
            <BlockViewer trace={trace} isRfc={isRfc} />
            <FunctionViewer trace={trace} />
          </>
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar.</p>
        )}
      </div>
    </LabSection>
  );
}

function KeyScheduleViewer({ schedule }: { schedule: KeySchedule }) {
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [schedule]);
  let note = '';
  let rows: Parameters<typeof BitTable>[0]['rows'] = [];
  let caption = '';
  if (step === 0) {
    note = 'A chave tem 64 bits, em 8 bytes. O último bit de cada byte é de paridade (a norma pede paridade ímpar) e não entra no cálculo: sobram 56 bits úteis. Pressione o botão para aplicar a permuted choice 1.';
    caption = 'Chave de 64 bits';
    rows = [{ label: 'Chave', bits: schedule.key, group: 8 }];
  } else if (step === 1) {
    note = 'A PC-1 (permuted choice 1) descarta os 8 bits de paridade e reordena os 56 restantes, que se dividem em duas metades de 28 bits: C0 e D0.';
    caption = 'Chave de 56 bits depois da PC-1';
    rows = [
      { label: 'PC-1(K)', bits: schedule.pc1, group: 7, hex: false },
      { label: 'C0', bits: schedule.c0, group: 7, hex: false, active: true },
      { label: 'D0', bits: schedule.d0, group: 7, hex: false, active: true },
    ];
  } else {
    const r = schedule.rounds[step - 2];
    note = `Subchave ${r.round}: C e D giram ${r.shift} ${r.shift === 1 ? 'bit' : 'bits'} à esquerda (as rodadas 1, 2, 9 e 16 giram 1 bit; as demais, 2). A PC-2 escolhe 48 dos 56 bits de C e D juntos e forma a subchave K${r.round}.`;
    caption = `Subchave ${r.round} de 16`;
    rows = [
      { label: `C${r.round}`, bits: r.c, group: 7, hex: false },
      { label: `D${r.round}`, bits: r.d, group: 7, hex: false },
      { label: `K${r.round} = PC-2(C${r.round} D${r.round})`, bits: r.key, group: 6, hex: false, active: true },
    ];
  }
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">A.1 As 16 subchaves de 48 bits</h3>
      <Stepper step={step} total={17} labelStart="Iniciar: aplicar a PC-1" labelNext={step === 16 ? 'Última subchave →' : 'Próxima subchave →'} onStep={setStep} />
      <p aria-live="polite" className="text-lg">{note}</p>
      <BitTable caption={caption} rows={rows} />
      {step === 17 && (
        <p className="rounded-xl border border-line bg-surface p-3 font-mono text-base">
          <span className="font-sans font-semibold">Subchaves em hexadecimal (48 bits em 12 dígitos): </span>
          {schedule.rounds.map((r) => `K${r.round}=${bitsToHex(r.key)}`).join(' ')}
        </p>
      )}
    </div>
  );
}

const STAGES = 19; // 0 entrada; 1 IP; 2..17 rodadas; 18 troca; 19 FP

function BlockViewer({ trace, isRfc }: { trace: DesTrace; isRfc: boolean }) {
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [trace]);
  let note = '';
  let caption = '';
  let rows: Parameters<typeof BitTable>[0]['rows'] = [];
  if (stage === 0) {
    note = 'O bloco de 64 bits entra no algoritmo. Pressione o botão para aplicar a permutação inicial (IP).';
    caption = 'Bloco de entrada';
    rows = [{ label: trace.decrypt ? 'Cifra' : 'Claro', bits: trace.input, group: 8 }];
  } else if (stage === 1) {
    note = 'A permutação inicial (IP) apenas reordena os 64 bits; não tem papel criptográfico (não usa chave), mas faz parte da norma. O resultado se divide em L0 (32 bits da esquerda) e R0 (32 bits da direita).';
    caption = 'Depois da permutação inicial';
    rows = [
      { label: 'IP(bloco)', bits: trace.afterIp, group: 8 },
      { label: 'L0', bits: trace.afterIp.slice(0, 32), active: true },
      { label: 'R0', bits: trace.afterIp.slice(32), active: true },
    ];
  } else if (stage <= 17) {
    const r = trace.rounds[stage - 2];
    note = `Rodada ${r.round}: L${r.round} = R${r.round - 1}, e R${r.round} = L${r.round - 1} ⊕ f(R${r.round - 1}, K${trace.decrypt ? 17 - r.round : r.round}). A função f é detalhada em A.3 (escolha a rodada ${r.round}).`;
    caption = `Estado depois da rodada ${r.round} de 16`;
    rows = [
      { label: `L${r.round}`, bits: r.newL },
      { label: `R${r.round}`, bits: r.newR, active: true },
      { label: `f(R${r.round - 1}, K)`, bits: r.f },
    ];
  } else if (stage === 18) {
    note = 'Depois da rodada 16 as metades são trocadas (R16 vem antes de L16). Por isso decifrar é cifrar de novo com as subchaves em ordem inversa: a estrutura de Feistel é a sua própria inversa.';
    caption = 'Troca final das metades';
    rows = [{ label: 'R16 L16', bits: trace.preOutput, group: 8 }];
  } else {
    note = 'A permutação final (FP = IP⁻¹) desfaz a permutação inicial e produz o bloco de saída.';
    caption = trace.decrypt ? 'Texto claro recuperado' : 'Bloco cifrado';
    rows = [{ label: trace.decrypt ? 'Claro' : 'Cifra', bits: trace.output, group: 8, active: true }];
  }
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">A.2 O bloco: permutação inicial, 16 rodadas e permutação final</h3>
      <Stepper step={stage} total={STAGES} labelStart="Iniciar: permutação inicial" labelNext={stage === 17 ? 'Trocar as metades →' : stage === 18 ? 'Permutação final →' : stage === 1 ? 'Rodada 1 →' : 'Próxima rodada →'} onStep={setStage} />
      <p aria-live="polite" className="text-lg">{note}</p>
      <BitTable caption={caption} rows={rows} />
      {stage === 19 && isRfc && (
        <Callout variant="ok" title="Conferido com o exemplo clássico e com o OpenSSL">
          <p>
            A cifra de {RFC_BLOCK} com a chave {RFC_KEY} é {RFC_OUT}, o valor do exemplo detalhado em vários textos (como o de Stallings) e produzido também pelo OpenSSL.
          </p>
        </Callout>
      )}
    </div>
  );
}

type FStage = 'start' | 'E' | 'xor' | `S${number}` | 'P' | 'xorL';
const F_STAGES: FStage[] = ['start', 'E', 'xor', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'P', 'xorL'];

function FunctionViewer({ trace }: { trace: DesTrace }) {
  const [round, setRound] = useState(1);
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [trace]);
  const r = trace.rounds[round - 1];
  const st = F_STAGES[step];
  const sIdx = st.startsWith('S') ? Number(st.slice(1)) : st === 'P' || st === 'xorL' ? 8 : 0;
  let note = '';
  let caption = '';
  let rows: Parameters<typeof BitTable>[0]['rows'] = [];
  if (st === 'start') {
    note = `Entradas da função f na rodada ${round}: a metade direita R${round - 1} (32 bits) e a subchave de 48 bits. Pressione o botão para expandir R.`;
    caption = `Entradas de f na rodada ${round}`;
    rows = [{ label: `R${round - 1}`, bits: r.r }, { label: `K${trace.decrypt ? 17 - round : round}`, bits: r.subkey, group: 6, hex: false }];
  } else if (st === 'E') {
    note = `A expansão E repete 16 dos 32 bits (os das bordas de cada grupo de 4 aparecem também no grupo vizinho) e produz 48 bits, para casar com a subchave.`;
    caption = 'Expansão de R de 32 para 48 bits';
    rows = [{ label: `R${round - 1}`, bits: r.r }, { label: `E(R${round - 1})`, bits: r.expanded, group: 6, hex: false, active: true }];
  } else if (st === 'xor') {
    note = 'O único ponto em que a chave entra na função: XOR bit a bit da expansão com a subchave da rodada.';
    caption = 'Mistura com a subchave';
    rows = [{ label: `E(R${round - 1})`, bits: r.expanded, group: 6, hex: false }, { label: 'K', bits: r.subkey, group: 6, hex: false }, { label: 'E(R) ⊕ K', bits: r.mixed, group: 6, hex: false, active: true }];
  } else if (st.startsWith('S')) {
    const s = r.sboxes[sIdx - 1];
    note = `Caixa S${s.box}: os 6 bits de entrada ${[...s.input].join('')} formam a linha (primeiro e último bit: ${s.row}) e a coluna (quatro bits do meio: ${s.col}). A tabela S${s.box} nessa posição vale ${s.value}, ou ${[...s.output].join('')} em 4 bits. As caixas S são a única parte não linear do DES.`;
    caption = `Caixas S processadas até a S${sIdx}`;
    rows = r.sboxes.slice(0, sIdx).map((x) => ({ label: `S${x.box}(${[...x.input].join('')})`, bits: x.output, hex: false, active: x.box === sIdx, note: `linha ${x.row}, coluna ${x.col}` }));
  } else if (st === 'P') {
    note = 'As oito saídas de 4 bits formam 32 bits, que a permutação P embaralha para que cada caixa S influencie as entradas de várias caixas na rodada seguinte (difusão).';
    caption = 'Permutação P';
    rows = [{ label: 'saída das caixas S', bits: r.sOut }, { label: 'f = P(saída)', bits: r.f, active: true }];
  } else {
    note = `A saída de f sofre XOR com a metade esquerda L${round - 1}, e o resultado é a nova metade direita R${round}. A antiga R${round - 1} passa a ser a metade esquerda L${round}.`;
    caption = `Fim da rodada ${round}`;
    rows = [{ label: `L${round - 1}`, bits: r.l }, { label: 'f', bits: r.f }, { label: `R${round} = L${round - 1} ⊕ f`, bits: r.newR, active: true }, { label: `L${round} = R${round - 1}`, bits: r.newL }];
  }
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">A.3 A função f de uma rodada</h3>
      <div>
        <label htmlFor="des-round" className="mb-1 block text-base font-semibold">
          Rodada examinada
        </label>
        <select
          id="des-round"
          value={round}
          onChange={(e) => {
            setRound(Number(e.target.value));
            setStep(0);
          }}
          className="min-h-11 rounded-lg border border-line bg-surface px-3 text-lg"
        >
          {Array.from({ length: 16 }, (_, i) => (
            <option key={i} value={i + 1}>
              Rodada {i + 1}
            </option>
          ))}
        </select>
      </div>
      <Stepper step={step} total={F_STAGES.length - 1} labelStart="Iniciar: expandir R" labelNext={F_STAGES[step + 1] === 'S1' ? 'Caixa S1 →' : F_STAGES[step + 1]?.startsWith('S') ? `Caixa ${F_STAGES[step + 1]} →` : F_STAGES[step + 1] === 'P' ? 'Permutação P →' : F_STAGES[step + 1] === 'xorL' ? 'XOR com L →' : 'Próxima etapa →'} onStep={setStep} />
      <p aria-live="polite" className="text-lg">{note}</p>
      <BitTable caption={caption} rows={rows} />
    </div>
  );
}
