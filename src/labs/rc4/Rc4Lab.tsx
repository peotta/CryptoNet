import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Standards, Tabs } from '../../components/ui';
import { RC4_OBJECTIVES, RC4_QUESTIONS } from './content';
import { PartA } from './PartA';
import { PartB } from './PartB';
import { PartC } from './PartC';

type Part = 'a' | 'b' | 'c';

export default function Rc4Lab() {
  const [part, setPart] = useState<Part>('a');
  return (
    <div className="space-y-10">
      <LabSection id="rc4-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {RC4_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="rc4-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          O <strong>RC4</strong> (Rivest, 1987) é uma <strong>cifra de fluxo</strong>: gera um fluxo de bytes pseudoaleatórios a partir da chave e o combina com a mensagem por XOR. É minúsculo (um estado de 256 bytes,
          sem multiplicações) e foi o algoritmo mais usado do mundo por duas décadas, no WEP, no SSL e no TLS, no Kerberos e em muitos protocolos de aplicação.
        </p>
        <p className="text-lg">
          Hoje está abandonado: o fluxo tem vieses estatísticos, não existe nonce, e o uso no WEP foi quebrado em 2001. Estudá-lo mostra de forma enxuta o que uma cifra de fluxo é, e por que um bom projeto exige nonce,
          fluxo sem vieses e autenticação.
        </p>
        <Callout variant="info" title="Sobre o laboratório">
          <p>
            A Parte A executa a KSA e a PRGA troca por troca, conferidas com vetores conhecidos. A Parte B reúne Alice, Bob e Eva: o uso com chave de sessão e o ataque FMS contra o WEP, que recupera a chave sem
            testar todas as possibilidades. A Parte C mostra o viés do segundo byte. Implementação didática: não use para proteger dados reais.
          </p>
        </Callout>
        <Standards
          items={[
            'RFC 6229 (vetores de teste do RC4, informativa)',
            'RFC 7465 (proíbe as suítes RC4 no TLS)',
            'RFC 8758 (descontinua o RC4 no SSH)',
            'O RC4 não é um algoritmo aprovado pelo NIST (não consta em nenhuma FIPS nem SP)',
          ]}
        />
        <Tabs
          label="Parte do laboratório"
          value={part}
          onChange={setPart}
          tabs={[
            { id: 'a', label: 'Parte A: KSA e PRGA troca por troca' },
            { id: 'b', label: 'Parte B: chave de sessão e WEP' },
            { id: 'c', label: 'Parte C: vieses e situação atual' },
          ]}
        />
      </LabSection>

      {part === 'a' && <PartA key="a" />}
      {part === 'b' && <PartB key="b" />}
      {part === 'c' && <PartC key="c" />}

      <LabSection id="rc4-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={RC4_QUESTIONS} />
      </LabSection>
    </div>
  );
}
