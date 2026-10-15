import { useEffect, useMemo, useState } from 'react';
import { FrequencyChart } from '../../animations/FrequencyChart';
import { PadTable } from '../../animations/PadTable';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { ALPHABET, letterPercentages, normalizeText, PT_FREQUENCY } from '../../crypto/classical';
import { CryptoInputError } from '../../crypto/bigmath';
import { engines } from '../../crypto/engines';
import { keyForTarget, otpDecrypt, randomPad, validatePad } from '../../crypto/otp';
import { IC_PORTUGUESE, IC_RANDOM } from '../../crypto/substitution';
import { Callout, Field, LabSection, buttonClass } from '../../components/ui';
import { buildOtpProtocol, defaultDecoy, MAX_LETTERS, runOtp, type OtpRun } from './flows';

const EXAMPLE_TEXT = 'Atacar a ponte ao amanhecer sem avisar ninguém';
const num = (v: number, d = 4) => v.toFixed(d).replace('.', ',');

const problem = (fn: () => void): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof CryptoInputError ? e.message : 'Valor inválido.';
  }
};

function LetterStepper({ run, index, onIndex }: { run: OtpRun; index: number | null; onIndex: (i: number | null) => void }) {
  const n = run.plainLetters.length;
  const p = index === null ? 0 : ALPHABET.indexOf(run.plainLetters[index]);
  const k = index === null ? 0 : ALPHABET.indexOf(run.keyLetters[index]);
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-xl font-bold">Cifrar letra a letra</h3>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonClass} disabled={index === null || index === 0} onClick={() => onIndex(index === null || index <= 0 ? null : index - 1)}>
          ← Letra anterior
        </button>
        <button type="button" className={buttonClass} disabled={index !== null && index >= n - 1} onClick={() => onIndex(index === null ? 0 : Math.min(n - 1, index + 1))}>
          {index === null ? 'Começar pela primeira letra' : 'Próxima letra →'}
        </button>
      </div>
      <p aria-live="polite" className="text-lg">
        {index === null ? (
          'Use os botões para ver a soma de cada letra da mensagem com a letra da chave na mesma posição.'
        ) : (
          <>
            Letra {index + 1} de {n}: P = <span className="font-mono font-bold">{run.plainLetters[index]}</span> ({p}), K = <span className="font-mono font-bold">{run.keyLetters[index]}</span> ({k}).{' '}
            <span className="font-mono">C = ({p} + {k}) mod 26 = {p + k} mod 26 = {(p + k) % 26}</span> → <span className="font-mono font-bold">{ALPHABET[(p + k) % 26]}</span>
          </>
        )}
      </p>
      <p className="break-all font-mono text-base text-muted">Cifra até aqui: {index === null ? '(vazia)' : run.cipherLetters.slice(0, index + 1)}</p>
    </div>
  );
}

