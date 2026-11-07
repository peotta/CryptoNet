import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Standards, Tabs } from '../../components/ui';
import { AlgorithmPanel } from './AlgorithmPanel';
import { TOTP_OBJECTIVES, TOTP_QUESTIONS } from './content';
import { ScenarioPanel } from './ScenarioPanel';

export default function TotpLab() {
  const [part, setPart] = useState<'algoritmo' | 'cenarios'>('algoritmo');
  return (
    <div className="space-y-10">
      <LabSection id="ot-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {TOTP_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="ot-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          O <strong>HOTP</strong> (RFC 4226) e o <strong>TOTP</strong> (RFC 6238) são as senhas de uso único dos aplicativos autenticadores. Alice e Bob compartilham um segredo K. A cada
          autenticação, Alice calcula um <strong>HMAC</strong> do contador com K, reduz o resultado a 6 dígitos e envia o código; Bob repete a conta e compara. No HOTP o contador é o número
          de códigos gerados; no TOTP é o número de passos de 30 segundos desde 1970, e por isso o código expira sozinho.
        </p>
        <p className="text-lg">
          O código é um segundo fator: prova a posse do segredo sem revelá-lo. Ele não cifra nada e não identifica o site em que é digitado, o que define o que Eva consegue e o que não consegue
          fazer.
        </p>
        <Callout variant="info" title="Sobre o laboratório">
          <p>
            A Parte A calcula um código operação por operação e confere a implementação contra os vetores das RFCs. A Parte B reúne Alice, Bob e Eva em quatro cenários: código vencido,
            repetição dentro da janela, retransmissão em tempo real (phishing) e tentativa de adivinhar o código. O HMAC é o da Web Crypto API; o segredo é gerado no navegador e nada é
            armazenado.
          </p>
        </Callout>
        <Standards
          items={[
            'RFC 4226 (HOTP: algoritmo de senha de uso único baseado em HMAC)',
            'RFC 6238 (TOTP: algoritmo de senha de uso único baseado em tempo), seção 5.2 sobre a validação',
            'RFC 2104 (HMAC) e RFC 4648 (Base32, usado na entrega do segredo por QR code)',
            'As duas RFCs são informativas e continuam vigentes (não foram substituídas)',
          ]}
        />
        <Tabs
          label="Parte do laboratório"
          value={part}
          onChange={setPart}
          tabs={[
            { id: 'algoritmo', label: 'Parte A: do segredo ao código' },
            { id: 'cenarios', label: 'Parte B: Alice, Bob e Eva' },
          ]}
        />
      </LabSection>

      {part === 'algoritmo' ? <AlgorithmPanel /> : <ScenarioPanel />}

      <LabSection id="ot-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={TOTP_QUESTIONS} />
      </LabSection>
    </div>
  );
}
