import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Tabs } from '../../components/ui';
import { MLKEM_OBJECTIVES, MLKEM_QUESTIONS } from './content';
import { LwePanel, MlKemPanel, SizesPanel } from './Panels';

type Part = 'lwe' | 'mlkem' | 'tamanhos';

export default function MlKemLab() {
  const [part, setPart] = useState<Part>('lwe');
  return (
    <div className="space-y-10">
      <LabSection id="pq-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {MLKEM_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="pq-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          O RSA, o Diffie-Hellman e as curvas elípticas dependem de dois problemas, a fatoração e o logaritmo discreto, que o <strong>algoritmo de Shor</strong> resolve em tempo polinomial em um
          computador quântico suficientemente grande. Esse computador ainda não existe, mas quem grava hoje o tráfego pode decifrá-lo depois (<em>harvest now, decrypt later</em>). A resposta é a
          <strong> criptografia pós-quântica</strong>: algoritmos que rodam em computadores comuns e que se acredita resistirem a ataques quânticos. O <strong>ML-KEM</strong> (FIPS 203, publicado pelo NIST
          em 2024, antes chamado CRYSTALS-Kyber) é o padrão para estabelecer chaves e se baseia em <strong>reticulados</strong>: sem o segredo, a chave pública é uma sequência de equações lineares
          com ruído, o problema <strong>LWE</strong> (<em>Learning With Errors</em>).
        </p>
        <Callout variant="info" title="Sobre o laboratório">
          <p>
            A Parte A usa o LWE com números minúsculos, para ver as contas e para que Eva consiga quebrar tudo. A Parte B executa o ML-KEM de verdade, passo a passo (as três variantes da FIPS 203; o
            código foi conferido byte a byte contra o OpenSSL 3.5). A Parte C compara tamanhos com os algoritmos atuais. A implementação é didática e não tem proteção contra ataques de canal
            lateral: não a use para proteger dados reais. Pré-requisitos: laboratórios de Diffie-Hellman, ECC e TLS 1.3.
          </p>
        </Callout>
        <Tabs
          label="Parte do laboratório"
          value={part}
          onChange={setPart}
          tabs={[
            { id: 'lwe', label: 'A: LWE em escala didática' },
            { id: 'mlkem', label: 'B: ML-KEM com Alice, Bob e Eva' },
            { id: 'tamanhos', label: 'C: tamanhos, híbrido e migração' },
          ]}
        />
      </LabSection>

      {part === 'lwe' && <LwePanel key="lwe" />}
      {part === 'mlkem' && <MlKemPanel key="mlkem" />}
      {part === 'tamanhos' && <SizesPanel key="tamanhos" />}

      <LabSection id="pq-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={MLKEM_QUESTIONS} />
      </LabSection>
    </div>
  );
}
