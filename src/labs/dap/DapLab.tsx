import { useState } from 'react';
import { Callout, LabSection, ReviewQuestions, Standards, Tabs } from '../../components/ui';
import { DAP_OBJECTIVES, DAP_QUESTIONS } from './content';
import { ProvisionPanel, TransactionPanel } from './Panels';

type Part = 'chave' | 'ativacao' | 'transacao';

function OrcidIcon() {
  return (
    <svg viewBox="0 0 256 256" width="16" height="16" role="img" aria-label="ORCID iD" className="inline-block align-[-2px]">
      <circle cx="128" cy="128" r="128" fill="#A6CE39" />
      <path fill="#fff" d="M86.3 186.2H70.9V79.1h15.4v107.1z" />
      <path fill="#fff" d="M108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7 0-21.5-13.7-39.7-43.7-39.7h-23.7v79.4z" />
      <path fill="#fff" d="M88.7 56.8c0 5.5-4.5 10.1-10.1 10.1s-10.1-4.6-10.1-10.1c0-5.6 4.5-10.1 10.1-10.1s10.1 4.6 10.1 10.1z" />
    </svg>
  );
}

function OrcidLink({ id }: { id: string }) {
  return (
    <a href={`https://orcid.org/${id}`} target="_blank" rel="noreferrer" title={`ORCID ${id}`} aria-label={`ORCID ${id}`} className="ml-1 whitespace-nowrap underline">
      <OrcidIcon />
    </a>
  );
}

