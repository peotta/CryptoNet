import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { engines } from '../../crypto/engines';
import { utf8Encode } from '../../crypto/encoding';
import { randomBytes } from '../../crypto/random';
import { Callout, LabSection, Tabs, buttonClass } from '../../components/ui';
import { buildChaChaProtocol, buildReuseProtocol, MAX_BYTES, runChaCha, runReuse, type ChaChaRun, type ReuseRun } from './flows';

const TEXT = 'PAGAR R$ 1000,00 PARA BOB';
const TEXT1 = 'ATAQUE A PONTE AO AMANHECER SEM AVISAR';
const TEXT2 = 'RECUAR PARA A FLORESTA AO ANOITECER AGORA';
const CRIB = 'AMANHECER';

export function StreamPanel() {
  const [scenario, setScenario] = useState<'correto' | 'reuso'>('correto');
  return (
    <>
      <LabSection id="cc-cenario" title="3. Parte B: Alice, Bob e Eva">
        <Tabs
          label="Cenário"
          value={scenario}
          onChange={setScenario}
          tabs={[
            { id: 'correto', label: 'Nonce único (uso correto)' },
            { id: 'reuso', label: 'Erro: nonce reutilizado' },
          ]}
        />
        {scenario === 'correto' ? (
          <Callout variant="info" title="O que se espera">
            <p>
              Com um nonce novo a cada mensagem, Eva vê só bytes pseudoaleatórios. Marque a opção de adulteração para ver que o ChaCha20 sozinho não detecta alterações.
            </p>
          </Callout>
        ) : (
          <Callout variant="danger" title="O erro que não se perdoa">
            <p>Alice cifra duas mensagens com a mesma chave e o mesmo nonce. Eva não descobre a chave, mas lê trechos das mensagens.</p>
          </Callout>
        )}
      </LabSection>
      {scenario === 'correto' ? <NormalPanel key="correto" /> : <ReusePanel key="reuso" />}
    </>
  );
}

function Err({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
      {children}
    </p>
  );
}

function NormalPanel() {
  const [text, setText] = useState(TEXT);
  const [tamper, setTamper] = useState(false);
  const [tamperByte, setTamperByte] = useState(10);
  const [material, setMaterial] = useState(() => ({ key: randomBytes(32), nonce: randomBytes(12) }));
  const [run, setRun] = useState<ChaChaRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    runChaCha(engines.chacha, { ...material, text, tamper, tamperByte })
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
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
  }, [material, text, tamper, tamperByte]);

  const definition = useMemo(() => (run ? buildChaChaProtocol(run.flow) : null), [run]);
  const n = utf8Encode(text).length;

  return (
    <>
      <LabSection id="cc-params" title="4. Parâmetros configuráveis">
        <div>
          <label htmlFor="cc-text" className="mb-1 block text-base font-semibold">
            Mensagem de Alice
          </label>
          <textarea id="cc-text" value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-describedby="cc-text-hint" className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
          <p id="cc-text-hint" className="mt-1 text-base text-muted">
            Até {MAX_BYTES} bytes (UTF-8). A mensagem tem {n} {n === 1 ? 'byte' : 'bytes'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => setMaterial({ key: randomBytes(32), nonce: randomBytes(12) })}>
            Sortear nova chave e novo nonce (aleatório seguro)
          </button>
        </div>
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
          Eva inverte um bit da cifra em trânsito
        </label>
        {tamper && (
          <div>
            <label htmlFor="cc-byte" className="mb-1 block text-base font-semibold">
              Byte atingido (1 a {Math.max(1, n)})
            </label>
            <input id="cc-byte" type="number" min={1} max={Math.max(1, n)} value={tamperByte} onChange={(e) => setTamperByte(Number(e.target.value))} className="min-h-11 w-28 rounded-lg border border-line bg-surface px-3 text-lg" />
          </div>
        )}
        {error && <Err>{error}</Err>}
      </LabSection>

      <LabSection id="cc-viz" title="5. Visualização animada">
        {run && definition ? <ProtocolPlayer definition={definition} resetKey={`${run.flow.ctHex}|${run.flow.tampered}|${run.flow.tamperByte}`} /> : <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>}
      </LabSection>

      {run && (
        <LabSection id="cc-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados da cifragem com ChaCha20</caption>
              <tbody>
                <Row label="Chave (256 bits)" value={run.flow.keyHex} mono />
                <Row label="Nonce (96 bits)" value={run.flow.nonceHex} mono />
                <Row label="Mensagem" value={run.flow.message} />
                <Row label="Fluxo de chaves (hex)" value={run.flow.ksHex} mono />
                <Row label="Cifra (hex)" value={run.flow.ctHex} mono />
                {run.flow.tampered && <Row label="Cifra recebida por Bob (alterada por Eva)" value={run.flow.receivedHex} mono />}
                <Row label="Mensagem recuperada por Bob" value={run.flow.recovered} />
                <tr>
                  <th scope="row" className="py-2 pr-4 font-semibold">Eva leu a mensagem?</th>
                  <td className="py-2 font-semibold text-k-secret">Não: sem a chave, a cifra parece aleatória</td>
                </tr>
                <tr>
                  <th scope="row" className="py-2 pr-4 font-semibold">Eva alterou a mensagem?</th>
                  <td className={`py-2 font-semibold ${run.flow.tampered ? 'text-danger' : ''}`}>
                    {run.flow.tampered ? `Sim: um bit do byte ${run.flow.tamperByte}, e Bob não percebeu` : 'Não nesta execução'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </LabSection>
      )}
    </>
  );
}

