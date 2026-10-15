import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Tabs } from '../../components/ui';
import { POLY_OBJECTIVES, POLY_QUESTIONS } from './content';
import { HillPanel } from './HillPanel';
import { PlayfairPanel } from './PlayfairPanel';

export default function PlayfairHillLab() {
  const [cipher, setCipher] = useState<'playfair' | 'hill'>('playfair');
  return (
    <div className="space-y-10">
      <LabSection id="ph-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {POLY_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="ph-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          As cifras <strong>poligráficas</strong> cifram grupos de letras de uma vez, e não letra a letra. Isso esconde a frequência das letras individuais e obrigou a criptoanálise a
          usar estatísticas de pares (digrafos) ou propriedades algébricas.
        </p>
        <p className="text-lg">
          O <strong>Playfair</strong> (1854) cifra digrafos com uma grade 5 × 5. A cifra de <strong>Hill</strong> (1929) multiplica blocos por uma matriz módulo 26: foi a primeira cifra a usar álgebra
          linear, e é por essa mesma linearidade que cai.
        </p>
        <Callout variant="info" title="Nesta aba, Eva é criptoanalista">
          <p>
            No Playfair, Eva mostra por que a frequência simples falha e o que ainda a denuncia. No Hill, ela resolve a chave exata com texto claro conhecido.
          </p>
        </Callout>
        <Tabs
          label="Cifra"
          value={cipher}
          onChange={setCipher}
          tabs={[
            { id: 'playfair', label: 'Playfair (digrafos)' },
            { id: 'hill', label: 'Hill (matrizes)' },
          ]}
        />
      </LabSection>

      {cipher === 'playfair' ? <PlayfairPanel key="playfair" /> : <HillPanel key="hill" />}

      <LabSection id="ph-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={POLY_QUESTIONS} />
      </LabSection>
    </div>
  );
}
