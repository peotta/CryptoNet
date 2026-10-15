import type { ReviewQuestion } from '../../components/ui';

export const TLS_OBJECTIVES = [
  'Descrever as mensagens do handshake 1-RTT do TLS 1.3 (ClientHello, ServerHello, voo cifrado do servidor, Finished) e o que cada uma entrega.',
  'Acompanhar o ECDHE: por que as duas pontas chegam ao mesmo segredo e por que Eva, que vê as chaves públicas, não o obtém.',
  'Seguir o cronograma de chaves do TLS 1.3 (HKDF): Early Secret, Handshake Secret, Master Secret e os segredos de tráfego, conferidos com a RFC 8448.',
  'Distinguir o papel de cada verificação: certificado (quem é o dono da chave), CertificateVerify (posse da chave privada) e Finished (integridade da transcrição).',
  'Mostrar que a troca de chaves sozinha não autentica: o ataque do homem do meio e o que o impede.',
  'Explicar o sigilo adiante (chaves efêmeras) e a proteção dos registros por AES-128-GCM com nonce derivado do número de sequência.',
];

export const TLS_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Por que o handshake do TLS 1.3 precisa de apenas uma ida e volta (1-RTT)?',
    answer:
      'Porque o cliente já envia a sua chave pública efêmera (key_share) no ClientHello, apostando em um grupo que o servidor aceite. O servidor responde com a sua no ServerHello e já envia o certificado e o Finished cifrados no mesmo voo. No TLS 1.2 eram duas idas e voltas, pois a troca de chaves só começava depois da negociação dos parâmetros.',
  },
  {
    question: 'Eva vê as chaves públicas A e B do ECDHE. Por que não consegue calcular o segredo?',
    answer:
      'O segredo é x(a · B) = x(b · A). Obtê-lo a partir de A = a · G e B = b · G é o problema Diffie-Hellman em curvas elípticas, e a única via conhecida é resolver o logaritmo discreto (descobrir a ou b), inviável na curva P-256 com a computação clássica. Computadores quânticos de grande escala quebrariam esse problema, motivo da migração para trocas de chaves pós-quânticas.',
  },
  {
    question: 'Qual a diferença entre o certificado, o CertificateVerify e o Finished?',
    answer:
      'O certificado liga um nome (por exemplo banco.exemplo) a uma chave pública, com assinatura de uma autoridade certificadora; é público e qualquer um pode repeti-lo. O CertificateVerify é uma assinatura da transcrição do handshake com a chave privada correspondente: prova posse da chave e amarra a identidade a esta sessão. O Finished é um HMAC da transcrição com uma chave derivada do segredo do handshake: prova que quem o enviou conhece as chaves e que nenhuma mensagem foi alterada, mas não prova identidade.',
  },
  {
    question: 'No ataque do homem do meio, por que Eva consegue um Finished válido, mas é descoberta?',
    answer:
      'Eva fez um ECDHE próprio com Alice, então conhece as chaves do handshake e calcula um Finished correto. Ela pode repetir o certificado verdadeiro de Bob, que é público. Mas o CertificateVerify exige uma assinatura com a chave privada de Bob, que ela não tem; uma assinatura feita com outra chave falha na verificação contra a chave do certificado. Alice interrompe o handshake. A defesa é a autenticação do servidor, e não a troca de chaves.',
  },
  {
    question: 'O que é sigilo adiante (forward secrecy) e como o TLS 1.3 o garante?',
    answer:
      'É a propriedade de que o vazamento futuro das chaves de longo prazo não permite decifrar tráfego passado. No TLS 1.3 o segredo de sessão vem de chaves ECDHE efêmeras, descartadas ao fim do handshake, e a chave de identidade do servidor só assina: ela não protege a chave de sessão. Quem gravar o tráfego e roubar a chave do servidor depois não consegue decifrá-lo. Na troca RSA do TLS 1.2 isso não valia, e por isso ela foi removida.',
  },
  {
    question: 'Como o TLS 1.3 evita reutilizar o mesmo nonce no AES-GCM em cada registro?',
    answer:
      'O nonce de cada registro é o IV de tráfego (12 bytes, derivado por HKDF) combinado por XOR com o número de sequência de 64 bits, que cresce a cada registro e recomeça a cada nova chave. Assim cada registro tem um nonce distinto sem enviá-lo no canal. Reutilizar um nonce no GCM destruiria o sigilo e a autenticidade, como mostram os laboratórios de ChaCha20 e de AES.',
  },
];
