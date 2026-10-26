import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Standards, Tabs } from '../../components/ui';
import { DES_OBJECTIVES, DES_QUESTIONS } from './content';
import { PartA } from './PartA';
import { PartB } from './PartB';
import { PartC } from './PartC';

type Part = 'a' | 'b' | 'c';

export default function DesLab() {
  const [part, setPart] = useState<Part>('a');
  return (
    <div className="space-y-10">
      <LabSection id="des-obj" title="1. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {DES_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="des-intro" title="2. Introdução conceitual">
        <p className="text-lg">
          O <strong>DES</strong> (<em>Data Encryption Standard</em>) foi, de 1977 a 2005, o padrão federal norte-americano de cifragem simétrica (FIPS 46). Cifra blocos de 64 bits com uma chave de 56 bits úteis,
          em 16 rodadas de uma <strong>rede de Feistel</strong>. Deriva do Lucifer, da IBM, e foi o primeiro algoritmo criptográfico moderno aberto ao escrutínio público: boa parte da criptoanálise de cifras de
          bloco nasceu do estudo dele.
        </p>
        <p className="text-lg">
          Hoje o DES é historicamente importante e inseguro: a chave de 56 bits é pequena demais diante da busca exaustiva. O <strong>Triple DES</strong> prolongou sua vida, mas o bloco de 64 bits tem outro limite,
          e o AES o substituiu. Estudá-lo ainda vale, porque quase tudo o que se diz sobre cifras de bloco (confusão, difusão, Feistel, modos de operação) aparece nele de forma enxuta.
        </p>
        <Callout variant="info" title="Sobre o laboratório">
          <p>
            A Parte A executa o DES operação por operação (subchaves, rodadas e função f), conferido com o exemplo clássico e com o OpenSSL. A Parte B reúne Alice, Bob e Eva: o DES em CBC, a busca exaustiva (em
            escala reduzida) e o Triple DES. A Parte C mostra o avalanche, a propriedade do complemento e as chaves fracas. Implementação didática e lenta: não use para proteger dados reais.
          </p>
        </Callout>
        <Standards
          items={[
            'FIPS 46-3 (Data Encryption Standard), retirada pelo NIST em 19 de maio de 2005',
            'SP 800-67 Rev. 2 (Triple DES), retirada pelo NIST em 1º de janeiro de 2024',
            'FIPS 197 (AES), o padrão vigente de cifra de bloco',
          ]}
        />
        <Tabs
          label="Parte do laboratório"
          value={part}
          onChange={setPart}
          tabs={[
            { id: 'a', label: 'Parte A: subchaves, rodadas e função f' },
            { id: 'b', label: 'Parte B: DES, força bruta e Triple DES' },
            { id: 'c', label: 'Parte C: avalanche, complemento e chaves fracas' },
          ]}
        />
      </LabSection>

      {part === 'a' && <PartA key="a" />}
      {part === 'b' && <PartB key="b" />}
      {part === 'c' && <PartC key="c" />}

      <LabSection id="des-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={DES_QUESTIONS} />
      </LabSection>
    </div>
  );
}
