import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { engines } from '../../crypto/local/needhamSchroeder';
import { cipherHex, hex, PRINCIPAL_NAME, type NsRun, type Scenario, type Variant } from '../../crypto/needhamSchroeder';
import { randomBytes } from '../../crypto/random';
import { Callout, LabSection, ReviewQuestions, Standards, Tabs, buttonClass } from '../../components/ui';
import { NS_OBJECTIVES, NS_QUESTIONS } from './content';
import { buildNsProtocol } from './flows';

type Part = 'a' | 'b' | 'c';

const short = (h: string) => (h.length <= 20 ? h : `${h.slice(0, 20)}…`);

/** Fonte de octetos a partir de uma semente aleatória: sortear de novo gera novas chaves e nonces. */
function seededFrom(seed: Uint8Array) {
  let pos = 0;
  let x = ((seed[0] << 24) | (seed[1] << 16) | (seed[2] << 8) | seed[3]) >>> 0 || 1;
  return (n: number) =>
    Uint8Array.from({ length: n }, () => {
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      return (x ^ seed[4 + (pos++ % (seed.length - 4))]) & 0xff;
    });
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <tr className="border-b border-line">
      <th scope="row" className="py-2 pr-4 align-top font-semibold">
        {label}
      </th>
      <td className={`py-2 ${mono ? 'break-all font-mono text-base' : ''}`}>{value}</td>
    </tr>
  );
}

function NsPanel({ id, variant, scenario }: { id: string; variant: Variant; scenario: Scenario }) {
  const [seed, setSeed] = useState(() => randomBytes(36));
  const [run, setRun] = useState<NsRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    engines.ns
      .run({ variant, scenario, rand: seededFrom(seed) })
      .then((r) => {
        if (!cancelled) {
          setRun(r);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao executar.');
      });
    return () => {
      cancelled = true;
    };
  }, [seed, variant, scenario]);
  const definition = useMemo(() => (run ? buildNsProtocol(run) : null), [run]);

  return (
    <>
      <LabSection id={`${id}-params`} title="Parâmetros configuráveis">
        <p className="text-lg">Os pares de chaves RSA (módulo de 128 bits) e os nonces são sorteados com a Web Crypto. Sortear de novo gera uma execução inteira nova.</p>
        <div>
          <button type="button" className={buttonClass} onClick={() => setSeed(randomBytes(36))}>
            Sortear novas chaves e nonces (aleatório seguro)
          </button>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {error}
          </p>
        )}
      </LabSection>

      <LabSection id={`${id}-viz`} title="Visualização animada">
        {run && definition ? <ProtocolPlayer definition={definition} resetKey={`${cipherHex(run.messages[0].cipher)}|${variant}|${scenario}`} /> : <p className="text-lg text-muted">Preparando a execução…</p>}
      </LabSection>

      {run && (
        <LabSection id={`${id}-results`} title="Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados da execução do Needham-Schroeder</caption>
              <tbody>
                <Row label="Versão" value={run.variant === 'corrigido' ? 'com a correção de Lowe (identidade de Bob na mensagem 2)' : 'original, de 1978'} />
                <Row label="Alice inicia a sessão com" value={PRINCIPAL_NAME[run.aliceTalksTo]} />
                <Row label="Nonce Na (hex)" value={hex(run.na)} mono />
                <Row label="Nonce Nb (hex)" value={hex(run.nb)} mono />
                {run.messages.map((m, i) => (
                  <Row
                    key={i}
                    label={`Mensagem ${m.step}${m.relayedByEva ? ' (Eva)' : ''}`}
                    value={`${PRINCIPAL_NAME[m.from]} → ${PRINCIPAL_NAME[m.to]}, cifrada para ${PRINCIPAL_NAME[m.encryptedFor]}: ${short(cipherHex(m.cipher))}`}
                    mono
                  />
                ))}
                <Row label="Conclusão de Alice" value={run.aliceCheck.reason} />
                <Row label="Conclusão de Bob" value={run.bobBelievesPeer ? `autenticou ${PRINCIPAL_NAME[run.bobBelievesPeer]}` : 'não concluiu a autenticação'} />
                <Row label="Eva conhece Na?" value={run.evaKnowsNa ? 'sim' : 'não'} />
                <Row label="Eva conhece Nb?" value={run.evaKnowsNb ? 'sim' : 'não'} />
                <Row label="Resultado" value={run.attackSucceeded ? 'ataque bem-sucedido: Bob autenticou Eva como se fosse Alice' : scenario === 'ataque' ? 'ataque barrado por Alice' : 'autenticação mútua correta'} />
              </tbody>
            </table>
          </div>
        </LabSection>
      )}
    </>
  );
}