export function CorrectPanel() {
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [key, setKey] = useState(() => randomPad(normalizeText(EXAMPLE_TEXT).length));
  const [tamper, setTamper] = useState(false);
  const [decoy, setDecoy] = useState<string | null>(null);
  const [letter, setLetter] = useState<number | null>(null);
  const [run, setRun] = useState<OtpRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const n = normalizeText(text).length;
  const keyErr = n > 0 ? problem(() => validatePad(key, n)) : null;
  const effectiveDecoy = normalizeText(decoy ?? defaultDecoy(n));
  const decoyErr = n > 0 && effectiveDecoy.length !== n ? `O texto candidato deve ter exatamente ${n} letras (o mesmo tamanho da mensagem), mas tem ${effectiveDecoy.length}.` : null;

  useEffect(() => {
    if (n === 0 || keyErr) {
      setRun(null);
      setError(n === 0 ? 'Digite ao menos uma letra (A a Z).' : null);
      return;
    }
    let cancelled = false;
    // um candidato inválido não derruba a animação: usa-se o candidato padrão e o erro aparece junto ao campo
    runOtp(engines.classical, { text, key, tamper, decoy: decoyErr ? null : decoy })
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
          setLetter(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setRun(null);
          setError(e instanceof Error ? e.message : 'Falha ao cifrar.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [text, key, tamper, decoy, n, keyErr, decoyErr]);

  const definition = useMemo(() => (run ? buildOtpProtocol(run.flow) : null), [run]);
  const percents = useMemo(() => (run ? letterPercentages(run.cipherLetters) : null), [run]);
  const check = useMemo(() => {
    if (!run || decoyErr) return null;
    return { key2: run.decoyKey, back: otpDecrypt(run.decoyKey, run.cipherLetters), same: keyForTarget(run.cipherLetters, run.plainLetters) === run.keyLetters };
  }, [run, decoyErr]);

  return (
    <>
      <Callout variant="ok" title="Sigilo perfeito, sob quatro condições">
        <p>
          O one-time pad é o único cifrador comprovadamente inquebrável, <strong>se</strong> a chave for aleatória, tão longa quanto a mensagem, usada uma única vez e mantida em segredo. Nenhuma
          dessas condições é opcional.
        </p>
      </Callout>

      <LabSection id="otp-params" title="3. Parâmetros configuráveis">
        <div>
          <label htmlFor="otp-text" className="mb-1 block text-base font-semibold">
            Mensagem de Alice
          </label>
          <textarea id="otp-text" value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-describedby="otp-text-hint" className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
          <p id="otp-text-hint" className="mt-1 text-base text-muted">
            O texto é normalizado (maiúsculas, sem acentos, espaços ou pontuação; até {MAX_LETTERS} letras). A mensagem tem {n} {n === 1 ? 'letra' : 'letras'}.
          </p>
        </div>
        <Field
          id="otp-key"
          label={`Chave (pad): ${n} letras, no mínimo`}
          value={key}
          onChange={(v) => setKey(v.toUpperCase())}
          error={keyErr}
          hint="Sorteada com aleatoriedade criptográfica. Experimente encurtá-la: o one-time pad exige uma chave tão longa quanto a mensagem."
          inputMode="text"
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => setKey(randomPad(Math.max(1, n)))}>
            Sortear chave do tamanho da mensagem (aleatório seguro)
          </button>
        </div>
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
          Eva altera uma letra da cifra em trânsito (maleabilidade)
        </label>
        {error && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {error}
          </p>
        )}
      </LabSection>

      <LabSection id="otp-viz" title="4. Visualização animada">
        {run && !keyErr ? (
          <div className="space-y-6">
            <PadTable
              index={letter}
              caption="Texto claro, chave e cifra, alinhados por posição (a coluna atual aparece destacada)"
              rows={[
                { label: 'Texto claro P', letters: run.plainLetters, kind: 'plain' },
                { label: 'Chave K', letters: run.keyLetters.slice(0, run.plainLetters.length), kind: 'secret' },
                { label: 'Cifra C', letters: run.cipherLetters, kind: 'cipher' },
              ]}
            />
            <LetterStepper run={run} index={letter} onIndex={setLetter} />
            {definition && <ProtocolPlayer definition={definition} resetKey={`${run.keyLetters}|${run.cipherLetters}|${run.flow.tampered}|${run.decoyLetters}`} />}
          </div>
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>

      {run && percents && (
        <>
          <LabSection id="otp-eva" title="5. Criptoanálise de Eva">
            <div className="space-y-6">
              <section aria-labelledby="otp-eva-1" className="space-y-3">
                <h3 id="otp-eva-1" className="text-xl font-bold">
                  5.1 Sigilo perfeito: qualquer texto é possível
                </h3>
                <p className="text-lg">
                  Há <strong>{run.flow.possible}</strong> textos possíveis de {run.flow.nLetters} letras (26<sup>{run.flow.nLetters}</sup>) e todos são igualmente prováveis. Para cada candidato T, a chave
                  <span className="font-mono"> K′ = C − T </span> existe. Escreva um candidato e veja:
                </p>
                <Field
                  id="otp-decoy"
                  label={`Texto candidato de Eva (${n} letras)`}
                  value={decoy ?? effectiveDecoy}
                  onChange={(v) => setDecoy(v.toUpperCase())}
                  error={decoyErr}
                  inputMode="text"
                />
                <div className="flex flex-wrap gap-3">
                  <button type="button" className={buttonClass} onClick={() => setDecoy(run.plainLetters)}>
                    Usar a mensagem verdadeira como candidato
                  </button>
                  <button type="button" className={buttonClass} onClick={() => setDecoy(null)}>
                    Usar o candidato padrão
                  </button>
                </div>
                {check && (
                  <dl className="space-y-2 rounded-xl border border-line bg-surface p-4 text-base">
                    <div>
                      <dt className="font-semibold">Chave K′ que levaria a cifra a esse candidato</dt>
                      <dd className="break-all font-mono text-lg">{check.key2}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Verificação: decifrar C com K′</dt>
                      <dd className="break-all font-mono text-lg">{check.back}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">A chave verdadeira de Alice e Bob (Eva não a vê)</dt>
                      <dd className="break-all font-mono text-lg">{run.keyLetters}</dd>
                    </div>
                  </dl>
                )}
                <p className="text-lg">
                  A chave K′ é tão aleatória quanto a verdadeira. Nada na cifra permite a Eva preferir um candidato a outro: <strong>ela só aprende o tamanho da mensagem</strong>. Experimente o candidato
                  verdadeiro: a chave K′ coincide com a real, mas Eva não tem como saber que é a real.
                </p>
              </section>

              <section aria-labelledby="otp-eva-2" className="space-y-3">
                <h3 id="otp-eva-2" className="text-xl font-bold">
                  5.2 A estatística da cifra
                </h3>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Texto claro', num(run.flow.icPlain)],
                    ['Texto cifrado', num(run.flow.icCipher)],
                    ['Português (referência)', num(IC_PORTUGUESE)],
                    ['Aleatório (referência)', num(IC_RANDOM)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-line bg-surface p-3">
                      <dt className="text-base text-muted">{k}</dt>
                      <dd className="font-mono text-xl font-bold">{v}</dd>
                    </div>
                  ))}
                </dl>
                <FrequencyChart observed={percents} expected={PT_FREQUENCY} observedLabel="texto cifrado capturado por Eva" expectedLabel="língua portuguesa" />
                <p className="text-lg">Em mensagens curtas as barras oscilam ao acaso, mas não há estrutura: a cifra é indistinguível de letras sorteadas.</p>
              </section>

              <section aria-labelledby="otp-eva-3" className="space-y-2">
                <h3 id="otp-eva-3" className="text-xl font-bold">
                  5.3 O que o one-time pad exige, e o que não oferece
                </h3>
                <ul className="list-disc space-y-1 pl-6 text-lg">
                  <li>
                    <strong>Chave aleatória:</strong> uma chave gerada por algoritmo previsível reintroduz estrutura.
                  </li>
                  <li>
                    <strong>Tão longa quanto a mensagem:</strong> chave repetida vira Vigenère.
                  </li>
                  <li>
                    <strong>Uso único:</strong> a reutilização destrói o sigilo (próxima aba do laboratório).
                  </li>
                  <li>
                    <strong>Secreta:</strong> distribuir chaves tão longas por um canal seguro é o custo prático que o tornou raro.
                  </li>
                  <li>
                    <strong>Sem integridade:</strong> a cifra é maleável. Marque "Eva altera uma letra" e acompanhe: Bob decifra a letra escolhida por Eva, sem erro algum.
                  </li>
                </ul>
                {run.flow.tampered && (
                  <p role="status" className="rounded-xl border-2 border-danger bg-danger/10 p-4 text-lg font-semibold text-danger">
                    Eva trocou {run.flow.tamperOld} por {run.flow.tamperNew} na posição {run.flow.tamperPosition} sem conhecer a chave, e Bob decifrou {run.flow.tamperNew} sem perceber.
                  </p>
                )}
              </section>
            </div>
          </LabSection>

          <LabSection id="otp-results" title="6. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultados da cifragem e da análise de Eva</caption>
                <tbody>
                  <Row label="Mensagem (letras)" value={String(run.flow.nLetters)} />
                  <Row label="Texto claro" value={run.flow.plain} mono />
                  <Row label="Chave (pad)" value={run.keyLetters} mono />
                  <Row label="Texto cifrado" value={run.flow.cipherText} mono />
                  {run.flow.tampered && <Row label="Cifra recebida por Bob (alterada por Eva)" value={run.flow.receivedText} mono />}
                  <Row label="Mensagem recuperada por Bob" value={run.flow.recovered} mono />
                  <Row label="Textos possíveis para Eva" value={`${run.flow.possible} (26^${run.flow.nLetters})`} />
                  <Row label="Incerteza de Eva sobre a mensagem" value={`${run.flow.entropy.toFixed(1).replace('.', ',')} bits`} />
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Eva leu a mensagem?</th>
                    <td className="py-2 font-semibold text-k-secret">Não: a cifra não revela nada além do tamanho</td>
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
