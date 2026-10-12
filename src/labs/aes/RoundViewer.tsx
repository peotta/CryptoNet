import { Fragment, useEffect, useMemo, useState } from 'react';
import { PlayerControls } from '../../animations/PlayerControls';
import { TimelineList } from '../../animations/TimelineList';
import type { RoundOp, RoundStep } from '../../crypto/aes';
import { engines } from '../../crypto/engines';
import { toHex } from '../../crypto/encoding';
import { randomBytes } from '../../crypto/random';
import { useStepPlayer } from '../../hooks/useStepPlayer';
import type { ProtocolStep } from '../../simulation/types';
import { Callout, Field, LabSection, Tabs, buttonClass } from '../../components/ui';

const FIPS_KEY = '000102030405060708090a0b0c0d0e0f';
const FIPS_BLOCK = '00112233445566778899aabbccddeeff';
const HEX32 = /^[0-9a-fA-F]{32}$/;
const fromHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
const h2 = (n: number) => n.toString(16).padStart(2, '0');

const EXPLAIN: Record<RoundOp, string> = {
  Entrada: 'O bloco de 16 bytes é organizado em uma matriz 4 × 4, preenchida coluna por coluna. Esse é o estado inicial do AES.',
  AddRoundKey: 'XOR byte a byte entre o estado e a chave de rodada, obtida da chave principal pela expansão de chave. É a única etapa que usa a chave.',
  SubBytes: 'Cada byte é substituído pelo valor correspondente na S-box, uma tabela não linear derivada do inverso multiplicativo em GF(2^8). Provê confusão (Shannon).',
  ShiftRows: 'A linha r da matriz é deslocada r posições para a esquerda (a linha 0 não se move). Espalha os bytes entre as colunas e provê difusão.',
  MixColumns: 'Cada coluna é multiplicada por uma matriz fixa em GF(2^8), de modo que cada byte de saída depende dos quatro bytes da coluna. Provê difusão. Não existe na última rodada.',
};