function Comparison() {
  const rows = [
    ['Needham-Schroeder de chave pública (1978)', 'Pares de chaves pública e privada', 'Nenhum', 'Falha de Lowe (1995): a mensagem 2 não identifica o respondente'],
    ['Com a correção de Lowe', 'Pares de chaves pública e privada', 'Nenhum', 'Sem falha conhecida; a mensagem 2 leva a identidade de Bob'],
    ['Needham-Schroeder simétrico (1978)', 'Chave de longo prazo de cada um com o servidor S', 'Servidor de chaves S', 'Falha de Denning e Sacco (1981): repetição de bilhete com chave antiga'],
    ['Kerberos (RFC 4120)', 'Chave de longo prazo de cada um com o KDC', 'AS e TGS (centro de distribuição de chaves)', 'Carimbos de tempo e validade; exige relógios sincronizados'],
  ];
  return (
    <LabSection id="ns-comparison" title="Comparação com a versão simétrica e o Kerberos">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-base">
          <caption className="mb-1 text-left text-base text-muted">Protocolos de autenticação da família Needham-Schroeder</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4">Protocolo</th>
              <th scope="col" className="py-2 pr-4">Chaves de longo prazo</th>
              <th scope="col" className="py-2 pr-4">Terceiro de confiança</th>
              <th scope="col" className="py-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 font-semibold">{r[0]}</th>
                {r.slice(1).map((c, i) => (
                  <td key={i} className={`py-2 ${i < 2 ? 'pr-4' : ''}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Callout variant="info" title="Por que a versão simétrica não é simulada aqui">
        <p>
          A versão simétrica exige um servidor de chaves, um quarto participante além de Alice, Bob e Eva. O laboratório se concentra no protocolo de chave pública, em que a falha de Lowe aparece apenas com os três atores de sempre.
        </p>
      </Callout>
    </LabSection>
  );
}

const PART_INFO: Record<Part, { title: string; text: string }> = {
  a: {
    title: 'Parte A: o protocolo original',
    text: 'Alice e Bob executam as três mensagens do protocolo de 1978 e se autenticam mutuamente. Eva vê apenas texto cifrado e nada aprende. Acompanhe o que cada um decifra e confere.',
  },
  b: {
    title: 'Parte B: o ataque de Lowe',
    text: 'Alice inicia uma sessão com Eva, um participante legítimo. Eva reaproveita a sessão para se passar por Alice diante de Bob, obtém Na e Nb, e Bob a autentica como se fosse Alice. É o ataque de Lowe.',
  },
  c: {
    title: 'Parte C: a correção e a comparação',
    text: 'Com a identidade de Bob dentro da mensagem 2, o protocolo funciona na sessão normal e, sob o mesmo ataque, Alice percebe o desencontro e aborta. Veja também a comparação com a versão simétrica e o Kerberos.',
  },
};

export default function NsLab() {
  const [part, setPart] = useState<Part>('a');
  const [fixedScenario, setFixedScenario] = useState<Scenario>('normal');
  return (
    <div className="space-y-10">
      <LabSection id="ns-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {NS_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="ns-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          O <strong>protocolo de Needham-Schroeder de chave pública</strong> (1978) permite que Alice e Bob, que conhecem as chaves públicas um do outro, se <strong>autentiquem mutuamente</strong> trocando
          três mensagens cifradas. Cada um prova que possui a sua chave privada devolvendo um <strong>nonce</strong> (número aleatório usado uma vez) que só quem a possui conseguiria ler.
        </p>
        <p className="text-lg">
          Durante 17 anos o protocolo foi considerado correto. Em 1995, <strong>Gavin Lowe</strong> mostrou que Eva, um participante legítimo do sistema, pode usar uma sessão que Alice iniciou com ela para se
          passar por Alice diante de Bob. A falha é de projeto (a mensagem 2 não diz quem a gerou), e não de criptografia: não depende de quebrar o RSA.
        </p>
        <Callout variant="info" title="Sobre o laboratório">
          <p>
            A cifra é RSA didático sem padding, com módulo de 128 bits, <strong>inseguro como cifra real</strong>: o foco é a lógica de autenticação, e não a robustez da cifra. Uso exclusivamente didático.
          </p>
        </Callout>
        <Standards
          items={[
            'Needham, R. M.; Schroeder, M. D. Using encryption for authentication in large networks of computers. Communications of the ACM, v. 21, n. 12, p. 993-999, 1978',
            'Lowe, G. An attack on the Needham-Schroeder public-key authentication protocol. Information Processing Letters, v. 56, n. 3, p. 131-133, 1995',
            'Denning, D. E.; Sacco, G. M. Timestamps in key distribution protocols. Communications of the ACM, v. 24, n. 8, p. 533-536, 1981',
            'RFC 4120 (Kerberos versão 5), com atualizações como a RFC 8429',
          ]}
        />
        <Tabs
          label="Parte do laboratório"
          value={part}
          onChange={setPart}
          tabs={[
            { id: 'a', label: 'Parte A: o protocolo original' },
            { id: 'b', label: 'Parte B: o ataque de Lowe' },
            { id: 'c', label: 'Parte C: a correção e a comparação' },
          ]}
        />
        <Callout variant="info" title={PART_INFO[part].title}>
          <p>{PART_INFO[part].text}</p>
        </Callout>
      </LabSection>

      {part === 'a' && <NsPanel key="a" id="ns-a" variant="original" scenario="normal" />}
      {part === 'b' && <NsPanel key="b" id="ns-b" variant="original" scenario="ataque" />}
      {part === 'c' && (
        <>
          <LabSection id="ns-c-scenario" title="Cenário da Parte C">
            <Tabs
              label="Cenário"
              value={fixedScenario}
              onChange={setFixedScenario}
              tabs={[
                { id: 'normal', label: 'Sessão normal com a correção' },
                { id: 'ataque', label: 'O mesmo ataque, agora barrado' },
              ]}
            />
          </LabSection>
          <NsPanel key={`c-${fixedScenario}`} id="ns-c" variant="corrigido" scenario={fixedScenario} />
          <Comparison />
        </>
      )}

      <LabSection id="ns-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={NS_QUESTIONS} />
      </LabSection>
    </div>
  );
}
