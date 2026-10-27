import { useEffect, useState } from 'react';
import { rc4Stream } from '../../crypto/rc4';
import { Callout, LabSection } from '../../components/ui';

const POSITIONS = 8;
const EXPECTED = 1 / 256;

interface BiasResult {
  trials: number;
  drop: number;
  zeros: number[];
}

async function measure(trials: number, drop: number, isCancelled: () => boolean): Promise<BiasResult | null> {
  const zeros = new Array<number>(POSITIONS).fill(0);
  const chunk = 2000;
  for (let done = 0; done < trials; done += chunk) {
    const end = Math.min(trials, done + chunk);
    for (let t = done; t < end; t++) {
      const ks = rc4Stream(crypto.getRandomValues(new Uint8Array(16)), POSITIONS, drop);
      for (let p = 0; p < POSITIONS; p++) if (ks[p] === 0) zeros[p]++;
    }
    if (isCancelled()) return null;
    await new Promise((r) => setTimeout(r, 0));
  }
  return { trials, drop, zeros };
}

export function PartC() {
  const [trials, setTrials] = useState(20000);
  const [drop, setDrop] = useState<0 | 256>(0);
  const [result, setResult] = useState<BiasResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    measure(trials, drop, () => cancelled).then((r) => {
      if (!cancelled && r) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [trials, drop]);

  const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%`;

  return (
    <LabSection id="rc4-c" title="3. Parte C: vieses do fluxo e situação atual">
      <div className="space-y-10">
        <div className="space-y-4">
          <h3 className="text-xl font-bold">C.1 O segundo byte do RC4 vale zero com o dobro da probabilidade</h3>
          <p className="text-lg">
            Um fluxo realmente aleatório teria cada byte igual a zero com probabilidade 1/256 (cerca de 0,391%). Mantin e Shamir (2001) mostraram que, no RC4, o <strong>segundo byte</strong> do fluxo é zero com
            probabilidade próxima de 2/256. O experimento sorteia chaves de 16 bytes e conta os zeros em cada uma das 8 primeiras posições.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="bias-trials" className="mb-1 block text-base font-semibold">
                Chaves sorteadas
              </label>
              <select id="bias-trials" value={trials} onChange={(e) => setTrials(Number(e.target.value))} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-lg">
                <option value={10000}>10.000</option>
                <option value={20000}>20.000</option>
                <option value={50000}>50.000</option>
                <option value={100000}>100.000</option>
              </select>
            </div>
            <div>
              <label htmlFor="bias-drop" className="mb-1 block text-base font-semibold">
                Início do fluxo
              </label>
              <select id="bias-drop" value={drop} onChange={(e) => setDrop(Number(e.target.value) as 0 | 256)} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-lg">
                <option value={0}>desde o primeiro byte</option>
                <option value={256}>descartando os 256 primeiros bytes</option>
              </select>
            </div>
          </div>
          {result ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base">
                <caption className="mb-1 text-left text-base text-muted">
                  Frequência do valor zero em cada posição ({result.trials.toLocaleString('pt-BR')} chaves; esperado em um fluxo aleatório: {pct(EXPECTED)})
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-4">Posição no fluxo</th>
                    <th scope="col" className="py-2 pr-4">Zeros</th>
                    <th scope="col" className="py-2 pr-4">Frequência</th>
                    <th scope="col" className="py-2">Razão sobre o esperado</th>
                  </tr>
                </thead>
                <tbody>
                  {result.zeros.map((z, p) => {
                    const ratio = z / result.trials / EXPECTED;
                    return (
                      <tr key={p} className={`border-b border-line ${ratio > 1.5 ? 'font-bold' : ''}`}>
                        <th scope="row" className="py-2 pr-4 font-semibold">{p + 1}º byte</th>
                        <td className="py-2 pr-4">{z}</td>
                        <td className="py-2 pr-4">{pct(z / result.trials)}</td>
                        <td className="py-2">
                          {ratio.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×{ratio > 1.5 ? ' (enviesado)' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p role="status" className="text-base text-muted">Calculando…</p>
          )}
          <Callout variant="info" title="Consequência prática">
            <p>
              Se a mesma mensagem for cifrada com muitas chaves diferentes (por exemplo, um cookie de sessão repetido em cada conexão TLS), o atacante conta qual valor aparece mais vezes em cada posição e recupera o
              claro. Por isso se descartam os primeiros bytes do fluxo (RC4-drop), mas outros vieses persistem em posições posteriores, e o uso do RC4 foi proibido no TLS.
            </p>
          </Callout>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-bold">C.2 Linha do tempo e comparação</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <caption className="mb-1 text-left text-base text-muted">Cifras de fluxo estudadas nos laboratórios</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-4">Cifra</th>
                  <th scope="col" className="py-2 pr-4">Chave</th>
                  <th scope="col" className="py-2 pr-4">Nonce ou IV</th>
                  <th scope="col" className="py-2 pr-4">Estado</th>
                  <th scope="col" className="py-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['RC4', '1 a 256 bytes', 'não tem (o WEP acrescentou um IV de 24 bits)', '256 bytes', 'proibido no TLS (RFC 7465); abandonado no SSH (RFC 8758) e no Wi-Fi'],
                  ['ChaCha20', '256 bits', '96 bits, mais contador', '64 bytes por bloco', 'padrão atual (RFC 8439)'],
                  ['AES-CTR', '128 ou 256 bits', 'nonce e contador', 'bloco de 128 bits', 'aprovado (FIPS 197 e SP 800-38A)'],
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
              <li>1987: Ron Rivest cria o RC4 para a RSA Security, como segredo industrial.</li>
              <li>1994: o código é divulgado anonimamente e passa a circular como ARCFOUR.</li>
              <li>1997: o WEP adota o RC4 no padrão IEEE 802.11 com IV de 24 bits.</li>
              <li>2001: Mantin e Shamir mostram o viés do segundo byte; Fluhrer, Mantin e Shamir publicam o ataque contra o WEP, e em seguida surgem ferramentas públicas que o exploram.</li>
              <li>2003 e 2004: o WPA e o WPA2 (IEEE 802.11i) substituem o WEP.</li>
              <li>2015: a RFC 7465 proíbe o RC4 no TLS. 2020: a RFC 8758 o descontinua no SSH.</li>
            </ul>
          </Callout>
        </div>
      </div>
    </LabSection>
  );
}
