import { useEffect, useMemo, useState } from 'react';
import { PadTable } from '../../animations/PadTable';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { ALPHABET, normalizeText } from '../../crypto/classical';
import { CryptoInputError } from '../../crypto/bigmath';
import { engines } from '../../crypto/engines';
import { randomPad, validatePad } from '../../crypto/otp';
import { Callout, Field, LabSection, Tabs, buttonClass } from '../../components/ui';
import { buildReuseProtocol, MAX_LETTERS, runReuse, type ReuseRun } from './flows';

const TEXT1 = 'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma e a nossa melhor defesa';
const TEXT2 = 'O diretor da escola reuniu os professores na sala principal para discutir o calendário das provas do próximo semestre com todos';
const fmt = (v: number) => v.toFixed(2).replace('.', ',');

const problem = (fn: () => void): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof CryptoInputError ? e.message : 'Valor inválido.';
  }
};

function PositionStepper({ run, index, onIndex }: { run: ReuseRun; index: number | null; onIndex: (i: number | null) => void }) {
  const n = Math.min(run.plain1.length, run.plain2.length);
  const row = (label: string, plain: string, cipher: string) => {
    const p = ALPHABET.indexOf(plain[index!]);
    const k = ALPHABET.indexOf(run.key[index!]);
    return (
      <li key={label}>
        {label}: P = <span className="font-mono font-bold">{plain[index!]}</span> ({p}), K = <span className="font-mono font-bold">{run.key[index!]}</span> ({k}): C = {(p + k) % 26} →{' '}
        <span className="font-mono font-bold">{cipher[index!]}</span>
      </li>
    );
  };
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-xl font-bold">Cifrar posição a posição, com a mesma chave</h3>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonClass} disabled={index === null || index === 0} onClick={() => onIndex(index === null || index <= 0 ? null : index - 1)}>
          ← Posição anterior
        </button>
        <button type="button" className={buttonClass} disabled={index !== null && index >= n - 1} onClick={() => onIndex(index === null ? 0 : Math.min(n - 1, index + 1))}>
          {index === null ? 'Começar pela primeira posição' : 'Próxima posição →'}
        </button>
      </div>
      <div aria-live="polite" className="text-lg">
        {index === null ? (
          <p>Use os botões para ver as duas mensagens somando, na mesma posição, a mesma letra de chave.</p>
        ) : (
          <>
            <p>
              Posição {index + 1} de {n}: a chave <span className="font-mono font-bold">{run.key[index]}</span> é usada nas duas mensagens.
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-6">
              {row('Mensagem 1', run.plain1, run.cipher1)}
              {row('Mensagem 2', run.plain2, run.cipher2)}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export function ReusePanel() {
  const [text1, setText1] = useState(TEXT1);
  const [text2, setText2] = useState(TEXT2);
  const [key, setKey] = useState(() => randomPad(Math.max(normalizeText(TEXT1).length, normalizeText(TEXT2).length)));
  const [crib, setCrib] = useState('AMANHECER');
  const [cribIn, setCribIn] = useState<'1' | '2'>('1');
  const [pos, setPos] = useState<number | null>(null);
  const [run, setRun] = useState<ReuseRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const n1 = normalizeText(text1).length;
  const n2 = normalizeText(text2).length;
  const need = Math.max(n1, n2, 1);
  const keyErr = n1 > 0 && n2 > 0 ? problem(() => validatePad(key, need)) : null;

  useEffect(() => {
    if (n1 === 0 || n2 === 0 || keyErr) {
      setRun(null);
      setError(n1 === 0 || n2 === 0 ? 'Digite ao menos uma letra (A a Z) em cada mensagem.' : null);
      return;
    }
    let cancelled = false;
    runReuse(engines.classical, { text1, text2, key, crib, cribIn: cribIn === '1' ? 1 : 2 })
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
          setPos(null);
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
  }, [text1, text2, key, crib, cribIn, n1, n2, keyErr]);

  const definition = useMemo(() => (run ? buildReuseProtocol(run.flow) : null), [run]);
  const diffCheck = useMemo(() => {
    if (!run) return null;
    const L = Math.min(run.plain1.length, run.plain2.length);
    return [...run.plain1.slice(0, L)].map((ch, i) => ALPHABET[(ALPHABET.indexOf(run.plain2[i]) - ALPHABET.indexOf(ch) + 26) % 26]).join('');
  }, [run]);

  return (
    <>
      <Callout variant="danger" title="O erro fatal: reutilizar a chave (two-time pad)">
        <p>
          A chave foi sorteada e é secreta, mas Alice a usa em <strong>duas</strong> mensagens. Essa única violação das quatro condições basta para destruir o sigilo perfeito.
        </p>
      </Callout>

      <LabSection id="reuse-params" title="3. Parâmetros configuráveis">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="reuse-t1" className="mb-1 block text-base font-semibold">
              Mensagem 1 de Alice
            </label>
            <textarea id="reuse-t1" value={text1} onChange={(e) => setText1(e.target.value)} rows={3} className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
            <p className="mt-1 text-base text-muted">{n1} letras</p>
          </div>
          <div>
            <label htmlFor="reuse-t2" className="mb-1 block text-base font-semibold">
              Mensagem 2 de Alice
            </label>
            <textarea id="reuse-t2" value={text2} onChange={(e) => setText2(e.target.value)} rows={3} className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
            <p className="mt-1 text-base text-muted">{n2} letras. Eva trabalha na região comum às duas ({Math.min(n1, n2)} letras), até {MAX_LETTERS}.</p>
          </div>
        </div>
        <Field
          id="reuse-key"
          label={`Chave (pad) usada nas DUAS mensagens: ${need} letras, no mínimo`}
          value={key}
          onChange={(v) => setKey(v.toUpperCase())}
          error={keyErr}
          hint="Sorteada com aleatoriedade criptográfica."
          inputMode="text"
        />
        <button type="button" className={buttonClass} onClick={() => setKey(randomPad(need))}>
          Sortear chave do tamanho da maior mensagem (aleatório seguro)
        </button>
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <Field id="reuse-crib" label="Texto provável de Eva (crib)" value={crib} onChange={(v) => setCrib(v.toUpperCase())} hint="Uma palavra que Eva suspeita estar em uma das mensagens. Quanto mais longa, mais certeiro o alinhamento." inputMode="text" maxLength={30} />
          <div>
            <p className="mb-1 text-base font-semibold">O texto provável está na</p>
            <Tabs
              label="Mensagem do texto provável"
              value={cribIn}
              onChange={setCribIn}
              tabs={[
                { id: '1', label: 'Mensagem 1' },
                { id: '2', label: 'Mensagem 2' },
              ]}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {error}
          </p>
        )}
      </LabSection>

      <LabSection id="reuse-viz" title="4. Visualização animada">
        {run && !keyErr ? (
          <div className="space-y-6">
            <PadTable
              index={pos}
              caption="As duas mensagens, a mesma chave e as duas cifras, alinhadas por posição"
              rows={[
                { label: 'Texto claro 1', letters: run.plain1, kind: 'plain' },
                { label: 'Texto claro 2', letters: run.plain2, kind: 'plain' },
                { label: 'Chave K (a mesma)', letters: run.key.slice(0, Math.max(run.plain1.length, run.plain2.length)), kind: 'secret' },
                { label: 'Cifra 1', letters: run.cipher1, kind: 'cipher' },
                { label: 'Cifra 2', letters: run.cipher2, kind: 'cipher' },
              ]}
            />
            <PositionStepper run={run} index={pos} onIndex={setPos} />
            {definition && <ProtocolPlayer definition={definition} resetKey={`${run.key}|${run.cipher1}|${run.cipher2}|${run.flow.crib}|${run.flow.cribIn}`} />}
          </div>
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>
        )}
      </LabSection>

      {run && diffCheck && (
        <>
          <LabSection id="reuse-eva" title="5. Criptoanálise de Eva">
            <div className="space-y-6">
              <section aria-labelledby="reuse-eva-1" className="space-y-3">
                <h3 id="reuse-eva-1" className="text-xl font-bold">
                  5.1 A chave desaparece
                </h3>
                <p className="text-lg">
                  <span className="font-mono">C2 − C1 = (P2 + K) − (P1 + K) = P2 − P1</span>. A subtração das duas cifras elimina a chave e deixa uma relação entre dois textos em português.
                </p>
                <PadTable
                  index={pos}
                  caption="A diferença das cifras (calculada por Eva) é igual à diferença dos textos claros (que ela não conhece)"
                  rows={[
                    { label: 'D = C2 − C1', letters: run.diff, kind: 'param' },
                    { label: 'P2 − P1 (verificação)', letters: diffCheck, kind: 'plain' },
                  ]}
                />
                <p role="status" className="rounded-xl border-2 border-line bg-surface p-4 text-lg font-semibold">
                  As duas linhas são {run.diff === diffCheck ? 'idênticas' : 'diferentes'}: a chave não participa da diferença.
                </p>
              </section>

              <section aria-labelledby="reuse-eva-2" className="space-y-3">
                <h3 id="reuse-eva-2" className="text-xl font-bold">
                  5.2 Arrasto do texto provável
                </h3>
                <p className="text-lg">
                  Eva supõe que <span className="font-mono font-bold">{run.flow.crib}</span> está na mensagem {run.flow.cribIn} e o desliza por todas as {run.flow.totalOffsets} posições. Em cada uma, ela
                  calcula o trecho que ficaria na outra mensagem. Onde o alinhamento está certo, o trecho é legível.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-left text-base">
                    <caption className="mb-2 text-left text-lg font-semibold">As 8 posições de trecho mais legível</caption>
                    <thead>
                      <tr className="border-b border-line">
                        <th scope="col" className="py-2 pr-3">Posição</th>
                        <th scope="col" className="py-2 pr-3">Trecho da outra mensagem</th>
                        <th scope="col" className="py-2 pr-3">Trecho da chave</th>
                        <th scope="col" className="py-2 pr-3">Pontuação</th>
                        <th scope="col" className="py-2">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.drag.slice(0, 8).map((d, i) => (
                        <tr key={d.offset} className={`border-b border-line ${d.offset === run.flow.trueOffset ? 'bg-k-secret/15 font-semibold' : ''}`}>
                          <th scope="row" className="py-1 pr-3 font-mono font-normal">{d.offset + 1}</th>
                          <td className="py-1 pr-3 font-mono">{d.fragment}</td>
                          <td className="py-1 pr-3 font-mono">{d.keyFragment}</td>
                          <td className="py-1 pr-3">{fmt(d.score)}</td>
                          <td className="py-1">
                            {i === 0 ? 'mais legível (escolha de Eva)' : ''}
                            {d.offset === run.flow.trueOffset ? `${i === 0 ? '; ' : ''}posição real (Eva não sabe; só para estudo)` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p role="status" className={`rounded-xl border-2 p-4 text-lg font-semibold ${run.flow.success ? 'border-danger bg-danger/10 text-danger' : 'border-k-cipher'}`}>
                  {run.flow.trueOffset < 0
                    ? `O texto provável não está na mensagem ${run.flow.cribIn}: nenhum alinhamento produz texto legível.`
                    : run.flow.success
                      ? `A posição real (${run.flow.trueOffset + 1}) ficou em 1º lugar entre ${run.flow.totalOffsets}: Eva recuperou o fragmento "${run.flow.bestFragment}" e o fragmento de chave "${run.flow.bestKeyFragment}".`
                      : `A posição real (${run.flow.trueOffset + 1}) ficou em ${run.flow.rank}º lugar entre ${run.flow.totalOffsets}: com um texto provável mais longo ela sobe ao topo.`}
                </p>
              </section>

              <section aria-labelledby="reuse-eva-3" className="space-y-3">
                <h3 id="reuse-eva-3" className="text-xl font-bold">
                  5.3 O que o fragmento da chave dá a Eva
                </h3>
                <p className="text-lg">
                  O fragmento de chave (C − P) vale para as <strong>duas</strong> mensagens nessas posições: com ele, Eva lê o trecho de ambas. Ela então adivinha as palavras vizinhas ("a nossa
                  melhor...", "antes do...") e estende o trecho, uma palavra de cada vez, até recuperar as mensagens.
                </p>
                <Callout variant="info" title="O que esta simulação faz">
                  <p>
                    O arrasto é automático, mas a extensão (adivinhar a palavra seguinte) é o trabalho do criptoanalista, que aqui você pode refazer trocando o texto provável. Uma tentativa automática
                    completa com um modelo de pares de letras recuperou apenas 20% a 42% das letras nos testes deste projeto, e por isso não é oferecida: o ataque real é guiado por texto provável.
                  </p>
                </Callout>
                <Callout variant="warn" title="Projeto Venona">
                  <p>
                    Entre 1943 e 1980, criptoanalistas dos Estados Unidos decifraram parte do tráfego diplomático soviético porque, sob pressão da guerra, pads de uso único foram reproduzidos e
                    reutilizados. A cifra era perfeita; o erro foi humano.
                  </p>
                </Callout>
              </section>
            </div>
          </LabSection>

          <LabSection id="reuse-results" title="6. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultados da reutilização da chave</caption>
                <tbody>
                  <Row label="Cifra 1" value={run.flow.cipher1} mono />
                  <Row label="Cifra 2" value={run.flow.cipher2} mono />
                  <Row label="Diferença D = C2 − C1" value={run.flow.diff} mono />
                  <Row label="Texto provável de Eva" value={`${run.flow.crib} (na mensagem ${run.flow.cribIn})`} mono />
                  <Row label="Melhor posição escolhida por Eva" value={String(run.flow.bestOffset + 1)} />
                  <Row label="Fragmento da outra mensagem" value={run.flow.bestFragment} mono />
                  <Row label="Fragmento da chave" value={run.flow.bestKeyFragment} mono />
                  <Row label="Mensagem 1 recuperada por Bob" value={run.flow.recovered1} mono />
                  <Row label="Mensagem 2 recuperada por Bob" value={run.flow.recovered2} mono />
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Eva quebrou o sigilo?</th>
                    <td className={`py-2 font-semibold ${run.flow.success ? 'text-danger' : 'text-k-cipher'}`}>
                      {run.flow.success ? 'Sim: obteve um fragmento da chave e de ambas as mensagens' : 'Não nesta tentativa (texto provável curto ou ausente), mas a chave reutilizada continua vazando'}
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