function ReusePanel() {
  const [text1, setText1] = useState(TEXT1);
  const [text2, setText2] = useState(TEXT2);
  const [crib, setCrib] = useState(CRIB);
  const [cribIn, setCribIn] = useState<1 | 2>(1);
  const [material] = useState(() => ({ key: randomBytes(32), nonce: randomBytes(12) }));
  const [run, setRun] = useState<ReuseRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    runReuse(engines.chacha, { ...material, text1, text2, crib, cribIn })
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
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
  }, [material, text1, text2, crib, cribIn]);

  const definition = useMemo(() => (run ? buildReuseProtocol(run.flow) : null), [run]);
  const shown = useMemo(() => run?.rows.filter((r) => r.readable || r.real).slice(0, 12) ?? [], [run]);

  return (
    <>
      <LabSection id="cc-params" title="4. Parâmetros configuráveis">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="cc-m1" className="mb-1 block text-base font-semibold">
              Mensagem 1 de Alice
            </label>
            <textarea id="cc-m1" value={text1} onChange={(e) => setText1(e.target.value)} rows={3} className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
          </div>
          <div>
            <label htmlFor="cc-m2" className="mb-1 block text-base font-semibold">
              Mensagem 2 de Alice
            </label>
            <textarea id="cc-m2" value={text2} onChange={(e) => setText2(e.target.value)} rows={3} className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="cc-crib" className="mb-1 block text-base font-semibold">
              Texto provável de Eva (palavra que ela supõe existir)
            </label>
            <input id="cc-crib" value={crib} onChange={(e) => setCrib(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg" />
          </div>
          <div>
            <label htmlFor="cc-crib-in" className="mb-1 block text-base font-semibold">
              Eva supõe que o texto provável está na
            </label>
            <select id="cc-crib-in" value={cribIn} onChange={(e) => setCribIn(Number(e.target.value) as 1 | 2)} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-lg">
              <option value={1}>mensagem 1</option>
              <option value={2}>mensagem 2</option>
            </select>
          </div>
        </div>
        {error && <Err>{error}</Err>}
      </LabSection>

      <LabSection id="cc-viz" title="5. Visualização animada">
        {run && definition ? <ProtocolPlayer definition={definition} resetKey={`${run.flow.c1Hex}|${run.flow.crib}|${run.flow.cribIn}`} /> : <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>}
      </LabSection>

      {run && (
        <>
          <LabSection id="cc-eva" title="6. Criptoanálise de Eva">
            <div className="space-y-4">
              <p className="text-lg">
                Eva calculou X = C1 ⊕ C2 = m1 ⊕ m2 e arrastou o texto provável <strong>"{run.flow.crib}"</strong> por todas as posições. Abaixo, as posições em que o resultado é inteiramente
                texto (letras, dígitos, espaço e pontuação comum). Há {run.flow.readableCount} dessas posições; algumas são acaso, e só a posição real revela uma palavra de verdade.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-base">
                  <caption className="mb-1 text-left text-base text-muted">Trechos da mensagem {run.flow.other} para cada posição do texto provável na mensagem {run.flow.cribIn}</caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="py-2 pr-4">Posição (byte)</th>
                      <th scope="col" className="py-2 pr-4">Trecho obtido</th>
                      <th scope="col" className="py-2">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-2">Nenhuma posição produziu texto legível.</td>
                      </tr>
                    )}
                    {shown.map((r) => (
                      <tr key={r.offset} className={`border-b border-line ${r.real ? 'font-bold' : ''}`}>
                        <td className="py-2 pr-4">{r.offset + 1}</td>
                        <td className="py-2 pr-4 font-mono">{r.fragment}</td>
                        <td className="py-2">{r.real ? 'posição real (Eva só confirma ao ver uma palavra)' : r.readable ? 'texto por acaso' : 'ilegível'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {run.flow.ok ? (
                <Callout variant="info" title="Resultado do ataque">
                  <p>{run.flow.verdictText}</p>
                </Callout>
              ) : (
                <p role="status" className="rounded-xl border-2 border-danger bg-danger/10 p-4 text-lg font-semibold text-danger">
                  {run.flow.verdictText}
                </p>
              )}
              <Callout variant="info" title="Como Eva prosseguiria">
                <p>
                  Cada palavra descoberta numa mensagem revela um trecho da outra e um trecho do fluxo de chaves. Estendendo o palpite (a palavra seguinte, um espaço, um nome), Eva reconstrói as
                  duas mensagens inteiras. Foi assim que o projeto Venona leu parte do tráfego soviético que reutilizara páginas de cifra.
                </p>
              </Callout>
            </div>
          </LabSection>

          <LabSection id="cc-results" title="7. Painel de resultados">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-lg">
                <caption className="sr-only">Resultados do cenário com nonce reutilizado</caption>
                <tbody>
                  <Row label="Nonce (reutilizado)" value={run.flow.nonceHex} mono />
                  <Row label="C1 (hex)" value={run.flow.c1Hex} mono />
                  <Row label="C2 (hex)" value={run.flow.c2Hex} mono />
                  <Row label="C1 ⊕ C2 = m1 ⊕ m2 (hex)" value={run.flow.xorHex} mono />
                  <Row label="Texto provável" value={`"${run.flow.crib}" na mensagem ${run.flow.cribIn}`} />
                  <Row label="Chave descoberta por Eva?" value="Não, mas não foi preciso" />
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">Eva leu parte das mensagens?</th>
                    <td className={`py-2 font-semibold ${run.flow.ok ? 'text-k-secret' : 'text-danger'}`}>
                      {run.flow.ok ? 'Não nesta tentativa' : `Sim: "${run.flow.recoveredFragment}"`}
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
