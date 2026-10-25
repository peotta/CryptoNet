import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { toHex } from '../../crypto/encoding';
import { DEFAULT_LWE } from '../../crypto/lwe';
import { engines } from '../../crypto/local/mlkem';
import { ML_KEM_1024, ML_KEM_512, ML_KEM_768, sizes, type MlKemParams } from '../../crypto/mlkem';
import { Callout, Field, LabSection, Tabs, buttonClass } from '../../components/ui';
import { useDebounced } from '../../hooks/useDebounced';
import { LWE_MAX_N, buildLweProtocol, buildMlKemProtocol, hex, runLwe, runMlKem, type LweFlow, type MlKemFlow } from './flows';

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

// ---------------------------------------------------------------- Parte A: LWE
export function LwePanel() {
  const [n, setN] = useState<'2' | '3'>('3');
  const [noise, setNoise] = useState<'0' | '1'>('1');
  const [bit, setBit] = useState<'0' | '1'>('1');
  const [seed, setSeed] = useState('7');
  const [run, setRun] = useState<LweFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dseed = useDebounced(seed);
  const seedErr = /^\d{1,5}$/.test(dseed) && Number(dseed) >= 1 ? null : 'Use um inteiro de 1 a 99999.';
  const seedFieldErr = /^\d{1,5}$/.test(seed) && Number(seed) >= 1 ? null : 'Use um inteiro de 1 a 99999.';

  useEffect(() => {
    if (seedErr) {
      setRun(null);
      return;
    }
    let cancelled = false;
    runLwe(engines.lwe, { params: { ...DEFAULT_LWE, n: Number(n), noise: Number(noise) }, seed: Number(dseed), rSeed: Number(dseed) + 1000, bit: Number(bit) as 0 | 1 })
      .then((r) => !cancelled && (setRun(r), setError(null)))
      .catch((e: unknown) => !cancelled && (setRun(null), setError(e instanceof Error ? e.message : 'Falha no LWE.')));
    return () => {
      cancelled = true;
    };
  }, [n, noise, bit, dseed, seedErr]);

  const definition = useMemo(() => (run ? buildLweProtocol(run) : null), [run]);
  return (
    <>
      <LabSection id="pq-params" title="4. Parâmetros configuráveis">
        <p className="text-base text-muted">
          Os números são minúsculos (q = {DEFAULT_LWE.q}, {DEFAULT_LWE.m} amostras): servem para ver cada conta e para que Eva consiga atacar. No ML-KEM-768 o segredo tem 768 coeficientes módulo 3329.
        </p>
        <Tabs label="Dimensão do segredo" value={n} onChange={setN} tabs={Array.from({ length: LWE_MAX_N - 1 }, (_, i) => ({ id: String(i + 2) as '2' | '3', label: `n = ${i + 2}` }))} />
        <Tabs
          label="Ruído"
          value={noise}
          onChange={setNoise}
          tabs={[
            { id: '1', label: 'Com ruído (±1)' },
            { id: '0', label: 'Sem ruído (inseguro)' },
          ]}
        />
        <Tabs
          label="Bit que Bob cifra"
          value={bit}
          onChange={setBit}
          tabs={[
            { id: '0', label: 'Bit 0' },
            { id: '1', label: 'Bit 1' },
          ]}
        />
        <div className="max-w-xs">
          <Field id="lwe-seed" label="Semente (1 a 99999)" value={seed} onChange={(v) => setSeed(v.trim())} error={seedFieldErr} hint="A mesma semente repete as mesmas escolhas aleatórias." />
        </div>
        {error && <Err>{error}</Err>}
      </LabSection>
      <LabSection id="pq-viz" title="5. Visualização animada">
        {run && definition ? <ProtocolPlayer definition={definition} resetKey={`${n}|${noise}|${bit}|${dseed}`} /> : <p className="text-lg text-muted">Corrija os parâmetros para iniciar a animação.</p>}
      </LabSection>
      {run && (
        <LabSection id="pq-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados do LWE didático</caption>
              <tbody>
                <Row label="Segredo s" value={`(${run.keys.s.join(', ')})`} mono />
                <Row label="Ruído e" value={`(${run.keys.e.join(', ')})`} mono />
                <Row label="Texto cifrado (u, v)" value={`(${run.ct.u.join(', ')}), ${run.ct.v}`} mono />
                <Row label="Bit decifrado por Alice" value={`${run.dec.bit} (d = ${run.dec.d}, folga ${run.dec.margin})`} />
                <Row label="Eliminação de Gauss" value={run.gauss.correct ? 'achou s' : `falhou (resíduo ${run.gauss.residual})`} />
                <Row label="Busca exaustiva" value={run.brute.correct ? `achou s após ${run.brute.tries} testes` : 'não achou'} />
                <tr>
                  <th scope="row" className="py-2 pr-4 font-semibold">Eva leu o bit?</th>
                  <td className={`py-2 font-semibold ${run.broken ? 'text-danger' : 'text-k-secret'}`}>{run.broken ? `Sim (bit ${run.evaBit}): escala didática` : 'Não'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout variant="danger" title="O que isto mostra">
            <p>{run.verdictText}</p>
          </Callout>
        </LabSection>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Parte B: ML-KEM
const VARIANTS: Record<string, MlKemParams> = { '512': ML_KEM_512, '768': ML_KEM_768, '1024': ML_KEM_1024 };

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const freshSeeds = () => ({ d: randomBytes(32), z: randomBytes(32), m: randomBytes(32) });

export function MlKemPanel() {
  const [variant, setVariant] = useState<'512' | '768' | '1024'>('768');
  const [tamper, setTamper] = useState(false);
  const [seeds, setSeeds] = useState(freshSeeds);
  const [run, setRun] = useState<MlKemFlow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    runMlKem(engines.mlkem, { params: VARIANTS[variant], ...seeds, tamper })
      .then((r) => !cancelled && (setRun(r), setError(null)))
      .catch((e: unknown) => !cancelled && (setRun(null), setError(e instanceof Error ? e.message : 'Falha no ML-KEM.')));
    return () => {
      cancelled = true;
    };
  }, [variant, tamper, seeds]);

  const definition = useMemo(() => (run ? buildMlKemProtocol(run) : null), [run]);
  const sz = sizes(VARIANTS[variant]);
  return (
    <>
      <LabSection id="pq-params" title="4. Parâmetros configuráveis">
        <Tabs
          label="Conjunto de parâmetros"
          value={variant}
          onChange={setVariant}
          tabs={[
            { id: '512', label: 'ML-KEM-512 (categoria 1)' },
            { id: '768', label: 'ML-KEM-768 (categoria 3)' },
            { id: '1024', label: 'ML-KEM-1024 (categoria 5)' },
          ]}
        />
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="h-5 w-5" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
          Eva inverte um bit do texto cifrado em trânsito
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={buttonClass} onClick={() => setSeeds(freshSeeds())}>
            Sortear novas sementes
          </button>
          <p className="font-mono text-base text-muted" data-testid="seeds">
            d = {hex(seeds.d, 6)}…, z = {hex(seeds.z, 6)}…, m = {hex(seeds.m, 6)}…
          </p>
        </div>
        <p className="text-base text-muted">
          Chave de encapsulamento: {sz.ek} bytes. Chave de desencapsulamento: {sz.dk} bytes. Texto cifrado: {sz.ciphertext} bytes. Chave compartilhada: {sz.sharedSecret} bytes.
        </p>
        {error && <Err>{error}</Err>}
      </LabSection>
      <LabSection id="pq-viz" title="5. Visualização animada">
        {run && definition ? (
          <ProtocolPlayer definition={definition} resetKey={`${variant}|${tamper}|${toHex(seeds.d)}${toHex(seeds.z)}${toHex(seeds.m)}`} />
        ) : (
          <p className="text-lg text-muted">Aguarde o cálculo para iniciar a animação.</p>
        )}
      </LabSection>
      {run && (
        <LabSection id="pq-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados do ML-KEM</caption>
              <tbody>
                <Row label="Conjunto de parâmetros" value={`${run.input.params.name} (k = ${run.input.params.k})`} />
                <Row label="Chave K de Bob" value={toHex(run.enc.K)} mono />
                <Row label="Chave K de Alice" value={toHex(run.dec.K)} mono />
                <Row label="Texto cifrado conferiu?" value={run.dec.valid ? 'Sim (c′ = c)' : 'Não: rejeição implícita'} />
                {run.maxNoise !== null && <Row label="Maior ruído na decifragem" value={`${run.maxNoise} (limite q/4 = ${run.noiseLimit})`} />}
                <tr>
                  <th scope="row" className="py-2 pr-4 font-semibold">Alice e Bob têm a mesma chave?</th>
                  <td className={`py-2 font-semibold ${run.keysMatch ? 'text-k-secret' : 'text-danger'}`}>{run.keysMatch ? 'Sim' : 'Não: a adulteração foi neutralizada'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout variant={run.input.tamper ? 'warn' : 'ok'} title="O que isto mostra">
            <p>{run.verdictText}</p>
          </Callout>
        </LabSection>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Parte C: tamanhos
interface SizeRow {
  name: string;
  pub: number;
  out: number;
  secret: number;
  quantum: string;
  note: string;
}

const ROWS = (): SizeRow[] => {
  const m = [ML_KEM_512, ML_KEM_768, ML_KEM_1024].map((p) => ({ p, s: sizes(p) }));
  const cat = ['1 (como o AES-128)', '3 (como o AES-192)', '5 (como o AES-256)'];
  return [
    { name: 'X25519 (ECDH)', pub: 32, out: 32, secret: 32, quantum: 'Quebrado pelo algoritmo de Shor', note: 'Chave pública de cada lado.' },
    { name: 'ECDH P-256', pub: 65, out: 65, secret: 32, quantum: 'Quebrado pelo algoritmo de Shor', note: 'Ponto não comprimido (04 ‖ x ‖ y).' },
    ...m.map(({ p, s }, i) => ({ name: p.name, pub: s.ek, out: s.ciphertext, secret: s.sharedSecret, quantum: `Resiste (categoria NIST ${cat[i]})`, note: 'Chave de encapsulamento e texto cifrado.' })),
    { name: 'X25519 + ML-KEM-768 (híbrido)', pub: 32 + m[1].s.ek, out: 32 + m[1].s.ciphertext, secret: 64, quantum: 'Resiste se o ML-KEM resistir; resiste a ataques clássicos se o X25519 resistir', note: 'Key share do cliente e do servidor no TLS 1.3 (os dois segredos são concatenados).' },
  ];
};

export function SizesPanel() {
  const rows = ROWS();
  return (
    <>
      <LabSection id="pq-sizes" title="4. Tamanhos em bytes">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <caption className="mb-2 text-left text-lg font-semibold">Estabelecimento de chaves: o que cada lado envia</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-4">Algoritmo</th>
                <th scope="col" className="py-2 pr-4">Chave pública (A para B)</th>
                <th scope="col" className="py-2 pr-4">Resposta (B para A)</th>
                <th scope="col" className="py-2 pr-4">Segredo</th>
                <th scope="col" className="py-2 pr-4">Diante de um computador quântico</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-line align-top">
                  <th scope="row" className="py-2 pr-4 font-semibold">{r.name}</th>
                  <td className="py-2 pr-4 font-mono">{r.pub}</td>
                  <td className="py-2 pr-4 font-mono">{r.out}</td>
                  <td className="py-2 pr-4 font-mono">{r.secret}</td>
                  <td className="py-2 pr-4">{r.quantum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-base text-muted">
          No ML-KEM, a chave de encapsulamento tem 384·k + 32 bytes e o texto cifrado tem 32·(d_u·k + d_v) bytes. A chave compartilhada tem sempre 32 bytes.
        </p>
      </LabSection>
      <LabSection id="pq-migration" title="5. Migração">
        <div className="grid gap-4 md:grid-cols-2">
          <Callout variant="danger" title="Colher agora, decifrar depois">
            <p>
              O acordo de chaves é público: Eva pode gravar hoje o tráfego e guardá-lo. Quando existir um computador quântico capaz de executar o algoritmo de Shor, ela recupera as chaves de sessão
              e lê tudo o que foi gravado. Segredos que devem durar décadas já estão em risco, e por isso a troca de chaves é a primeira a migrar.
            </p>
          </Callout>
          <Callout variant="info" title="E a criptografia simétrica?">
            <p>
              O algoritmo de Grover reduz a segurança de uma chave simétrica à metade dos bits: o AES-256 continua com cerca de 128 bits, o que é suficiente. Funções de hash como SHA-256 e SHA-3
              também seguem em uso. O que muda é a parte assimétrica.
            </p>
          </Callout>
          <Callout variant="ok" title="Modo híbrido">
            <p>
              Os navegadores e servidores atuais combinam X25519 e ML-KEM-768 e concatenam os dois segredos antes de derivar as chaves do TLS. Se um dos dois algoritmos cair, o outro ainda protege.
              O custo é de {32 + sizes(ML_KEM_768).ek} bytes no key_share do cliente (contra 32 do X25519).
            </p>
          </Callout>
          <Callout variant="warn" title="Assinaturas">
            <p>
              O ML-KEM só estabelece chaves. Para assinaturas, o NIST padronizou o ML-DSA (FIPS 204, reticulados) e o SLH-DSA (FIPS 205, baseado em hash), que substituirão o RSA e o ECDSA em
              certificados. Este laboratório trata apenas do estabelecimento de chaves.
            </p>
          </Callout>
        </div>
      </LabSection>
    </>
  );
}
