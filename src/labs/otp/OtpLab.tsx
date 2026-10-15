import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Tabs } from '../../components/ui';
import { OTP_OBJECTIVES, OTP_QUESTIONS } from './content';
import { CorrectPanel } from './CorrectPanel';
import { ReusePanel } from './ReusePanel';

export default function OtpLab() {
  const [part, setPart] = useState<'correto' | 'reuso'>('correto');
  return (
    <div className="space-y-10">
      <LabSection id="otp-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {OTP_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="otp-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          O <em>one-time pad</em> (Vernam, 1917) soma a cada letra da mensagem uma letra de chave sorteada, tão longa quanto a mensagem, e usada uma única vez. Em 1949, Claude Shannon provou que ele
          tem <strong>sigilo perfeito</strong>: a cifra não revela nada sobre o conteúdo, mesmo para um atacante com poder computacional ilimitado. Com bits, a soma é o XOR.
        </p>
        <p className="text-lg">
          A prova depende de condições rígidas. Este laboratório mostra o uso correto (Eva nada aprende) e o que ocorre quando uma delas é violada: a reutilização da chave.
        </p>
        <Callout variant="info" title="Ponte para a criptografia moderna">
          <p>
            Cifras de fluxo como o AES-CTR e o ChaCha20 imitam o one-time pad com um fluxo de chaves <em>pseudoaleatório</em>, gerado de uma chave curta e de um nonce. É por isso que repetir o
            nonce com a mesma chave é desastroso: é exatamente o two-time pad.
          </p>
        </Callout>
        <Tabs
          label="Cenário"
          value={part}
          onChange={setPart}
          tabs={[
            { id: 'correto', label: 'Uso correto: chave única' },
            { id: 'reuso', label: 'Erro: reutilização da chave' },
          ]}
        />
      </LabSection>

      {part === 'correto' ? <CorrectPanel key="correto" /> : <ReusePanel key="reuso" />}

      <LabSection id="otp-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={OTP_QUESTIONS} />
      </LabSection>
    </div>
  );
}
