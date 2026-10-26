import { useEffect, useState } from 'react';
import { bitsToBytes, complementBytes, hammingBits, SEMI_WEAK_PAIRS, WEAK_KEYS, type DesTrace } from '../../crypto/des';
import { engines } from '../../crypto/local/des';
import { toHex } from '../../crypto/encoding';
import { Callout, Field, LabSection } from '../../components/ui';
import { fromHexInput } from './BitsView';

const HEX16 = /^[0-9a-fA-F]{16}$/;

export function PartC() {
  return (
    <LabSection id="des-c" title="3. Parte C: propriedades do DES">
      <div className="space-y-10">
        <Avalanche />
        <Complement />
        <WeakKeys />
        <Comparison />
      </div>
    </LabSection>
  );
}

function Avalanche() {
  const [keyHex, setKeyHex] = useState('133457799bbcdff1');
  const [blockHex, setBlockHex] = useState('0123456789abcdef');
  const [target, setTarget] = useState<'claro' | 'chave'>('claro');
  const [bit, setBit] = useState('1');
  const [pair, setPair] = useState<[DesTrace, DesTrace] | null>(null);
  const keyErr = HEX16.test(keyHex) ? null : 'A chave tem 16 dígitos hexadecimais.';
  const blockErr = HEX16.test(blockHex) ? null : 'O bloco tem 16 dígitos hexadecimais.';
  const n = Number(bit);
  const bitErr = Number.isInteger(n) && n >= 1 && n <= 64 ? null : 'Informe um bit de 1 a 64.';
  const keyParity = target === 'chave' && n % 8 === 0 && !bitErr ? 'Os bits 8, 16, ..., 64 da chave são de paridade e não entram no cálculo: nada muda.' : null;
  const err = keyErr ?? blockErr ?? bitErr;

  useEffect(() => {
    if (err) {
      setPair(null);
      return;
    }
    let cancelled = false;
    const key = fromHexInput(keyHex);
    const block = fromHexInput(blockHex);
    const flip = (b: Uint8Array) => {
      const c = b.slice();
      c[(n - 1) >> 3] ^= 0x80 >> ((n - 1) & 7);
      return c;
    };
    Promise.all([engines.des.trace(key, block, false), engines.des.trace(target === 'chave' ? flip(key) : key, target === 'claro' ? flip(block) : block, false)]).then(([a, b]) => {
      if (!cancelled) setPair([a, b]);
    });
    return () => {
      cancelled = true;
    };
  }, [keyHex, blockHex, target, n, err]);

  const rows = pair
    ? [
        { r: 0, d: hammingBits(pair[0].afterIp, pair[1].afterIp) },
        ...pair[0].rounds.map((x, i) => ({ r: i + 1, d: hammingBits([...x.newL, ...x.newR], [...pair[1].rounds[i].newL, ...pair[1].rounds[i].newR]) })),
        { r: 17, d: hammingBits(pair[0].output, pair[1].output) },
      ]
    : [];

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">C.1 Efeito avalanche rodada a rodada</h3>
      <p className="text-lg">
        Uma boa cifra de bloco difunde: trocar um bit da entrada (ou da chave) deve alterar cerca de metade dos bits da saída. Veja quantos dos 64 bits de (L, R) diferem entre as duas execuções ao fim de cada rodada.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="av-key" label="Chave (hexadecimal)" value={keyHex} onChange={(v) => setKeyHex(v.trim())} error={keyErr} inputMode="text" maxLength={16} />
        <Field id="av-block" label="Bloco do claro (hexadecimal)" value={blockHex} onChange={(v) => setBlockHex(v.trim())} error={blockErr} inputMode="text" maxLength={16} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="av-target" className="mb-1 block text-base font-semibold">
            Inverter um bit do(a)
          </label>
          <select id="av-target" value={target} onChange={(e) => setTarget(e.target.value as 'claro' | 'chave')} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-lg">
            <option value="claro">texto claro</option>
            <option value="chave">chave</option>
          </select>
        </div>
        <Field id="av-bit" label="Posição do bit (1 a 64)" value={bit} onChange={(v) => setBit(v.trim())} error={bitErr} />
      </div>
      {keyParity && <p role="status" className="text-base font-semibold">{keyParity}</p>}
      {pair && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <caption className="mb-1 text-left text-base text-muted">Bits diferentes entre as duas execuções ao fim de cada etapa</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-4">Etapa</th>
                <th scope="col" className="py-2 pr-4">Bits diferentes (de 64)</th>
                <th scope="col" className="py-2">Proporção</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.r} className="border-b border-line">
                  <th scope="row" className="py-2 pr-4 font-semibold">{x.r === 0 ? 'Depois da IP' : x.r === 17 ? 'Saída (depois da FP)' : `Rodada ${x.r}`}</th>
                  <td className="py-2 pr-4">{x.d}</td>
                  <td className="py-2">
                    <span aria-hidden="true" className="inline-block h-3 rounded bg-accent align-middle" style={{ width: `${(x.d / 64) * 160}px` }} />
                    <span className="ml-2">{Math.round((x.d / 64) * 100)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Callout variant="info" title="Como ler">
        <p>
          Alterar o claro muda poucos bits nas primeiras rodadas e, por volta da quinta ou da sexta, a diferença já se espalha por quase todo o bloco, ficando perto de 50%. Isso é a combinação de confusão (caixas S)
          e difusão (expansão E e permutação P).
        </p>
      </Callout>
    </div>
  );
}

