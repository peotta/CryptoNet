import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { engines } from '../../crypto/local/kerberos';
import { randomBytes } from '../../crypto/random';
import type { KrbRun, KrbScenario } from '../../crypto/kerberos';
import { Callout, LabSection, ReviewQuestions, Standards, Tabs, buttonClass } from '../../components/ui';
import { buildProtocol, clock, DEFAULT_DICTIONARY, DEFAULT_NOW, DEFAULT_SKEW, parseDictionary, runScenario, STRONG_PASSWORD, WEAK_PASSWORD } from './flows';
import { KRB_OBJECTIVES, KRB_QUESTIONS } from './content';

const inputClass = 'min-h-11 rounded-lg border border-line bg-surface px-3 text-lg';

const INTROS: Record<KrbScenario, { variant: 'info' | 'warn' | 'danger'; title: string; text: string }> = {
  normal: { variant: 'info', title: 'O que se espera', text: 'Eva vê todas as mensagens, mas cada uma está cifrada com uma chave que ela não tem. Acompanhe as três trocas, uma etapa por vez.' },
  replay: { variant: 'warn', title: 'Repetição do autenticador', text: 'Eva reenvia o tíquete e o autenticador capturados. Marque a opção para ver a defesa: o serviço guardar os autenticadores já vistos.' },
  guess: { variant: 'danger', title: 'Adivinhar a senha', text: 'Eva pede ao KDC uma resposta para Alice e testa senhas offline. Alterne a pré-autenticação e a senha de Alice para ver o que muda.' },
};

function Err({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
      {children}
    </p>
  );
}

