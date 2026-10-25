import { useEffect, useMemo, useState } from 'react';
import { QuarterWords, StateGrid } from '../../animations/ChaChaViz';
import { COLUMN_ROUNDS, DIAGONAL_ROUNDS, hex32, quarterRoundTrace, type ChaChaBlock, type QuarterStep } from '../../crypto/chacha20';
import { engines } from '../../crypto/local/chacha';
import { toHex } from '../../crypto/encoding';
import { randomBytes } from '../../crypto/random';
import { Callout, Field, LabSection, buttonClass } from '../../components/ui';

const RFC_WORDS = ['11111111', '01020304', '9b8d6f43', '01234567'];
const RFC_EXPECTED = ['ea2a92f4', 'cb1cf8ce', '4581472e', '5881c4bb'];
const RFC_KEY = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0')).join('');
const RFC_NONCE = '000000090000004a00000000';
const HEX_WORD = /^[0-9a-fA-F]{1,8}$/;
const fromHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));

const NAMES = { a: 'a', b: 'b', c: 'c', d: 'd' } as const;
const describe = (s: QuarterStep, i: number) => {
  const n = i + 1;
  if (s.op === 'add') return `Operação ${n} de 12: ${NAMES[s.target]} ← ${NAMES[s.target]} + ${NAMES[s.source]} (soma módulo 2³², o "vai-um" além do 32º bit é descartado).`;
  if (s.op === 'xor') return `Operação ${n} de 12: ${NAMES[s.target]} ← ${NAMES[s.target]} ⊕ ${NAMES[s.source]} (XOR bit a bit).`;
  return `Operação ${n} de 12: ${NAMES[s.target]} ← ${NAMES[s.target]} ⋘ ${s.rotate} (rotação à esquerda de ${s.rotate} bits: os bits que saem pela esquerda reentram pela direita).`;
};

function Stepper({ step, total, labelNext, labelStart, onStep }: { step: number; total: number; labelNext: string; labelStart: string; onStep: (i: number) => void }) {
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

function QuarterRoundViewer() {
  const [words, setWords] = useState(RFC_WORDS);
  const [step, setStep] = useState(0);
  const errs = words.map((w) => (HEX_WORD.test(w) ? null : 'Use de 1 a 8 dígitos hexadecimais (0 a 9, a a f).'));
  const valid = errs.every((e) => e === null);
  const trace = useMemo(() => (valid ? quarterRoundTrace(...(words.map((w) => parseInt(w, 16)) as [number, number, number, number])) : null), [words, valid]);
  const isRfc = valid && words.every((w, i) => parseInt(w, 16) === parseInt(RFC_WORDS[i], 16));

  const initial = valid ? words.map((w) => parseInt(w, 16) >>> 0) : [0, 0, 0, 0];
  const cur = trace && step > 0 ? trace[step - 1] : null;
  const values = cur ? [cur.a, cur.b, cur.c, cur.d] : initial;
  const changed = cur ? NAMES[cur.target] : null;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">A.1 O quarter round: 12 operações ARX</h3>
      <p className="text-lg">
        ARX significa <em>Add, Rotate, XOR</em>: o ChaCha20 usa apenas soma módulo 2³², rotação e XOR, operações rápidas em qualquer processador e sem tabelas (portanto sem ataques de tempo de acesso à
        memória). O <em>quarter round</em> mistura quatro palavras de 32 bits (a, b, c, d) com 12 operações. Edite as palavras e avance uma operação por vez.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(['a', 'b', 'c', 'd'] as const).map((n, i) => (
          <Field
            key={n}
            id={`qr-${n}`}
            label={`Palavra ${n} (hexadecimal)`}
            value={words[i]}
            onChange={(v) => {
              setWords(words.map((w, j) => (j === i ? v.trim() : w)));
              setStep(0);
            }}
            error={errs[i]}
            inputMode="text"
            maxLength={8}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setWords(RFC_WORDS);
            setStep(0);
          }}
        >
          Usar o vetor da RFC 8439 (seção 2.1.1)
        </button>
      </div>
      {trace ? (
        <>
          <Stepper step={step} total={12} labelStart="Iniciar: primeira operação" labelNext="Próxima operação →" onStep={setStep} />
          <p aria-live="polite" className="text-lg">
            {step === 0 ? 'Estado inicial das quatro palavras. Pressione o botão para executar a primeira operação.' : describe(trace[step - 1], step - 1)}
          </p>
          <QuarterWords
            caption={step === 0 ? 'Quatro palavras antes do quarter round' : `Quatro palavras depois da operação ${step}`}
            words={(['a', 'b', 'c', 'd'] as const).map((n, i) => ({ name: n, value: values[i], active: changed === n }))}
          />
          {step === 12 && isRfc && (
            <Callout variant="ok" title="Conferido com a RFC 8439">
              <p>
                O resultado ({values.map(hex32).join(', ')}) é exatamente o vetor de teste da seção 2.1.1: {RFC_EXPECTED.join(', ')}.
              </p>
            </Callout>
          )}
        </>
      ) : (
        <p className="text-lg text-muted">Corrija as palavras para iniciar.</p>
      )}
    </div>
  );
}

const STAGES = 22; // 0 = estado inicial; 1..20 = rodadas; 21 = soma final; 22 = fluxo de chaves

