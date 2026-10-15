import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Tabs } from '../../components/ui';
import type { ClassicalCipher } from '../../crypto/classical';
import { CLASSICAL_OBJECTIVES, CLASSICAL_QUESTIONS } from './content';
import { ClassicalPanel } from './ClassicalPanel';

export default function CesarAfimLab() {
  const [cipher, setCipher] = useState<ClassicalCipher>('cesar');
  return (
    <div className="space-y-10">
      <LabSection id="cl-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {CLASSICAL_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="cl-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          Antes dos computadores, a criptografia era feita com <strong>substituição</strong> (trocar letras por outras) e <strong>transposição</strong> (reordenar letras). A cifra de César,
          atribuída a Júlio César, desloca cada letra do alfabeto k posições. A cifra afim generaliza a ideia: <span className="font-mono">C = (a·P + b) mod 26</span>.
        </p>
        <p className="text-lg">
          Estudar cifras que se quebram com facilidade é útil: elas introduzem a aritmética modular usada no RSA, o conceito de espaço de chaves e a <strong>criptoanálise</strong>, aqui
          conduzida por Eva, que só dispõe do texto cifrado.
        </p>
        <Callout variant="info" title="Nesta aba, Eva é criptoanalista">
          <p>
            Em todos os laboratórios, Alice e Bob são os participantes legítimos. Nas cifras clássicas, Eva consegue algo que não consegue contra o AES ou o RSA: <strong>deduzir a chave</strong> e
            ler a mensagem.
          </p>
        </Callout>
        <Tabs
          label="Cifra"
          value={cipher}
          onChange={setCipher}
          tabs={[
            { id: 'cesar', label: 'Cifra de César' },
            { id: 'afim', label: 'Cifra afim' },
          ]}
        />
      </LabSection>

      <ClassicalPanel key={cipher} cipher={cipher} />

      <LabSection id="cl-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={CLASSICAL_QUESTIONS} />
      </LabSection>
    </div>
  );
}