export default function DapLab() {
  const [part, setPart] = useState<Part>('chave');
  return (
    <div className="space-y-10">
      <LabSection id="dap-what" title="1. O que é o DAP, para que serve e como funciona">
        <p className="text-lg">
          O <strong>DAP</strong> (<em>Dynamic Authorization Protocol</em>) é um protocolo de autorização de transações fora de banda, proposto na <strong>tese de doutorado do Prof. Dr. Laerte Peotta de Melo</strong> <OrcidLink id="0000-0002-2075-6601" /> (Universidade de Brasília, 2012) e desenvolvido posteriormente em artigo científico e em um <em>Internet-Draft</em> do IETF. Destina-se a servir de <strong>segundo fator de autenticação e autorização em transações financeiras realizadas em computadores não confiáveis</strong>, como as do Internet banking: transferências, pagamento de boletos, alterações cadastrais ou qualquer transação que se queira proteger.
        </p>
        <p className="text-lg">
          <strong>Pesquisadores colaboradores.</strong> Participaram da pesquisa que originou o protocolo, como colaboradores, <strong>Dino Macedo Amaral</strong><OrcidLink id="0000-0002-8023-1057" />, <strong>João José Costa Gondim</strong><OrcidLink id="0000-0002-5873-7502" />, <strong>Robson de Oliveira Albuquerque</strong><OrcidLink id="0000-0002-6717-3374" /> e <strong>Fábio Lúcio Lopes de Mendonça</strong><OrcidLink id="0000-0001-7100-7304" />.
        </p>
        <p className="text-lg">
          O problema tratado é o da <strong>captura e do uso de credenciais</strong> (<em>login</em>, senha e impressão digital do aparelho), por <em>phishing</em> ou por programa malicioso, e o dos programas maliciosos no navegador (<em>Man-in-the-Browser</em>), que substituem a conta ou o valor depois do <em>login</em> e exibem ao usuário uma tela falsa. Senhas, códigos enviados por mensagem (SMS) e senhas de uso único (HOTP e TOTP) não dependem do conteúdo da transação e, por isso, permanecem válidos para a transação adulterada. O código do <strong>DAP</strong> não é um HOTP nem um TOTP: não deriva de contador nem de relógio, e sim de um valor aleatório sorteado pelo e-Bank para cada transação e protegido junto com os dados dela. Cada código de seis dígitos vale somente para aquela transação e não pode ser aproveitado para outra, nem mesmo para outra de mesmo destinatário e valor. Ele só é revelado no celular do usuário depois que este confere, em uma tela independente do computador, o destinatário e o valor. Dessa forma, <strong>o usuário autoriza o que vê</strong> (<em>What You See Is What You Sign</em>), e <strong>um atacante não é capaz de alterar a mensagem que está sendo autorizada</strong>: os dados da transação são protegidos por uma etiqueta HMAC, e qualquer alteração faz o celular rejeitar o desafio antes de exibir a transação ou de revelar o código.
        </p>
        <p className="text-lg">
          O DAP <strong>autentica e autoriza</strong> transações. Autentica o desafio, pois somente quem possui a chave produz uma etiqueta HMAC válida, e autoriza cada operação por meio de um código associado a ela. Consequentemente, ainda que as credenciais do usuário (<em>login</em>, senha e impressão digital do aparelho) sejam capturadas por <em>phishing</em> ou por programa malicioso, o atacante <strong>não consegue autorizar uma transação</strong>: sem a chave <em>k</em>, que permanece no celular, ele não forja um desafio aceito pelo aparelho nem decifra o código. Essa garantia vale no modelo de adversário do <em>draft</em>, que supõe o celular fora do controle do atacante.
        </p>
        <p className="text-lg">
          O protocolo também <strong>aumenta a resistência a ataques de engenharia social</strong>, porque o usuário <strong>não tem acesso à chave</strong>. Armazenada de forma segura no celular de confiança e <strong>não exportável</strong>, ela não pode ser copiada, visualizada nem incluída em cópias de segurança, e o próprio usuário nunca a conhece. Assim, diferentemente de uma senha, que pode ser revelada por engano, a chave não pode ser entregue ao atacante. Resta ao adversário tentar convencer o usuário a confirmar uma transação fraudulenta ou a informar o código exibido no celular, risco que a conferência na tela do aparelho reduz, mas não elimina.
        </p>
        <p className="text-lg">
          <strong>Como funciona.</strong> Uma sessão autenticada por senha não comprova que o usuário desejou aquela transação. O <strong>DAP</strong> autoriza cada transação por um canal fora de banda: o e-Bank gera um desafio protegido e o apresenta como <strong>QR Code</strong> no computador não confiável (UC). O celular de confiança (MD), que dispensa conexão de rede, lê o QR com a câmera, verifica a etiqueta HMAC, exibe a transação em tela própria e, somente após a confirmação do usuário, revela um código de seis dígitos. O usuário digita esse código no UC, e o e-Bank o confere.
        </p>
        <p className="text-lg">
          A proteção apoia-se em primitivas criptográficas robustas: AES-256 no modo CBC, HMAC-SHA-256, HMAC-SHA-512 para derivar uma das metades da chave no módulo de segurança de hardware (HSM) do e-Bank e a divisão da chave em duas metades pela operação ⊕ (OU exclusivo).
        </p>
      </LabSection>

      <LabSection id="dap-obj" title="2. Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {DAP_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </LabSection>

      <LabSection id="dap-intro" title="3. Introdução conceitual">
        <Callout variant="info" title="Sobre o laboratório">
          <p>
            O laboratório segue o <em>draft-melo-dap-visual-oob-auth-00</em> (trabalho em andamento, Independent Submission, sem número de RFC). Alice é a usuária com o MD, Bob é o e-Bank com o HSM e Eva é o
            computador não confiável, que controla o canal da Internet. O ATM é um canal dedicado do banco, que Eva não controla. As operações criptográficas são reais (Web Crypto). Não há o arquivo de modelos
            assinado em CMS nem a leitura de QR por câmera: os modelos são fixos e o QR é desenhado na tela.
          </p>
        </Callout>
        <Standards
          items={[
            'draft-melo-dap-visual-oob-auth-00 (trabalho em andamento)',
            'RFC 2104 (HMAC) e RFC 6234 (SHA-2)',
            'RFC 4648 (Base64)',
            'FIPS 197 (AES) e SP 800-38A (modo CBC)',
            'ISO/IEC 18004 (QR code)',
          ]}
        />
        <Tabs
          label="Parte do laboratório"
          value={part}
          onChange={setPart}
          tabs={[
            { id: 'chave', label: 'A: provisionamento da chave' },
            { id: 'ativacao', label: 'B: ativação do dispositivo' },
            { id: 'transacao', label: 'C: autorização de transação' },
          ]}
        />
      </LabSection>

      {part === 'transacao' ? <TransactionPanel key="transacao" /> : <ProvisionPanel key={part} phase={part} />}

      <LabSection id="dap-quiz" title="Perguntas de revisão">
        <ReviewQuestions items={DAP_QUESTIONS} />
      </LabSection>
    </div>
  );
}
