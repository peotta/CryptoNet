import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Standards, Tabs } from '../../components/ui';
import { RSA_OBJECTIVES, RSA_QUESTIONS } from './content';
import { DidacticPanel } from './DidacticPanel';
import { RealPanel } from './RealPanel';

export default function RsaLab() {
  const [mode, setMode] = useState<'didatico' | 'real'>('didatico');
  return (
    <div className="space-y-10">
      <LabSection id="rsa-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {RSA_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="rsa-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          O RSA (<em>Rivest-Shamir-Adleman</em>, 1977) é um criptossistema de chave pública: cada participante possui um par de chaves relacionadas. A chave pública pode ser
          divulgada; a privada é mantida em segredo. Sua segurança baseia-se na dificuldade de fatorar o produto de dois primos grandes.
        </p>
        <p className="text-lg">
          Use o laboratório em dois modos: o <strong>didático</strong> mostra a aritmética modular com números pequenos; o <strong>real</strong> executa RSA-OAEP e RSA-PSS com
          chaves de 2048 bits ou mais, conforme a RFC 8017 (PKCS #1 v2.2).
        </p>
        <Callout variant="info" title="Duas funções diferentes para o mesmo par de chaves">
          <p>
            <strong>Cifragem:</strong> a chave pública cifra e a privada decifra (confidencialidade). <strong>Assinatura:</strong> a chave privada assina e a pública verifica
            (autenticidade e integridade).
          </p>
        </Callout>
        <Standards items={['RFC 8017 (PKCS #1 v2.2: RSAES-OAEP e RSASSA-PSS)', 'FIPS 186-5 (assinaturas RSA, incluindo o RSASSA-PSS)', 'FIPS 180-4 (SHA-2, usado no OAEP e no PSS)', 'NIST SP 800-56B Rev. 2 (estabelecimento de chaves com RSA)', 'NIST SP 800-57 Parte 1 Rev. 5 (tamanhos de chave)']} />
        <Tabs
          label="Modo de operação"
          value={mode}
          onChange={setMode}
          tabs={[
            { id: 'didatico', label: 'Modo A: RSA matemático (didático)' },
            { id: 'real', label: 'Modo B: RSA criptográfico real' },
          ]}
        />
      </LabSection>

      {mode === 'didatico' ? <DidacticPanel /> : <RealPanel />}

      <LabSection id="rsa-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={RSA_QUESTIONS} />
      </LabSection>
    </div>
  );
}
