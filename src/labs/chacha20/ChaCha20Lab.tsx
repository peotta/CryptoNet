import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Tabs } from '../../components/ui';
import { BlockViewer } from './BlockViewer';
import { CHACHA_OBJECTIVES, CHACHA_QUESTIONS } from './content';
import { StreamPanel } from './StreamPanel';

export default function ChaCha20Lab() {
  const [part, setPart] = useState<'bloco' | 'fluxo'>('bloco');
  return (
    <div className="space-y-10">
      <LabSection id="cc-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {CHACHA_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="cc-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          O <strong>ChaCha20</strong> (Bernstein, 2008; RFC 8439) é uma <strong>cifra de fluxo</strong>: gera um fluxo de bytes pseudoaleatórios a partir de uma chave de 256 bits, de um nonce de 96 bits
          e de um contador, e o combina com a mensagem por XOR. É a ideia do <em>one-time pad</em> com um fluxo de chaves gerado, e não sorteado, de tamanho igual ao da mensagem.
        </p>
        <p className="text-lg">
          A geração usa apenas soma módulo 2³², rotação e XOR (<em>ARX</em>), rápidas em qualquer processador. O ChaCha20 é usado no TLS 1.3 (junto do Poly1305), no WireGuard e no SSH.
        </p>
        <Callout variant="info" title="Sobre o laboratório">
          <p>
            A Parte A mostra, operação por operação, como a chave vira fluxo de chaves, com os vetores de teste da RFC 8439. A Parte B reúne Alice, Bob e Eva: o uso correto, a maleabilidade e o
            erro de reutilizar o nonce. Implementação didática: não use para proteger dados reais.
          </p>
        </Callout>
        <Tabs
          label="Parte do laboratório"
          value={part}
          onChange={setPart}
          tabs={[
            { id: 'bloco', label: 'Parte A: do quarter round ao fluxo de chaves' },
            { id: 'fluxo', label: 'Parte B: cifra de fluxo, Alice, Bob e Eva' },
          ]}
        />
      </LabSection>

      {part === 'bloco' ? <BlockViewer /> : <StreamPanel />}

      <LabSection id="cc-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={CHACHA_QUESTIONS} />
      </LabSection>
    </div>
  );
}
