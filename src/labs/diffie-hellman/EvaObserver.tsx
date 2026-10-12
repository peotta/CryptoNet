import { useState } from 'react';
import { Formula } from '../../animations/Formula';
import { bruteForceDiscreteLog, type DhSession } from '../../crypto/diffieHellman';
import { modPow } from '../../crypto/bigmath';
import { Callout, buttonClass } from '../../components/ui';

const BRUTE_FORCE_LIMIT = 5_000_000n;

/** Visão de Eva: o que ela vê no canal, o que não vê e por que a busca exaustiva só funciona em grupos minúsculos. */
export function EvaObserver({ session }: { session: DhSession }) {
  const { p, g, A, B, kAlice } = session;
  const [result, setResult] = useState<string | null>(null);
  const feasible = p <= BRUTE_FORCE_LIMIT;

  function attack() {
    const t0 = performance.now();
    const r = bruteForceDiscreteLog(g, A, p, Number(BRUTE_FORCE_LIMIT));
    const ms = (performance.now() - t0).toFixed(2).replace('.', ',');
    if (!r.found || r.exponent === null) {
      setResult('Eva não encontrou um expoente no limite de tentativas.');
      return;
    }
    const k = modPow(B, r.exponent, p);
    setResult(
      `Eva encontrou x = ${r.exponent} com g^x ≡ A (mod p) após ${r.iterations} tentativas (${ms} ms) e calculou K = B^x mod p = ${k}${
        k === kAlice ? ', idêntico ao segredo de Alice e Bob' : ''
      }. O segredo foi quebrado porque o grupo é minúsculo.`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border-2 border-k-public bg-k-public/10 p-4">
          <h3 className="mb-2 text-xl font-bold">Eva observa no canal</h3>
          <ul className="space-y-1 text-lg">
            <li><Formula tex={`p = ${p}`} /></li>
            <li><Formula tex={`g = ${g}`} /></li>
            <li><Formula tex={`A = ${A}`} /></li>
            <li><Formula tex={`B = ${B}`} /></li>
          </ul>
        </div>
        <div className="rounded-xl border-2 border-dashed border-k-private bg-k-private/10 p-4">
          <h3 className="mb-2 text-xl font-bold">Eva não observa</h3>
          <ul className="space-y-1 text-lg">
            <li><Formula tex="a" />: segredo privado de Alice, nunca transmitido</li>
            <li><Formula tex="b" />: segredo privado de Bob, nunca transmitido</li>
            <li><Formula tex="K = g^{ab} mod p" />: calculado localmente por cada lado</li>
          </ul>
        </div>
      </div>
      <p className="text-lg">
        Para obter K, Eva teria de resolver o <strong>problema do logaritmo discreto</strong>: dado <Formula tex="A = g^{a} mod p" />, encontrar a. Em um grupo adequado
        (por exemplo, p primo seguro de 2048 bits), não se conhece algoritmo eficiente; as estimativas de segurança do NIST associam esse tamanho a cerca de 112 bits de
        segurança.
      </p>
      <Callout variant="warn" title="Os parâmetros deste laboratório são didáticos">
        <p>
          Com p = {p.toString()}, o espaço de busca tem no máximo {(p - 2n).toString()} expoentes. Isso <strong>não oferece segurança real</strong>: a busca exaustiva abaixo termina
          imediatamente.
        </p>
      </Callout>
      <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
        <button type="button" className={buttonClass} onClick={attack} disabled={!feasible}>
          Eva tenta recuperar a por força bruta
        </button>
        {!feasible && <p className="text-base text-muted">Desabilitado: p excede o limite de {BRUTE_FORCE_LIMIT.toString()} para não travar o navegador.</p>}
        {result && (
          <p role="status" className="text-lg">
            {result}
          </p>
        )}
      </div>
    </div>
  );
}