function BlockStages() {
  const [keyHex, setKeyHex] = useState(RFC_KEY);
  const [nonceHex, setNonceHex] = useState(RFC_NONCE);
  const [counter, setCounter] = useState('1');
  const [stage, setStage] = useState(0);
  const [block, setBlock] = useState<ChaChaBlock | null>(null);

  const keyErr = /^[0-9a-fA-F]{64}$/.test(keyHex) ? null : 'A chave tem 64 dígitos hexadecimais (32 bytes).';
  const nonceErr = /^[0-9a-fA-F]{24}$/.test(nonceHex) ? null : 'O nonce tem 24 dígitos hexadecimais (12 bytes).';
  const counterErr = /^\d{1,10}$/.test(counter) && Number(counter) <= 0xffffffff ? null : 'O contador é um inteiro de 0 a 4294967295.';
  const err = keyErr ?? nonceErr ?? counterErr;

  useEffect(() => {
    if (err) {
      setBlock(null);
      return;
    }
    let cancelled = false;
    engines.chacha.block(fromHex(keyHex), fromHex(nonceHex), Number(counter)).then((b) => {
      if (!cancelled) {
        setBlock(b);
        setStage(0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [keyHex, nonceHex, counter, err]);

  const isRfc = keyHex.toLowerCase() === RFC_KEY && nonceHex === RFC_NONCE && counter === '1';
  let state: number[] = [];
  let caption = '';
  let note = '';
  let highlight: number[] = [];
  if (block) {
    if (stage === 0) {
      state = block.initial;
      caption = 'Estado inicial: constantes, chave, contador e nonce';
      note = 'O estado tem 16 palavras de 32 bits: 4 constantes ("expand 32-byte k"), 8 palavras da chave, 1 contador e 3 palavras do nonce. Pressione o botão para executar a primeira rodada.';
    } else if (stage <= 20) {
      const r = block.rounds[stage - 1];
      state = r.state;
      caption = `Estado depois da rodada ${r.round} de 20 (${r.kind})`;
      const sets = r.kind === 'coluna' ? COLUMN_ROUNDS : DIAGONAL_ROUNDS;
      note = `Rodada ${r.round}: quatro quarter rounds independentes, ${r.kind === 'coluna' ? 'um em cada coluna da matriz' : 'um em cada diagonal da matriz'} (palavras ${sets.map((s) => `(${s.join(', ')})`).join(', ')}). As rodadas alternam coluna e diagonal para que cada palavra afete todas as outras (difusão).`;
      highlight = sets.flat();
    } else if (stage === 21) {
      state = block.final;
      caption = 'Estado final: estado misturado + estado inicial (palavra a palavra, módulo 2³²)';
      note = 'A soma com o estado inicial torna a função de bloco irreversível: sem ela, bastaria rodar as rodadas ao contrário para recuperar a chave.';
    } else {
      state = block.final;
      caption = 'Estado final serializado em 64 bytes (cada palavra em little-endian)';
      note = 'Estes 64 bytes são o fluxo de chaves deste bloco. O XOR com a mensagem produz a cifra. O próximo bloco usa o contador + 1.';
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">A.2 O bloco: 20 rodadas e a soma final</h3>
      <p className="text-lg">
        Para cada bloco de 64 bytes do fluxo de chaves, o ChaCha20 monta o estado, aplica 20 rodadas (10 pares coluna/diagonal) e soma o resultado ao estado inicial. O contador muda a cada bloco e o
        nonce muda a cada mensagem.
      </p>
      <Field id="cc-key" label="Chave (32 bytes em hexadecimal)" value={keyHex} onChange={(v) => setKeyHex(v.trim())} error={keyErr} inputMode="text" maxLength={64} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="cc-nonce" label="Nonce (12 bytes em hexadecimal)" value={nonceHex} onChange={(v) => setNonceHex(v.trim())} error={nonceErr} inputMode="text" maxLength={24} />
        <Field id="cc-counter" label="Contador do bloco" value={counter} onChange={(v) => setCounter(v.trim())} error={counterErr} />
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setKeyHex(toHex(randomBytes(32)));
            setNonceHex(toHex(randomBytes(12)));
          }}
        >
          Sortear chave e nonce (aleatório seguro)
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setKeyHex(RFC_KEY);
            setNonceHex(RFC_NONCE);
            setCounter('1');
          }}
        >
          Usar o vetor da RFC 8439 (seção 2.3.2)
        </button>
      </div>
      {block ? (
        <>
          <Stepper step={stage} total={STAGES} labelStart="Iniciar: primeira rodada" labelNext={stage === 20 ? 'Somar com o estado inicial →' : stage === 21 ? 'Ver o fluxo de chaves →' : 'Próxima rodada →'} onStep={setStage} />
          <p aria-live="polite" className="text-lg">
            {note}
          </p>
          <StateGrid state={state} highlight={highlight} caption={caption} />
          {stage === 22 && (
            <p className="break-all rounded-xl border border-line bg-surface p-3 font-mono text-base">
              <span className="font-sans font-semibold">Fluxo de chaves (64 bytes): </span>
              {toHex(block.keystream)}
            </p>
          )}
          {stage === 22 && isRfc && (
            <Callout variant="ok" title="Conferido com a RFC 8439">
              <p>Os 64 bytes começam por 10f1e7e4 d13b5915 500fdd1f a32071c4, como no vetor de teste da seção 2.3.2.</p>
            </Callout>
          )}
        </>
      ) : (
        <p className="text-lg text-muted">Corrija os parâmetros para iniciar.</p>
      )}
    </div>
  );
}

export function BlockViewer() {
  return (
    <LabSection id="cc-bloco" title="3. Parte A: o ChaCha20 operação por operação">
      <div className="space-y-10">
        <QuarterRoundViewer />
        <BlockStages />
      </div>
    </LabSection>
  );
}

