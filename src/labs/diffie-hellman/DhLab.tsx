import { useEffect, useMemo, useState } from 'react';
import { ProtocolPlayer } from '../../animations/ProtocolPlayer';
import { Formula } from '../../animations/Formula';
import { CryptoInputError, parseDecimal } from '../../crypto/bigmath';
import { checkDhParameters, checkPrivateExponent, DH_GROUPS, generatePrivateExponent, type DhSession, type MitmSession } from '../../crypto/diffieHellman';
import { engines } from '../../crypto/engines';
import { Callout, Field, LabSection, ReviewQuestions, Tabs, buttonClass } from '../../components/ui';
import { DH_OBJECTIVES, DH_QUESTIONS } from './content';
import { EveObserver } from './EveObserver';
import { buildDhProtocol, buildMitmProtocol } from './flows';
import { KeyDerivationDemo } from './KeyDerivationDemo';

type Scenario = 'basico' | 'mitm';

function parse(text: string, label: string): { value: bigint | null; error: string | null } {
  try {
    return { value: parseDecimal(text, label, 10), error: null };
  } catch (e) {
    return { value: null, error: e instanceof CryptoInputError ? e.message : 'Valor inválido.' };
  }
}

export default function DhLab() {
  const [groupId, setGroupId] = useState('g23');
  const [customP, setCustomP] = useState('1019');
  const [customG, setCustomG] = useState('2');
  const [a, setA] = useState('6');
  const [b, setB] = useState('15');
  const [e, setE] = useState('13');
  const [scenario, setScenario] = useState<Scenario>('basico');
  const [session, setSession] = useState<DhSession | null>(null);
  const [mitm, setMitm] = useState<MitmSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const group = DH_GROUPS.find((g) => g.id === groupId);
  const pText = group ? group.p.toString() : customP;
  const gText = group ? group.g.toString() : customG;
  const P = parse(pText, 'p');
  const G = parse(gText, 'g');
  const Pa = parse(a, 'a');
  const Pb = parse(b, 'b');
  const Pe = parse(e, 'e');

  const paramCheck = useMemo(() => (P.value !== null && G.value !== null ? checkDhParameters(P.value, G.value) : { errors: [], warnings: [] }), [P.value, G.value]);
  const exponentError = (label: string, parsed: ReturnType<typeof parse>) =>
    parsed.error ?? (parsed.value !== null && P.value !== null && paramCheck.errors.length === 0 ? checkPrivateExponent(label, parsed.value, P.value) : null);
  const errA = exponentError('a', Pa);
  const errB = exponentError('b', Pb);
  const errE = exponentError('e', Pe);

  useEffect(() => {
    const ready = P.value !== null && G.value !== null && Pa.value !== null && Pb.value !== null && paramCheck.errors.length === 0 && !errA && !errB;
    if (!ready) {
      setSession(null);
      setMitm(null);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await engines.diffieHellman.runSession(P.value!, G.value!, Pa.value!, Pb.value!);
        const m = Pe.value !== null && !errE ? await engines.diffieHellman.runMitm(P.value!, G.value!, Pa.value!, Pb.value!, Pe.value) : null;
        if (cancelled) return;
        setSession(s);
        setMitm(m);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setSession(null);
        setMitm(null);
        setError(err instanceof CryptoInputError ? err.message : 'Não foi possível calcular com estes valores.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pText, gText, a, b, e]);

  const definition = useMemo(() => {
    if (scenario === 'basico') return session ? buildDhProtocol(session) : null;
    return mitm ? buildMitmProtocol(mitm) : null;
  }, [scenario, session, mitm]);

  const randomize = (which: 'a' | 'b' | 'e' | 'all') => {
    if (P.value === null || paramCheck.errors.length) return;
    if (which === 'a' || which === 'all') setA(generatePrivateExponent(P.value).toString());
    if (which === 'b' || which === 'all') setB(generatePrivateExponent(P.value).toString());
    if (which === 'e' || which === 'all') setE(generatePrivateExponent(P.value).toString());
  };

  return (
    <div className="space-y-10">
      <LabSection id="dh-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {DH_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="dh-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          O protocolo de Diffie-Hellman (1976) permite que duas partes, sem qualquer segredo prévio, estabeleçam um segredo compartilhado trocando apenas valores públicos
          por um canal inseguro. Cada parte mantém um expoente privado; o segredo final é <Formula tex="K = g^{ab} mod p" />.
        </p>
        <Callout variant="info" title="Acordo de chaves não é cifragem de mensagens">
          <p>
            O Diffie-Hellman <strong>não cifra</strong> dados e <strong>não autentica</strong> os participantes. Ele produz um segredo que, depois de passar por uma função de
            derivação (HKDF), alimenta um algoritmo simétrico como o AES-GCM.
          </p>
        </Callout>
        <Callout variant="danger" title="Modo matemático didático">
          <p>Os grupos pequenos servem apenas para visualizar as contas. Eles são quebrados por busca exaustiva em milissegundos e não oferecem segurança real.</p>
        </Callout>
      </LabSection>

      <LabSection id="dh-params" title="3. Parâmetros configuráveis">
        <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
          <div>
            <label htmlFor="dh-group" className="mb-1 block text-base font-semibold">
              Grupo de parâmetros públicos
            </label>
            <select id="dh-group" value={groupId} onChange={(ev) => setGroupId(ev.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg">
              {DH_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value="custom">Personalizado (validado)</option>
            </select>
          </div>
          <p className="self-end text-base text-muted">{group ? group.note : 'Informe p primo (até 10^9) e g entre 2 e p - 2. Raízes primitivas geram todo o grupo.'}</p>
        </div>
        {!group && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="dh-p" label="Primo p" value={customP} onChange={setCustomP} error={P.error ?? paramCheck.errors.find((x) => x.startsWith('p'))} />
            <Field id="dh-g" label="Gerador g" value={customG} onChange={setCustomG} error={G.error ?? paramCheck.errors.find((x) => x.startsWith('g'))} />
          </div>
        )}
        {paramCheck.warnings.map((w) => (
          <Callout key={w} variant="warn">
            <p>{w}</p>
          </Callout>
        ))}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="dh-a" label="Segredo privado de Alice (a)" value={a} onChange={setA} error={errA} hint="2 ≤ a ≤ p - 2" />
          <Field id="dh-b" label="Segredo privado de Bob (b)" value={b} onChange={setB} error={errB} hint="2 ≤ b ≤ p - 2" />
          <Field id="dh-e" label="Segredo privado de Eve (e), usado no MITM" value={e} onChange={setE} error={errE} hint="2 ≤ e ≤ p - 2" />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => randomize('a')}>
            Sortear a
          </button>
          <button type="button" className={buttonClass} onClick={() => randomize('b')}>
            Sortear b
          </button>
          <button type="button" className={buttonClass} onClick={() => randomize('all')}>
            Sortear a, b e e (aleatório seguro)
          </button>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-danger/10 p-3 text-base font-semibold text-danger">
            {error}
          </p>
        )}
        {session && (
          <p className="rounded-lg bg-surface2 p-3 text-lg" aria-live="polite">
            Efeito das escolhas: <Formula tex={`A = ${session.g}^{${session.a}} mod ${session.p} = ${session.A}`} />, <Formula tex={`B = ${session.g}^{${session.b}} mod ${session.p} = ${session.B}`} />,{' '}
            <Formula tex={`K = ${session.kAlice}`} />.
          </p>
        )}
      </LabSection>

      <LabSection id="dh-viz" title="4. Visualização animada">
        <Tabs
          label="Cenário"
          value={scenario}
          onChange={setScenario}
          tabs={[
            { id: 'basico', label: 'Troca de chaves (com Eve observando)' },
            { id: 'mitm', label: 'Ataque do homem do meio (MITM)' },
          ]}
        />
        {scenario === 'mitm' && mitm?.aliceMatchesBob && (
          <Callout variant="warn">
            <p>Com a = b os segredos de Alice e Bob coincidem por acaso. Escolha valores diferentes para ver o ataque.</p>
          </Callout>
        )}
        {definition ? (
          <ProtocolPlayer definition={definition} resetKey={`${scenario}|${pText}|${gText}|${a}|${b}|${e}`} />
        ) : (
          <p className="text-lg text-muted">Corrija os parâmetros acima para iniciar a animação.</p>
        )}
      </LabSection>

      {session && (
        <>
          <LabSection id="dh-eve" title="5. Visão do observador (Eve)">
            <EveObserver session={session} />
          </LabSection>

          <LabSection id="dh-results" title="6. Painel de resultados">
            <ResultTable session={session} mitm={scenario === 'mitm' ? mitm : null} />
          </LabSection>

          <LabSection id="dh-apply" title="7. Aplicação do segredo: HKDF e AES-GCM">
            <KeyDerivationDemo session={session} />
          </LabSection>
        </>
      )}

      <LabSection id="dh-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={DH_QUESTIONS} />
      </LabSection>
    </div>
  );
}

function ResultTable({ session: s, mitm }: { session: DhSession; mitm: MitmSession | null }) {
  const rows: [string, string][] = [
    ['p, g', `${s.p}, ${s.g}`],
    ['a (Alice, privado)', s.a.toString()],
    ['b (Bob, privado)', s.b.toString()],
    ['A = g^a mod p', s.A.toString()],
    ['B = g^b mod p', s.B.toString()],
    ['K_A = B^a mod p', s.kAlice.toString()],
    ['K_B = A^b mod p', s.kBob.toString()],
    ['K_A = K_B?', s.match ? 'Sim: segredo compartilhado estabelecido' : 'Não'],
  ];
  if (mitm) {
    rows.push(
      ['MITM: E = g^e mod p', mitm.E.toString()],
      ['MITM: segredo de Alice (E^a)', mitm.kAlice.toString()],
      ['MITM: segredo de Bob (E^b)', mitm.kBob.toString()],
      ['MITM: Eve conhece o segredo de Alice?', mitm.aliceMatchesEve ? 'Sim' : 'Não'],
      ['MITM: Eve conhece o segredo de Bob?', mitm.bobMatchesEve ? 'Sim' : 'Não'],
      ['MITM: Alice e Bob compartilham segredo?', mitm.aliceMatchesBob ? 'Sim (por acaso, a = b)' : 'Não'],
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-lg">
        <caption className="sr-only">Valores calculados no Diffie-Hellman</caption>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-line">
              <th scope="row" className="py-2 pr-4 font-semibold">
                {label}
              </th>
              <td className="break-all py-2 font-mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
