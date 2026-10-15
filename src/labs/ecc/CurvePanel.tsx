import { useMemo, useState } from 'react';
import { CurvePlot } from '../../animations/CurvePlot';
import { addTrace, scalarMul, scalarMulTrace, showPoint, TOY_CURVE as C, type Point } from '../../crypto/ecc';
import { Callout, Field, LabSection, buttonClass } from '../../components/ui';

const N = Number(C.n);
const mult = (k: number): Point => scalarMul(C, BigInt(k), C.G);

function Stepper({ step, total, labelStart, labelNext, onStep }: { step: number; total: number; labelStart: string; labelNext: string; onStep: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" className={buttonClass} disabled={step === 0} onClick={() => onStep(step - 1)}>
        ← Voltar
      </button>
      <button type="button" className={buttonClass} disabled={step >= total} onClick={() => onStep(step + 1)}>
        {step === 0 ? labelStart : labelNext}
      </button>
      <button type="button" className={buttonClass} disabled={step === 0} onClick={() => onStep(0)}>
        Reiniciar
      </button>
    </div>
  );
}

const parse = (v: string): number | null => (/^\d{1,3}$/.test(v) ? Number(v) : null);

/** Soma de dois pontos, uma conta por vez. */
function AddViewer() {
  const [kp, setKp] = useState('1');
  const [kq, setKq] = useState('3');
  const [step, setStep] = useState(0);
  const p = parse(kp);
  const q = parse(kq);
  const errP = p === null || p < 1 || p > N ? `Use um inteiro de 1 a ${N} (${N} = ponto no infinito).` : null;
  const errQ = q === null || q < 1 || q > N ? `Use um inteiro de 1 a ${N} (${N} = ponto no infinito).` : null;
  const P = errP ? null : mult(p!);
  const Q = errQ ? null : mult(q!);
  const t = useMemo(() => (errP || errQ ? null : addTrace(C, P, Q)), [errP, errQ, P, Q]);
  const isFinite = t && (t.kind === 'soma' || t.kind === 'dobro');
  const total = isFinite ? 4 : 1;

  let note = 'Escolha dois pontos (como múltiplos de G) e avance uma conta por vez.';
  if (t && step > 0) {
    if (!isFinite) {
      note =
        t.kind === 'identidade'
          ? 'Um dos pontos é o infinito (elemento neutro): P + O = P.'
          : t.kind === 'oposto'
            ? 'Os pontos têm o mesmo x e y opostos (Q = −P): a reta é vertical e a soma é o ponto no infinito.'
            : 'O ponto tem y = 0: a tangente é vertical e o dobro é o ponto no infinito.';
    } else if (step === 1) {
      note = t.kind === 'dobro' ? `Dobro: inclinação da tangente λ = (3x² + a)/(2y). Numerador 3·${t.P!.x}² + ${C.a} = ${t.numerator} (mod ${C.p}); denominador 2·${t.P!.y} = ${t.denominator}.` : `Soma: inclinação da reta λ = (y₂ − y₁)/(x₂ − x₁). Numerador ${t.Q!.y} − ${t.P!.y} = ${t.numerator} (mod ${C.p}); denominador ${t.Q!.x} − ${t.P!.x} = ${t.denominator}.`;
    } else if (step === 2) {
      note = `Divisão módulo ${C.p} é multiplicar pelo inverso: ${t.denominator}⁻¹ = ${t.inverse}, logo λ = ${t.numerator} · ${t.inverse} = ${t.lambda} (mod ${C.p}).`;
    } else if (step === 3) {
      note = `x₃ = λ² − x₁ − x₂ = ${t.lambda}² − ${t.P!.x} − ${t.Q!.x} = ${t.R!.x} (mod ${C.p}).`;
    } else {
      note = `y₃ = λ (x₁ − x₃) − y₁ = ${t.lambda} · (${t.P!.x} − ${t.R!.x}) − ${t.P!.y} = ${t.R!.y} (mod ${C.p}). Resultado: R = ${showPoint(t.R)}.`;
    }
  }
  const marks = [
    ...(P ? [{ point: P, label: 'P', tone: 'p' as const }] : []),
    ...(Q && !(P && Q && P.x === Q.x && P.y === Q.y) ? [{ point: Q, label: 'Q', tone: 'q' as const }] : []),
    ...(t && step >= total && t.R ? [{ point: t.R, label: 'R', tone: 'r' as const }] : []),
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">A.2 Somar dois pontos</h3>
      <p className="text-lg">Na curva elíptica, "somar" P e Q é definir um terceiro ponto R por uma construção geométrica, traduzida em contas módulo {String(C.p)}.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ec-kp" label="P = k · G, com k =" value={kp} onChange={(v) => { setKp(v.trim()); setStep(0); }} error={errP} hint={P !== null || !errP ? `P = ${showPoint(P)}` : undefined} />
        <Field id="ec-kq" label="Q = k · G, com k =" value={kq} onChange={(v) => { setKq(v.trim()); setStep(0); }} error={errQ} hint={Q !== null || !errQ ? `Q = ${showPoint(Q)}` : undefined} />
      </div>
      {t && (
        <>
          <Stepper step={step} total={total} labelStart="Iniciar: primeira conta" labelNext="Próxima conta →" onStep={setStep} />
          <p aria-live="polite" className="text-lg">
            {note}
          </p>
          {step >= total && <p className="rounded-xl border border-line bg-surface p-3 font-mono text-lg">P + Q = {showPoint(t.R)}</p>}
          <CurvePlot curve={C} marks={marks} />
        </>
      )}
    </div>
  );
}

