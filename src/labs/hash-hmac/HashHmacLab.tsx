import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Tabs } from '../../components/ui';
import { HASH_OBJECTIVES, HASH_QUESTIONS } from './content';
import { HashPanel } from './HashPanel';
import { HmacPanel } from './HmacPanel';

export default function HashHmacLab() {
  const [part, setPart] = useState<'hash' | 'hmac'>('hash');
  return (
    <div className="space-y-10">
      <LabSection id="hh-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {HASH_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="hh-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          Funções hash (SHA-2, FIPS 180-4) produzem um resumo de tamanho fixo a partir de qualquer entrada e são a base de assinaturas digitais, derivação de chaves e verificação de
          integridade. O HMAC (RFC 2104) combina uma função hash com uma chave secreta para autenticar mensagens. Aqui, os cálculos são <strong>reais</strong> (Web Crypto API); o
          HMAC é reconstruído passo a passo e conferido contra a implementação nativa.
        </p>
        <Callout variant="info" title="Hash e HMAC não cifram">
          <p>Nenhum dos dois oculta o conteúdo da mensagem. Hash dá resumo e detecção de alterações acidentais; HMAC acrescenta autenticidade por chave compartilhada.</p>
        </Callout>
        <Tabs
          label="Parte do laboratório"
          value={part}
          onChange={setPart}
          tabs={[
            { id: 'hash', label: 'Parte A: função hash e efeito avalanche' },
            { id: 'hmac', label: 'Parte B: HMAC (autenticação de mensagem)' },
          ]}
        />
      </LabSection>

      {part === 'hash' ? <HashPanel /> : <HmacPanel />}

      <LabSection id="hh-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={HASH_QUESTIONS} />
      </LabSection>
    </div>
  );
}