export default function KerberosLab() {
  const [scenario, setScenario] = useState<KrbScenario>('normal');
  const [password, setPassword] = useState(WEAK_PASSWORD);
  const [now, setNow] = useState(DEFAULT_NOW);
  const [skew, setSkew] = useState(DEFAULT_SKEW);
  const [replayCache, setReplayCache] = useState(false);
  const [preauth, setPreauth] = useState(false);
  const [dictText, setDictText] = useState(DEFAULT_DICTIONARY.join(', '));
  const [seed, setSeed] = useState(0);
  const [data, setData] = useState<KrbRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intro = INTROS[scenario];
  const dictionary = useMemo(() => parseDictionary(dictText), [dictText]);

  useEffect(() => {
    let cancelled = false;
    runScenario(engines.kerberos, { scenario, password, now, skew, replayCache, preauth, dictionary }, randomBytes)
      .then((r) => {
        if (!cancelled) {
          setData(r);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : 'Falha ao executar o cenário.');
        }
      });
    return () => {
      cancelled = true;
    };
    // seed força uma nova execução (novas chaves e nonces)
  }, [scenario, password, now, skew, replayCache, preauth, dictionary, seed]);

  const definition = useMemo(() => (data ? buildProtocol(data) : null), [data]);

  return (
    <div className="space-y-10">
      <LabSection id="kr-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {KRB_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="kr-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          O <strong>Kerberos</strong> (RFC 4120) autentica usuários e serviços numa rede insegura sem enviar senhas. Um terceiro de confiança, o <strong>KDC</strong> (centro de distribuição de
          chaves), conhece a chave de cada participante. Na troca <strong>AS</strong>, Alice obtém um <strong>TGT</strong> (tíquete de concessão de tíquetes); na troca <strong>TGS</strong>, troca o
          TGT por um tíquete para o serviço de Bob; na troca <strong>AP</strong>, apresenta esse tíquete a Bob, que não precisa falar com o KDC.
        </p>
        <p className="text-lg">
          Cada tíquete é cifrado com a chave de quem o consome, de modo que Alice o carrega sem poder lê-lo. Um <strong>autenticador</strong>, com o horário, mostra que quem apresenta o tíquete conhece a
          chave de sessão agora. A segurança depende da senha de Alice e de relógios sincronizados.
        </p>
        <Callout variant="info" title="Sobre o laboratório">
          <p>
            O palco tem quatro participantes: Alice, o KDC (que faz o papel do AS e do TGS), Eva e Bob. Os cenários são a troca normal, a repetição do autenticador e a adivinhação da senha. A
            criptografia é real (PBKDF2 e AES-256-GCM pela Web Crypto API), mas simplificada em relação ao RFC 3962; as chaves e os nonces são gerados no navegador e nada é armazenado.
          </p>
        </Callout>
        <Standards
          items={[
            'RFC 4120 (Kerberos V5), com as atualizações publicadas desde então, entre elas a RFC 8429 (recomendações sobre cifras)',
            'RFC 3962 (AES no Kerberos 5), RFC 6113 (framework de pré-autenticação e FAST) e RFC 6649 (abandono do DES e do RC4-HMAC-EXP)',
            'RFC 4121 (mecanismo GSS-API do Kerberos 5), como o Kerberos é usado pelas aplicações',
          ]}
        />
      </LabSection>

      <LabSection id="kr-cenario" title="3. Cenário">
        <Tabs
          label="Cenário"
          value={scenario}
          onChange={setScenario}
          tabs={[
            { id: 'normal', label: 'Troca normal' },
            { id: 'replay', label: 'Repetição do autenticador' },
            { id: 'guess', label: 'Adivinhar a senha' },
          ]}
        />
        <Callout variant={intro.variant} title={intro.title}>
          <p>{intro.text}</p>
        </Callout>
      </LabSection>

      <LabSection id="kr-params" title="4. Parâmetros configuráveis">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="kr-pass" className="mb-1 block text-base font-semibold">
              Senha de Alice
            </label>
            <input id="kr-pass" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={64} className={`${inputClass} w-64 font-mono`} />
          </div>
          <button type="button" className={buttonClass} onClick={() => setPassword(password === WEAK_PASSWORD ? STRONG_PASSWORD : WEAK_PASSWORD)}>
            Alternar senha fraca e forte
          </button>
          <div>
            <label htmlFor="kr-skew" className="mb-1 block text-base font-semibold">
              Tolerância de relógio (s)
            </label>
            <input id="kr-skew" type="number" min={1} max={3600} value={skew} onChange={(e) => setSkew(Number(e.target.value))} className={`${inputClass} w-28`} />
          </div>
          <div>
            <label htmlFor="kr-now" className="mb-1 block text-base font-semibold">
              Tempo Unix do AS-REQ
            </label>
            <input id="kr-now" type="number" min={0} value={now} onChange={(e) => setNow(Number(e.target.value))} aria-describedby="kr-now-hint" className={`${inputClass} w-44`} />
            <p id="kr-now-hint" className="mt-1 text-base text-muted">
              Equivale a {clock(now)}.
            </p>
          </div>
          <button type="button" className={buttonClass} onClick={() => setSeed((s) => s + 1)}>
            Sortear novas chaves e nonces
          </button>
        </div>
        {scenario === 'replay' && (
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" className="h-5 w-5" checked={replayCache} onChange={(e) => setReplayCache(e.target.checked)} />
            O serviço guarda os autenticadores já vistos e recusa a repetição
          </label>
        )}
        {scenario === 'guess' && (
          <>
            <label className="flex items-center gap-2 text-base">
              <input type="checkbox" className="h-5 w-5" checked={preauth} onChange={(e) => setPreauth(e.target.checked)} />
              O KDC exige a pré-autenticação
            </label>
            <div>
              <label htmlFor="kr-dict" className="mb-1 block text-base font-semibold">
                Dicionário de Eva (palavras separadas por vírgula)
              </label>
              <textarea id="kr-dict" value={dictText} onChange={(e) => setDictText(e.target.value)} rows={2} className={`${inputClass} w-full font-mono`} />
            </div>
          </>
        )}
        {error && <Err>{error}</Err>}
      </LabSection>

      <LabSection id="kr-viz" title="5. Visualização animada">
        {data && definition ? (
          <ProtocolPlayer definition={definition} resetKey={`${scenario}|${data.kcHex}|${data.katHex}|${data.kabHex}|${data.skew}|${data.replayCache}|${data.preauth}|${data.dictionary.join(',')}`} />
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros para ver a animação.</p>
        )}
      </LabSection>

      {data && (
        <LabSection id="kr-results" title="6. Painel de resultados">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-lg">
              <caption className="sr-only">Resultados do cenário</caption>
              <tbody>
                <Row label="Reino" value={data.realm} />
                <Row label="AS-REQ" value={clock(data.now)} />
                <Row label="Chave de Alice K_c (abreviada)" value={`${data.kcHex.slice(0, 16)}…`} mono />
                <Row label="Chave de sessão K_AB (abreviada)" value={`${data.kabHex.slice(0, 16)}…`} mono />
                <Row label="Alice abriu as respostas do KDC" value={data.aliceKnowsKab ? 'Sim' : 'Não'} />
                <Row label="Bob autenticou Alice" value={data.bobAcceptsAlice ? 'Sim' : 'Não'} />
                {scenario === 'replay' && <Row label="Reenvio de Eva" value={`${clock(data.replayTime)}, ${data.replayWithinSkew ? 'dentro' : 'fora'} da tolerância`} />}
                {scenario === 'guess' && <Row label="Palavras testadas por Eva" value={data.kdcAnswered ? `${data.tried.length} de ${data.dictionary.length}` : 'nenhuma (o KDC não respondeu)'} />}
                {scenario === 'guess' && <Row label="Senha encontrada" value={data.found ?? 'nenhuma'} mono />}
                {scenario !== 'normal' && (
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-semibold">
                      Eva se saiu bem?
                    </th>
                    <td className={`py-2 font-semibold ${data.ok ? 'text-k-secret' : 'text-danger'}`}>{data.ok ? 'Não' : 'Sim'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-lg">{data.verdictText}</p>
        </LabSection>
      )}

      <LabSection id="kr-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={KRB_QUESTIONS} />
      </LabSection>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <tr className="border-b border-line align-top">
      <th scope="row" className="w-1/3 py-2 pr-4 font-semibold">
        {label}
      </th>
      <td className={`break-all py-2 ${mono ? 'font-mono text-base' : ''}`}>{value}</td>
    </tr>
  );
}