/** Multiplicação escalar por dobrar e somar. */
function MulViewer() {
  const [kk, setKk] = useState('13');
  const [step, setStep] = useState(0);
  const k = parse(kk);
  const err = k === null || k < 1 || k > 200 ? 'Use um inteiro de 1 a 200.' : null;
  const t = useMemo(() => (err ? null : scalarMulTrace(C, BigInt(k!), C.G)), [err, k]);
  const cur = t && step > 0 ? t.steps[step - 1] : null;
  const acc = cur ? cur.after : null;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">A.3 A multiplicação escalar: k · G</h3>
      <p className="text-lg">
        Calcular k · G é somar G a si mesmo k vezes, mas o algoritmo <em>dobrar e somar</em> lê os bits de k da esquerda para a direita: dobra o acumulador a cada bit e soma G quando o bit é 1.
        Para um k de 256 bits são cerca de 256 dobras. Já o caminho inverso, descobrir k a partir de k · G, é o <strong>logaritmo discreto</strong>, sem atalho conhecido numa curva grande.
      </p>
      <Field id="ec-k" label="Escalar k (inteiro de 1 a 200)" value={kk} onChange={(v) => { setKk(v.trim()); setStep(0); }} error={err} hint={t ? `k em binário: ${t.bits}; k mod ${N} = ${k! % N}` : undefined} />
      {t && (
        <>
          <Stepper step={step} total={t.steps.length} labelStart="Iniciar: primeiro bit" labelNext="Próxima operação →" onStep={setStep} />
          <p aria-live="polite" className="text-lg">
            {cur
              ? `Bit ${cur.bitIndex + 1} de ${t.bits.length} (${cur.bit}): ${cur.op === 'dobrar' ? 'dobrar' : 'somar G'}. ${showPoint(cur.before)} ${cur.op === 'dobrar' ? '+' : '+'} ${cur.op === 'dobrar' ? showPoint(cur.before) : showPoint(C.G)} = ${showPoint(cur.after)}.`
              : 'Acumulador inicial: o ponto no infinito (O). Pressione o botão para ler o primeiro bit de k.'}
          </p>
          {step >= t.steps.length && <p className="rounded-xl border border-line bg-surface p-3 font-mono text-lg">{k} · G = {showPoint(t.result)}</p>}
          <CurvePlot curve={C} marks={acc ? [{ point: acc, label: 'acc', tone: 'r' }, { point: C.G, label: 'G', tone: 'p' }] : [{ point: C.G, label: 'G', tone: 'p' }]} />
        </>
      )}
    </div>
  );
}

export function CurvePanel() {
  return (
    <LabSection id="ec-curva" title="3. Parte A: a curva e a aritmética de pontos">
      <div className="space-y-10">
        <div className="space-y-4">
          <h3 className="text-xl font-bold">A.1 A curva didática</h3>
          <p className="text-lg">
            Usamos a curva <span className="font-mono">{C.name}</span>, cujo conjunto de pontos forma um grupo de ordem {N} (prima) gerado por G = {showPoint(C.G)}. Sobre um corpo finito a curva é um conjunto de pontos isolados. O
            ponto no infinito O é o elemento neutro.
          </p>
          <CurvePlot curve={C} marks={[{ point: C.G, label: 'G', tone: 'p' }]} />
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-base">
              <caption className="mb-1 text-left font-sans text-base text-muted">Os {N} elementos do grupo: k · G para k = 1, ..., {N}</caption>
              <thead>
                <tr className="border-b border-line font-sans">
                  <th scope="col" className="py-1 pr-3">k</th>
                  <th scope="col" className="py-1">k · G</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: N }, (_, i) => i + 1).map((k) => (
                  <tr key={k} className="border-b border-line">
                    <th scope="row" className="py-0.5 pr-3 font-normal">{k}</th>
                    <td className="py-0.5">{showPoint(mult(k))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout variant="danger" title="Curva minúscula: não oferece segurança">
            <p>Com só {N} elementos, qualquer chave cai por tentativa. Curvas reais (P-256, Curve25519) têm ordem de cerca de 2²⁵² a 2²⁵⁶.</p>
          </Callout>
        </div>
        <AddViewer />
        <MulViewer />
      </div>
    </LabSection>
  );
}
