import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Tabs } from '../../components/ui';
import { AES_OBJECTIVES, AES_QUESTIONS } from './content';
import { ModesPanel } from './ModesPanel';
import { RoundViewer } from './RoundViewer';

export default function AesLab() {
  const [part, setPart] = useState<'bloco' | 'modos'>('bloco');
  return (
    <div className="space-y-10">
      <LabSection id="aes-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {AES_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="aes-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          O <em>Advanced Encryption Standard</em> (AES, FIPS 197) é a cifra de bloco simétrica mais usada: cifra blocos de 128 bits com chaves de 128, 192 ou 256 bits. Ele é construído como uma rede de substituição e permutação, em
          rodadas, que combinam <strong>confusão</strong> (relação complexa entre chave e cifra) e <strong>difusão</strong> (cada bit de entrada afeta muitos bits de saída).
        </p>
        <p className="text-lg">
          Uma cifra de bloco só sabe cifrar um bloco. Para cifrar mensagens reais, usa-se um <strong>modo de operação</strong> (NIST SP 800-38A e 800-38D). A escolha do modo muda o que um
          atacante consegue ver e fazer.
        </p>
        <Callout variant="info" title="Sobre o laboratório">
          <p>
            A Parte A mostra, operação por operação, como um bloco é transformado. A Parte B reúne Alice, Bob e Eva para comparar ECB, CBC, CTR e GCM diante de um atacante que apenas
            observa ou que altera a cifra.
          </p>
        </Callout>
        <Tabs
          label="Parte do laboratório"
          value={part}
          onChange={setPart}
          tabs={[
            { id: 'bloco', label: 'Parte A: o AES bloco a bloco' },
            { id: 'modos', label: 'Parte B: modos de operação, Alice, Bob e Eva' },
          ]}
        />
      </LabSection>

      {part === 'bloco' ? <RoundViewer /> : <ModesPanel />}

      <LabSection id="aes-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={AES_QUESTIONS} />
      </LabSection>
    </div>
  );
}