function Matrix({ data, previous, label }: { data: Uint8Array; previous?: Uint8Array; label: string }) {
  return (
    <table aria-label={label} className="border-separate border-spacing-1 font-mono text-xl">
      <tbody>
        {[0, 1, 2, 3].map((r) => (
          <tr key={r}>
            {[0, 1, 2, 3].map((c) => {
              const v = data[r + 4 * c];
              const changed = previous !== undefined && previous[r + 4 * c] !== v;
              return (
                <td key={c} className={`min-w-12 rounded-md border px-2 py-1 text-center ${changed ? 'border-accent bg-accent/15 font-bold' : 'border-line'}`}>
                  {h2(v)}
                  {changed && <span className="sr-only"> (alterado)</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const opTitle = (s: RoundStep) =>
  s.op === 'Entrada' ? 'Estado inicial (bloco de entrada)' : s.round === 0 ? 'Rodada 0: AddRoundKey (chave inicial)' : `Rodada ${s.round}: ${s.op}`;

interface Group {
  title: string;
  /** Operações da rodada, em ordem. */
  ops: RoundStep[];
  /** Estado que entra na rodada. */
  before: Uint8Array;
  /** Índice, em `steps`, da primeira operação da rodada (para detalhar). */
  firstIndex: number;
  round: number;
}

/** Agrupa as operações por rodada: 1 grupo para a rodada 0, 1 por rodada de 1 até Nr. */
function groupRounds(steps: RoundStep[]): Group[] {
  const nr = steps[steps.length - 1].round;
  const groups: Group[] = [{ title: 'Rodada 0: AddRoundKey inicial', ops: [steps[1]], before: steps[0].state, firstIndex: 1, round: 0 }];
  for (let r = 1; r <= nr; r++) {
    const ops = steps.filter((s) => s.round === r);
    const firstIndex = steps.indexOf(ops[0]);
    groups.push({
      title: r === nr ? `Rodada ${r} (final, sem MixColumns)` : `Rodada ${r} de ${nr}`,
      ops,
      before: steps[firstIndex - 1].state,
      firstIndex,
      round: r,
    });
  }
  return groups;
}

type View = 'rodadas' | 'operacoes';

/** Parte A: as rodadas do AES-128 aplicadas a um bloco. Cálculo local, sem comunicação. */
export function RoundViewer() {
  const [keyHex, setKeyHex] = useState(FIPS_KEY);
  const [blockHex, setBlockHex] = useState(FIPS_BLOCK);
  const [trace, setTrace] = useState<{ steps: RoundStep[]; matches: boolean } | null>(null);
  const [speed, setSpeed] = useState(1);
  const [showMath, setShowMath] = useState(true);
  const [view, setView] = useState<View>('rodadas');

  const keyErr = HEX32.test(keyHex) ? null : 'A chave AES-128 tem 32 dígitos hexadecimais (16 bytes).';
  const blockErr = HEX32.test(blockHex) ? null : 'O bloco tem 32 dígitos hexadecimais (16 bytes).';

  useEffect(() => {
    if (keyErr || blockErr) {
      setTrace(null);
      return;
    }
    let cancelled = false;
    engines.aes.traceBlock(fromHex(keyHex), fromHex(blockHex)).then((t) => {
      if (!cancelled) setTrace({ steps: t.steps, matches: t.matchesReference });
    });
    return () => {
      cancelled = true;
    };
  }, [keyHex, blockHex, keyErr, blockErr]);

  const steps = trace?.steps;
  const groups = useMemo(() => (steps ? groupRounds(steps) : []), [steps]);
  const resetKey = trace ? `${keyHex}|${blockHex}` : 'none';

  // Dois reprodutores independentes: a visão por rodada e a visão operação por operação.
  const byRound = useStepPlayer(groups.length, speed, resetKey);
  const byOp = useStepPlayer(steps ? steps.length - 1 : 0, speed, resetKey);
  const player = view === 'rodadas' ? byRound : byOp;
  const total = view === 'rodadas' ? groups.length : steps ? steps.length - 1 : 0;
  const index = Math.min(player.state.index, total);

  const timelineSteps: ProtocolStep[] = useMemo(() => {
    const mk = (id: string, title: string): ProtocolStep => ({ id, title, description: '', operation: '', events: [] });
    if (!steps) return [];
    return view === 'rodadas' ? groups.map((g, i) => mk(`g${i}`, g.title)) : steps.slice(1).map((s, i) => mk(`r${i}`, opTitle(s)));
  }, [steps, groups, view]);

  const group = view === 'rodadas' && index > 0 ? groups[index - 1] : null;
  const chain = group
    ? [
        { label: 'Entrada da rodada', state: group.before, key: undefined as Uint8Array | undefined, op: undefined as RoundOp | undefined },
        ...group.ops.map((o) => ({ label: o.op, state: o.state, key: o.roundKey, op: o.op as RoundOp | undefined })),
      ]
    : [];

  return (
    <>
      <LabSection id="aes-a-params" title="3. Parâmetros configuráveis">
        <p className="text-lg">
          Este experimento é um cálculo local, sem comunicação entre participantes. Os valores iniciais são os do exemplo do apêndice C.1 do padrão FIPS 197.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="aes-key" label="Chave AES-128 (hexadecimal)" value={keyHex} onChange={setKeyHex} error={keyErr} inputMode="text" maxLength={32} />
          <Field id="aes-block" label="Bloco de entrada (hexadecimal)" value={blockHex} onChange={setBlockHex} error={blockErr} inputMode="text" maxLength={32} />
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setKeyHex(toHex(randomBytes(16)));
              setBlockHex(toHex(randomBytes(16)));
            }}
          >
            Sortear chave e bloco (aleatório seguro)
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setKeyHex(FIPS_KEY);
              setBlockHex(FIPS_BLOCK);
            }}
          >
            Restaurar o vetor do FIPS 197
          </button>
        </div>
      </LabSection>

      <LabSection id="aes-a-viz" title="4. Visualização animada: as rodadas do AES-128">
        {trace && steps ? (
          <div className="space-y-5">
            <Tabs
              label="Nível de detalhe"
              value={view}
              onChange={setView}
              tabs={[
                { id: 'rodadas', label: `Visão por rodada (${groups.length} etapas)` },
                { id: 'operacoes', label: `Todas as operações (${steps.length - 1} etapas)` },
              ]}
            />
            <PlayerControls state={{ ...player.state, index }} dispatch={player.dispatch} speed={speed} onSpeed={setSpeed} showMath={showMath} onShowMath={setShowMath} />

            {view === 'rodadas' ? (
              <>
                <div className="rounded-xl border border-line bg-surface p-4" aria-live="polite">
                  <h3 className="text-xl font-bold">{group ? `Etapa ${index}: ${group.title}` : 'Estado inicial'}</h3>
                  {!group && (
                    <p className="mt-1 text-lg">
                      Pressione <strong>Iniciar</strong> e avance com <strong>Próxima etapa</strong>. Cada etapa mostra uma rodada inteira, com o estado depois de cada operação; os bytes alterados
                      aparecem destacados. Para ver as operações uma a uma, use o botão de detalhamento ou a aba &quot;Todas as operações&quot;.
                    </p>
                  )}
                  {group && showMath && (
                    <p className="mt-1 text-lg">
                      {group.round === 0
                        ? EXPLAIN.AddRoundKey
                        : `Cada rodada aplica, em ordem, SubBytes (confusão), ShiftRows${group.ops.some((o) => o.op === 'MixColumns') ? ' e MixColumns (difusão)' : ' (difusão; a rodada final não tem MixColumns)'} e AddRoundKey (mistura com a chave).`}
                    </p>
                  )}
                </div>

                {group ? (
                  <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
                    <ol className="flex flex-wrap items-start gap-x-3 gap-y-6" aria-label={`Operações da ${group.title}`}>
                      {chain.map((item, i) => (
                        <Fragment key={`${item.label}-${i}`}>
                          {i > 0 && (
                            <li aria-hidden="true" className="self-center pt-6 text-2xl text-muted">
                              →
                            </li>
                          )}
                          <li>
                            <p className="mb-1 text-base font-semibold">{item.label}</p>
                            <Matrix data={item.state} previous={i > 0 ? chain[i - 1].state : undefined} label={`Estado: ${item.label}`} />
                            {item.key && (
                              <div className="mt-2">
                                <p className="mb-1 text-base text-muted">Chave de rodada {group.round}</p>
                                <Matrix data={item.key} label={`Chave de rodada ${group.round}`} />
                              </div>
                            )}
                            {showMath && item.op && <p className="mt-1 max-w-[16rem] text-base text-muted">{EXPLAIN[item.op]}</p>}
                          </li>
                        </Fragment>
                      ))}
                    </ol>
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => {
                        setView('operacoes');
                        byOp.dispatch({ type: 'goto', index: group.firstIndex });
                      }}
                    >
                      Ver as operações desta rodada uma a uma
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-line bg-surface p-4">
                    <p className="mb-1 text-base font-semibold">Estado (matriz 4 × 4)</p>
                    <Matrix data={steps[0].state} label="Estado: bloco de entrada" />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rounded-xl border border-line bg-surface p-4" aria-live="polite">
                  <h3 className="text-xl font-bold">{index === 0 ? 'Estado inicial' : `Operação ${index}: ${opTitle(steps[index])}`}</h3>
                  {index === 0 && (
                    <p className="mt-1 text-lg">
                      Pressione <strong>Iniciar</strong> e avance com <strong>Próxima etapa</strong>. Cada operação do AES é uma etapa.
                    </p>
                  )}
                  {index > 0 && showMath && <p className="mt-1 text-lg">{EXPLAIN[steps[index].op]}</p>}
                  {index > 0 && steps[index].op === 'SubBytes' && showMath && (
                    <p className="mt-2 font-mono text-base">
                      Exemplo: S({h2(steps[index - 1].state[0])}) = {h2(steps[index].state[0])}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-start gap-8 rounded-xl border border-line bg-surface p-4">
                  <div>
                    <p className="mb-1 text-base font-semibold">Estado (matriz 4 × 4)</p>
                    <Matrix data={steps[index].state} previous={index > 0 ? steps[index - 1].state : undefined} label="Estado do AES" />
                  </div>
                  {steps[index].roundKey && (
                    <div>
                      <p className="mb-1 text-base font-semibold">Chave de rodada {steps[index].round}</p>
                      <Matrix data={steps[index].roundKey!} label="Chave de rodada" />
                    </div>
                  )}
                  <p className="max-w-xs text-base text-muted">Índice do byte: linha + 4 × coluna. Bytes com fundo destacado mudaram em relação à etapa anterior.</p>
                </div>
                <button type="button" className={buttonClass} onClick={() => setView('rodadas')}>
                  Voltar à visão por rodada
                </button>
              </>
            )}

            <section aria-labelledby="aes-a-tl">
              <h3 id="aes-a-tl" className="mb-3 text-xl font-bold">
                {view === 'rodadas' ? `Linha do tempo das ${groups.length} etapas` : `Linha do tempo das ${steps.length - 1} operações`}
              </h3>
              <div className="max-h-96 overflow-y-auto pr-2">
                <TimelineList steps={timelineSteps} index={index} onSelect={(i) => player.dispatch({ type: 'goto', index: i })} />
              </div>
            </section>
          </div>
        ) : (
          <p className="text-lg text-muted">Corrija a chave e o bloco para iniciar a animação.</p>
        )}
      </LabSection>

      {trace && steps && (
        <LabSection id="aes-a-results" title="5. Painel de resultados">
          <dl className="space-y-3 text-base">
            <div>
              <dt className="font-semibold">Bloco cifrado (AES-128)</dt>
              <dd className="break-all rounded-lg bg-surface2 p-3 font-mono text-lg">{toHex(steps[steps.length - 1].state)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Conferência com a Web Crypto</dt>
              <dd className={`text-lg font-semibold ${trace.matches ? 'text-k-secret' : 'text-danger'}`}>
                {trace.matches ? 'Idêntico ao AES nativo do navegador' : 'DIVERGENTE'}
              </dd>
            </div>
          </dl>
          <Callout variant="info" title="Estrutura do AES">
            <p>
              O AES-128 executa uma AddRoundKey inicial, 9 rodadas completas (SubBytes, ShiftRows, MixColumns e AddRoundKey) e uma rodada final sem MixColumns: 10 rodadas. Com chaves de
              192 e 256 bits, são 12 e 14 rodadas. O bloco tem sempre 128 bits.
            </p>
          </Callout>
        </LabSection>
      )}
    </>
  );
}
