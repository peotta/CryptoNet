import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { engines } from '../../crypto/local/des';
import { MAX_SEARCH_BITS } from '../../crypto/des';
import { utf8Encode } from '../../crypto/encoding';
import { randomBytes } from '../../crypto/random';
import { Callout, LabSection, Tabs, buttonClass } from '../../components/ui';
import { buildBruteProtocol, buildDesProtocol, buildTdesProtocol, humanTime, MAX_BYTES, runBrute, runDes, runTdes, EFF_RATE, type BruteRun, type DesRun, type TdesKeying, type TdesRun } from './flows';

const TEXT = 'PAGAR R$ 1000,00 PARA BOB E CONFIRMAR';
const TEXT_BRUTE = 'MENSAGEM SECRETA DE ALICE';

type Scenario = 'cbc' | 'forca' | 'triplo';

export function PartB() {
  const [scenario, setScenario] = useState<Scenario>('cbc');
  return (
    <>
      <LabSection id="des-cenario" title="3. Parte B: Alice, Bob e Eva">
        <Tabs
          label="Cenário"
          value={scenario}
          onChange={setScenario}
          tabs={[
            { id: 'cbc', label: 'DES em CBC (e a adulteração)' },
            { id: 'forca', label: 'Eva testa todas as chaves' },
            { id: 'triplo', label: 'Triple DES (EDE)' },
          ]}
        />
        {scenario === 'cbc' && (
          <Callout variant="info" title="O que se espera">
            <p>Alice cifra com DES em CBC e Bob decifra. Eva vê só blocos sem padrão. Marque a adulteração para ver o que acontece quando Eva inverte um bit da cifra: o CBC não autentica.</p>
          </Callout>
        )}
        {scenario === 'forca' && (
          <Callout variant="danger" title="O limite do DES é o tamanho da chave">
            <p>
              A chave tem só 56 bits úteis. Para caber no navegador, a busca de Eva é limitada a poucos bits desconhecidos, mas o cálculo mostra o que significaria a chave inteira. Este é o motivo de o DES ter sido
              aposentado.
            </p>
          </Callout>
        )}
        {scenario === 'triplo' && (
          <Callout variant="info" title="O remendo que prolongou o DES">
            <p>O Triple DES aplica o DES três vezes (cifrar, decifrar, cifrar) com até três chaves. Resolve o tamanho da chave, mas não o do bloco, e ficou lento.</p>
          </Callout>
        )}
      </LabSection>
      {scenario === 'cbc' && <CbcPanel key="cbc" />}
      {scenario === 'forca' && <BrutePanel key="forca" />}
      {scenario === 'triplo' && <TdesPanel key="triplo" />}
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

function TextInput({ id, label, text, onChange, max = MAX_BYTES }: { id: string; label: string; text: string; onChange: (v: string) => void; max?: number }) {
  const n = utf8Encode(text).length;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-semibold">
        {label}
      </label>
      <textarea id={id} value={text} onChange={(e) => onChange(e.target.value)} rows={2} aria-describedby={`${id}-hint`} className="w-full rounded-lg border border-line bg-surface p-3 text-lg" />
      <p id={`${id}-hint`} className="mt-1 text-base text-muted">
        Até {max} bytes (UTF-8). A mensagem tem {n} {n === 1 ? 'byte' : 'bytes'}.
      </p>
    </div>
  );
}

/** Executa uma função assíncrona a cada mudança de dependência, descartando respostas antigas. */
function useRun<T>(fn: () => Promise<T>, deps: unknown[]): { run: T | null; error: string | null; busy: boolean } {
  const [run, setRun] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    fn()
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
          setBusy(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setRun(null);
          setError(e instanceof Error ? e.message : 'Falha ao executar.');
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { run, error, busy };
}

function CbcPanel() {
  const [text, setText] = useState(TEXT);
  const [tamper, setTamper] = useState(false);
  const [tamperBlock, setTamperBlock] = useState(2);
  const [material, setMaterial] = useState(() => ({ key: randomBytes(8), iv: randomBytes(8) }));
  const { run, error } = useRun<DesRun>(() => runDes(engines.des, { ...material, text, tamper, tamperBlock }), [material, text, tamper, tamperBlock]);
  const definition = useMemo(() => (run ? buildDesProtocol(run.flow) : null), [run]);
  const nBlocks = run?.flow.nBlocks ?? 1;

  return (
    <>
      <LabSection id="des-params" title="4. Parâmetros configuráveis">
        <TextInput id="des-text" label="Mensagem de Alice" text={text} onChange={setText} />
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => setMaterial({ key: randomBytes(8), iv: randomBytes(8) })}>
            Sortear nova chave e novo IV (aleatório seguro)
          </button>
        </div>
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
          Eva inverte um bit da cifra em trânsito
        </label>
        {tamper && (
          <div>
            <label htmlFor="des-block-n" className="mb-1 block text-base font-semibold">
              Bloco cifrado atingido (1 a {nBlocks})
            </label>
            <input id="des-block-n" type="number" min={1} max={nBlocks} value={tamperBlock} onChange={(e) => setTamperBlock(Number(e.target.value))} className="min-h-11 w-28 rounded-lg border border-line bg-surface px-3 text-lg" />
          </div>
        )}
        {error && <Err>{error}</Err>}
      </LabSection>

      <LabSection id="des-viz" title="5. Visualização animada">
        {run && definition ? <ProtocolPlayer definition={definition} resetKey={`${run.flow.ctHex}|${run.flow.tampered}|${run.flow.tamperBlock}`} /> : <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>}
      </LabSection>

      {run && (
        <LabSection id="des-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados da cifragem com DES em CBC</caption>
              <tbody>
                <Row label="Chave (64 bits, 56 úteis)" value={run.flow.keyHex} mono />
                <Row label="IV (64 bits)" value={run.flow.ivHex} mono />
                <Row label="Mensagem" value={run.flow.message} />
                <Row label={`Cifra (${run.flow.nBlocks} blocos, hex)`} value={run.flow.ctHex} mono />
                {run.flow.tampered && <Row label="Cifra recebida por Bob (alterada por Eva)" value={run.flow.receivedHex} mono />}
                <Row label="Mensagem recuperada por Bob" value={run.flow.recovered} />
                <tr>
                  <th scope="row" className="py-2 pr-4 font-semibold">Eva leu a mensagem?</th>
                  <td className="py-2 font-semibold text-k-secret">Não, sem a chave (mas veja o cenário da busca exaustiva)</td>
                </tr>
                <tr>
                  <th scope="row" className="py-2 pr-4 font-semibold">Eva alterou a mensagem?</th>
                  <td className={`py-2 font-semibold ${run.flow.tampered ? 'text-danger' : ''}`}>{run.flow.tampered ? `Sim: um bit do bloco cifrado ${run.flow.tamperBlock}` : 'Não nesta execução'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {run.flow.tampered && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-base">
                <caption className="mb-1 text-left text-base text-muted">Bits diferentes (de 64) entre cada bloco recuperado por Bob e o original</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-4">Bloco</th>
                    <th scope="col" className="py-2 pr-4">Bits diferentes</th>
                    <th scope="col" className="py-2">Efeito</th>
                  </tr>
                </thead>
                <tbody>
                  {run.flow.blockDiffs.map((n, i) => (
                    <tr key={i} className="border-b border-line">
                      <td className="py-2 pr-4">{i + 1}</td>
                      <td className="py-2 pr-4">{n}</td>
                      <td className="py-2">{i + 1 === run.flow.tamperBlock ? 'destruído (decifrado a partir de um bloco alterado)' : i + 1 === run.flow.tamperBlock + 1 ? 'o mesmo bit que Eva inverteu, de forma dirigida' : n === 0 ? 'intacto' : 'afetado'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </LabSection>
      )}
    </>
  );
}

function BrutePanel() {
  const [text, setText] = useState(TEXT_BRUTE);
  const [bits, setBits] = useState(14);
  const [material, setMaterial] = useState(() => ({ baseKey: randomBytes(8), iv: randomBytes(8), seed: randomBytes(4) }));
  const space = 2 ** Math.min(Math.max(1, Math.round(bits) || 1), MAX_SEARCH_BITS);
  const secret = ((material.seed[0] << 24) | (material.seed[1] << 16) | (material.seed[2] << 8) | material.seed[3]) >>> 0;
  const { run, error, busy } = useRun<BruteRun>(() => runBrute(engines.des, { baseKey: material.baseKey, iv: material.iv, text, unknownBits: Math.round(bits), secret: secret % space }), [material, text, bits]);
  const definition = useMemo(() => (run ? buildBruteProtocol(run.flow) : null), [run]);
  const f = run?.flow;

  return (
    <>
      <LabSection id="des-params" title="4. Parâmetros configuráveis">
        <TextInput id="des-text" label="Mensagem de Alice (Eva conhece os 8 primeiros bytes)" text={text} onChange={setText} />
        <div>
          <label htmlFor="des-bits" className="mb-1 block text-base font-semibold">
            Bits da chave desconhecidos por Eva (1 a {MAX_SEARCH_BITS})
          </label>
          <input id="des-bits" type="number" min={1} max={MAX_SEARCH_BITS} value={bits} onChange={(e) => setBits(Number(e.target.value))} aria-describedby="des-bits-hint" className="min-h-11 w-28 rounded-lg border border-line bg-surface px-3 text-lg" />
          <p id="des-bits-hint" className="mt-1 text-base text-muted">
            Eva testará até {space.toLocaleString('pt-BR')} chaves. Os outros {56 - Math.round(bits || 0)} bits úteis ela já conhece. Em 20 bits a busca leva alguns segundos neste navegador.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => setMaterial({ baseKey: randomBytes(8), iv: randomBytes(8), seed: randomBytes(4) })}>
            Sortear nova chave e novo IV (aleatório seguro)
          </button>
        </div>
        {error && <Err>{error}</Err>}
        {busy && !error && <p role="status" className="text-base text-muted">Eva está testando chaves…</p>}
      </LabSection>

      <LabSection id="des-viz" title="5. Visualização animada">
        {run && definition ? <ProtocolPlayer definition={definition} resetKey={`${run.flow.ctHex}|${run.flow.unknownBits}`} /> : <p className="text-lg text-muted">Aguarde a busca ou corrija os parâmetros.</p>}
      </LabSection>

      {f && (
        <LabSection id="des-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados da busca exaustiva contra o DES</caption>
              <tbody>
                <Row label="Chave de Alice" value={f.keyHex} mono />
                <Row label="Chave encontrada por Eva" value={f.foundHex ?? 'não encontrada'} mono />
                <Row label="Espaço de busca" value={`2^${f.unknownBits} = ${f.space.toLocaleString('pt-BR')} chaves`} />
                <Row label="Chaves testadas" value={f.tries.toLocaleString('pt-BR')} />
                <Row label="Tempo da busca aqui" value={humanTime(f.ms / 1000)} />
                <Row label="Velocidade neste navegador" value={`${Math.round(f.rate).toLocaleString('pt-BR')} chaves por segundo`} />
                <Row label="Mensagem lida por Eva" value={f.recovered || '(nada)'} />
              </tbody>
            </table>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-base">
              <caption className="mb-1 text-left text-base text-muted">Projeção para a chave inteira de 56 bits (busca média: metade do espaço, 2^55 chaves)</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-4">Atacante</th>
                  <th scope="col" className="py-2 pr-4">Chaves por segundo</th>
                  <th scope="col" className="py-2">Tempo médio para achar a chave</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <th scope="row" className="py-2 pr-4 font-semibold">Este navegador, em um núcleo</th>
                  <td className="py-2 pr-4">{Math.round(f.rate).toLocaleString('pt-BR')}</td>
                  <td className="py-2">{humanTime(f.secondsHere)}</td>
                </tr>
                <tr className="border-b border-line">
                  <th scope="row" className="py-2 pr-4 font-semibold">EFF DES Cracker com a rede distributed.net (1999)</th>
                  <td className="py-2 pr-4">mais de {EFF_RATE.toLocaleString('pt-BR')}</td>
                  <td className="py-2">{humanTime(f.secondsEff)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            {f.ok ? (
              <Callout variant="info" title="Resultado do ataque">
                <p>{f.verdictText}</p>
              </Callout>
            ) : (
              <p role="status" className="rounded-xl border-2 border-danger bg-danger/10 p-4 text-lg font-semibold text-danger">
                {f.verdictText}
              </p>
            )}
          </div>
        </LabSection>
      )}
    </>
  );
}

function TdesPanel() {
  const [text, setText] = useState(TEXT);
  const [keying, setKeying] = useState<TdesKeying>('tres');
  const [material, setMaterial] = useState(() => ({ k1: randomBytes(8), k2: randomBytes(8), k3: randomBytes(8), iv: randomBytes(8) }));
  const { run, error } = useRun<TdesRun>(() => runTdes(engines.des, { ...material, text, keying }), [material, text, keying]);
  const definition = useMemo(() => (run ? buildTdesProtocol(run.flow) : null), [run]);
  const f = run?.flow;

  return (
    <>
      <LabSection id="des-params" title="4. Parâmetros configuráveis">
        <TextInput id="des-text" label="Mensagem de Alice" text={text} onChange={setText} />
        <div>
          <label htmlFor="des-keying" className="mb-1 block text-base font-semibold">
            Opção de chaves
          </label>
          <select id="des-keying" value={keying} onChange={(e) => setKeying(e.target.value as TdesKeying)} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-lg">
            <option value="tres">Três chaves independentes (K1, K2, K3)</option>
            <option value="duas">Duas chaves (K3 = K1)</option>
            <option value="igual">Uma chave (K1 = K2 = K3): equivale ao DES</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => setMaterial({ k1: randomBytes(8), k2: randomBytes(8), k3: randomBytes(8), iv: randomBytes(8) })}>
            Sortear novas chaves e novo IV (aleatório seguro)
          </button>
        </div>
        {error && <Err>{error}</Err>}
      </LabSection>

      <LabSection id="des-viz" title="5. Visualização animada">
        {run && definition ? <ProtocolPlayer definition={definition} resetKey={`${run.flow.ctHex}|${run.flow.keying}`} /> : <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>}
      </LabSection>

      {f && (
        <LabSection id="des-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados da cifragem com Triple DES</caption>
              <tbody>
                <Row label="K1" value={f.k1Hex} mono />
                <Row label="K2" value={f.k2Hex} mono />
                <Row label="K3" value={f.k3Hex} mono />
                <Row label="IV" value={f.ivHex} mono />
                <Row label="Primeiro bloco: entrada (P1 ⊕ IV)" value={f.mixedHex} mono />
                <Row label="Depois de E(K1, ·)" value={f.afterE1} mono />
                <Row label="Depois de D(K2, ·)" value={f.afterD2} mono />
                <Row label="Depois de E(K3, ·): primeiro bloco cifrado" value={f.afterE3} mono />
                <Row label={`Cifra (${f.nBlocks} blocos, hex)`} value={f.ctHex} mono />
                <Row label="Mensagem recuperada por Bob" value={f.recovered} />
                <Row label="Igual ao DES simples com K1?" value={f.sameAsDes ? 'Sim' : 'Não'} />
                <Row label="Segurança efetiva" value={f.strength} />
              </tbody>
            </table>
          </div>
          <Callout variant="info" title="Leitura do resultado">
            <p>{f.verdictText}</p>
          </Callout>
        </LabSection>
      )}
    </>
  );
}
