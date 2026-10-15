import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Tabs } from '../../components/ui';
import { CurvePanel } from './CurvePanel';
import { ECC_OBJECTIVES, ECC_QUESTIONS } from './content';
import { EcdhPanel, EcdsaPanel, RealPanel } from './ProtocolPanels';

type Part = 'curva' | 'ecdh' | 'ecdsa' | 'real';

export default function EccLab() {
  const [part, setPart] = useState<Part>('curva');
  return (
    <div className="space-y-10">
      <LabSection id="ec-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {ECC_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="ec-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          Uma <strong>curva elíptica</strong> sobre um corpo finito é o conjunto de pontos (x, y) que satisfazem y² = x³ + ax + b (mod p), mais um ponto no infinito. Esses pontos formam um grupo:
          sabemos somar dois pontos, e somar um ponto G a si mesmo k vezes é rápido. Mas, dado k · G, descobrir k (o <strong>logaritmo discreto</strong>) é inviável numa curva grande. Essa assimetria
          sustenta o <strong>ECDH</strong> (acordo de chaves) e as assinaturas <strong>ECDSA</strong> e <strong>Ed25519</strong>, com chaves de 256 bits no lugar dos 3072 bits do RSA.
        </p>
        <Callout variant="info" title="Sobre o laboratório">
          <p>
            As partes A a C usam uma curva didática minúscula (ordem 19), onde se vê cada conta e onde Eva consegue quebrar tudo por tentativa, para ensinar o mecanismo. A Parte D usa a Web Crypto
            com curvas reais (P-256 e Curve25519). Pré-requisito: laboratórios de Diffie-Hellman e RSA.
          </p>
        </Callout>
        <Tabs
          label="Parte do laboratório"
          value={part}
          onChange={setPart}
          tabs={[
            { id: 'curva', label: 'A: a curva e a aritmética' },
            { id: 'ecdh', label: 'B: ECDH com Alice, Bob e Eva' },
            { id: 'ecdsa', label: 'C: ECDSA e o nonce reutilizado' },
            { id: 'real', label: 'D: ECDSA P-256 e Ed25519 reais' },
          ]}
        />
      </LabSection>

      {part === 'curva' && <CurvePanel />}
      {part === 'ecdh' && <EcdhPanel key="ecdh" />}
      {part === 'ecdsa' && <EcdsaPanel key="ecdsa" />}
      {part === 'real' && <RealPanel key="real" />}

      <LabSection id="ec-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={ECC_QUESTIONS} />
      </LabSection>
    </div>
  );
}