function Complement() {
  const [keyHex, setKeyHex] = useState('133457799bbcdff1');
  const [blockHex, setBlockHex] = useState('0123456789abcdef');
  const [res, setRes] = useState<{ a: string; b: string; notA: string } | null>(null);
  const keyErr = HEX16.test(keyHex) ? null : 'A chave tem 16 dígitos hexadecimais.';
  const blockErr = HEX16.test(blockHex) ? null : 'O bloco tem 16 dígitos hexadecimais.';
  const err = keyErr ?? blockErr;

  useEffect(() => {
    if (err) {
      setRes(null);
      return;
    }
    let cancelled = false;
    const key = fromHexInput(keyHex);
    const block = fromHexInput(blockHex);
    Promise.all([engines.des.block(key, block, false), engines.des.block(complementBytes(key), complementBytes(block), false)]).then(([a, b]) => {
      if (!cancelled) setRes({ a: toHex(a), b: toHex(b), notA: toHex(complementBytes(a)) });
    });
    return () => {
      cancelled = true;
    };
  }, [keyHex, blockHex, err]);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">C.2 A propriedade do complemento</h3>
      <p className="text-lg">
        O DES tem uma simetria: se todos os bits da chave e do claro forem invertidos, a cifra sai com todos os bits invertidos, ou seja, DES(~K, ~P) = ~DES(K, P). Em um ataque de texto claro escolhido, isso permite
        testar duas chaves por cifragem e reduz a busca de 2^56 para 2^55.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="cp-key" label="Chave K (hexadecimal)" value={keyHex} onChange={(v) => setKeyHex(v.trim())} error={keyErr} inputMode="text" maxLength={16} />
        <Field id="cp-block" label="Claro P (hexadecimal)" value={blockHex} onChange={(v) => setBlockHex(v.trim())} error={blockErr} inputMode="text" maxLength={16} />
      </div>
      {res && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-lg">
            <caption className="sr-only">Verificação da propriedade do complemento</caption>
            <tbody>
              <tr className="border-b border-line"><th scope="row" className="py-2 pr-4 font-semibold">DES(K, P)</th><td className="py-2 font-mono text-base">{res.a}</td></tr>
              <tr className="border-b border-line"><th scope="row" className="py-2 pr-4 font-semibold">~DES(K, P)</th><td className="py-2 font-mono text-base">{res.notA}</td></tr>
              <tr className="border-b border-line"><th scope="row" className="py-2 pr-4 font-semibold">DES(~K, ~P)</th><td className="py-2 font-mono text-base">{res.b}</td></tr>
              <tr>
                <th scope="row" className="py-2 pr-4 font-semibold">DES(~K, ~P) = ~DES(K, P)?</th>
                <td className="py-2 font-semibold text-k-secret">{res.b === res.notA ? 'Sim, para qualquer K e P' : 'Não'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WeakKeys() {
  const options = [
    ...WEAK_KEYS.map((w) => ({ id: toHex(w.key), label: `Fraca: ${toHex(w.key).toUpperCase()}`, pair: null as Uint8Array | null })),
    ...SEMI_WEAK_PAIRS.map(([a, b]) => ({ id: toHex(a), label: `Semifraca: ${toHex(a).toUpperCase()} e ${toHex(b).toUpperCase()}`, pair: b })),
  ];
  const [sel, setSel] = useState(options[0].id);
  const [blockHex, setBlockHex] = useState('0123456789abcdef');
  const [data, setData] = useState<{ subkeys: string[]; distinct: number; once: string; twice: string; back: boolean } | null>(null);
  const blockErr = HEX16.test(blockHex) ? null : 'O bloco tem 16 dígitos hexadecimais.';
  const opt = options.find((o) => o.id === sel) ?? options[0];

  useEffect(() => {
    if (blockErr) {
      setData(null);
      return;
    }
    let cancelled = false;
    const k = fromHexInput(opt.id);
    const k2 = opt.pair ?? k;
    const p = fromHexInput(blockHex);
    (async () => {
      const ks = await engines.des.keySchedule(k);
      const once = await engines.des.block(k, p, false);
      const twice = await engines.des.block(k2, once, false);
      if (!cancelled) {
        const subkeys = ks.rounds.map((r) => toHex(bitsToBytes(r.key)));
        setData({ subkeys, distinct: new Set(subkeys).size, once: toHex(once), twice: toHex(twice), back: toHex(twice) === toHex(p) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opt, blockHex, blockErr]);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">C.3 Chaves fracas e semifracas</h3>
      <p className="text-lg">
        Como C e D giram dentro de blocos de bits iguais, existem 4 chaves <strong>fracas</strong>, para as quais as 16 subchaves são iguais, de modo que cifrar duas vezes devolve o texto
        claro. Existem ainda 6 pares de chaves <strong>semifracas</strong>: cifrar com uma e depois com a outra do par desfaz a cifragem. São 16 chaves em 2^56 (4 fracas e 12 semifracas): improváveis ao acaso, mas devem ser evitadas.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="wk-key" className="mb-1 block text-base font-semibold">
            Chave
          </label>
          <select id="wk-key" value={sel} onChange={(e) => setSel(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg">
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Field id="wk-block" label="Claro P (hexadecimal)" value={blockHex} onChange={(v) => setBlockHex(v.trim())} error={blockErr} inputMode="text" maxLength={16} />
      </div>
      {data && (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados para a chave fraca ou semifraca escolhida</caption>
              <tbody>
                <tr className="border-b border-line"><th scope="row" className="py-2 pr-4 font-semibold">Subchaves distintas (de 16)</th><td className="py-2">{data.distinct}</td></tr>
                <tr className="border-b border-line"><th scope="row" className="py-2 pr-4 font-semibold">Primeira cifragem</th><td className="py-2 font-mono text-base">{data.once}</td></tr>
                <tr className="border-b border-line"><th scope="row" className="py-2 pr-4 font-semibold">{opt.pair ? 'Segunda cifragem, com a outra chave do par' : 'Segunda cifragem, com a mesma chave'}</th><td className="py-2 font-mono text-base">{data.twice}</td></tr>
                <tr>
                  <th scope="row" className="py-2 pr-4 font-semibold">Voltou ao claro?</th>
                  <td className={`py-2 font-semibold ${data.back ? 'text-danger' : ''}`}>{data.back ? 'Sim: a segunda cifragem desfaz a primeira' : 'Não'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="break-all rounded-xl border border-line bg-surface p-3 font-mono text-base">
            <span className="font-sans font-semibold">Subchaves K1 a K16 (hex): </span>
            {data.subkeys.join(' ')}
          </p>
        </div>
      )}
    </div>
  );
}

function Comparison() {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">C.4 DES, Triple DES e AES</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-base">
          <caption className="mb-1 text-left text-base text-muted">Comparação das cifras de bloco</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4">Cifra</th>
              <th scope="col" className="py-2 pr-4">Bloco</th>
              <th scope="col" className="py-2 pr-4">Chave (útil)</th>
              <th scope="col" className="py-2 pr-4">Rodadas</th>
              <th scope="col" className="py-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['DES', '64 bits', '56 bits', '16', 'FIPS 46-3 retirada em 2005; quebrável por busca exaustiva'],
              ['Triple DES (3 chaves)', '64 bits', '168 bits armazenados, 112 de segurança', '48', 'SP 800-67 Rev. 2 retirada em 2024; vulnerável ao Sweet32'],
              ['AES-128', '128 bits', '128 bits', '10', 'FIPS 197 (vigente)'],
              ['AES-256', '128 bits', '256 bits', '14', 'FIPS 197 (vigente)'],
            ].map((r) => (
              <tr key={r[0]} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 font-semibold">{r[0]}</th>
                {r.slice(1).map((c, i) => (
                  <td key={i} className="py-2 pr-4">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Callout variant="info" title="Linha do tempo">
        <ul className="list-disc space-y-1 pl-5">
          <li>1977: o DES é publicado como FIPS 46, derivado do Lucifer da IBM, com ajustes da NSA nas caixas S e a chave reduzida a 56 bits.</li>
          <li>1998: a EFF constrói o DES Cracker por menos de US$ 250 mil e vence o DES Challenge II em 56 horas.</li>
          <li>1999: com a rede distributed.net, a chave é achada em 22 horas e 15 minutos; sai a FIPS 46-3, que recomenda o Triple DES.</li>
          <li>2001: o AES (FIPS 197) é publicado para substituir o DES.</li>
          <li>2005: o NIST retira a FIPS 46-3. 2016: o ataque Sweet32 mostra o limite dos blocos de 64 bits. 2024: o NIST retira o SP 800-67 Rev. 2 (Triple DES).</li>
        </ul>
      </Callout>
    </div>
  );
}
