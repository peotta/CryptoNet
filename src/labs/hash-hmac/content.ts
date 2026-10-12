import type { ReviewQuestion } from '../../components/ui';

export const HASH_OBJECTIVES = [
  'Descrever as propriedades de uma função hash criptográfica: determinismo, saída de tamanho fixo, resistência à pré-imagem, à segunda pré-imagem e a colisões.',
  'Observar o efeito avalanche: a alteração de um único bit da entrada modifica, em média, metade dos bits do resumo.',
  'Calcular o HMAC passo a passo (RFC 2104) e explicar o papel das duas passagens, do ipad e do opad.',
  'Distinguir hash (sem chave) de código de autenticação de mensagem (com chave) e justificar por que um hash simples não autentica.',
  'Reconhecer que o HMAC garante integridade e autenticidade, mas não confidencialidade.',
];

export const HASH_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Eve intercepta (m, H(m)), troca m por m\' e recalcula H(m\'). Bob detecta a alteração? E se fosse (m, HMAC(K, m))?',
    answer:
      'Com hash simples, não: qualquer pessoa calcula H(m\') e o par alterado parece válido. O hash só detecta alterações acidentais. Com HMAC, Eve não conhece K e, por isso, não consegue gerar a etiqueta correta de m\'. Bob recalcula o HMAC, encontra valor diferente e rejeita a mensagem.',
  },
  {
    question: 'Por que não se usa simplesmente H(K ‖ m) como código de autenticação?',
    answer:
      'Funções da família Merkle-Damgård (SHA-1, SHA-256, SHA-512) são vulneráveis ao ataque de extensão de comprimento: dado H(K ‖ m) e o tamanho de K ‖ m, um atacante calcula H(K ‖ m ‖ preenchimento ‖ x) sem conhecer K. A construção HMAC, com duas passagens, elimina o problema.',
  },
  {
    question: 'O que o efeito avalanche garante, e por que ele é desejável?',
    answer:
      'Uma pequena alteração na entrada altera, em média, metade dos bits do resumo, de forma imprevisível. Isso impede deduzir a entrada ou encontrar entradas parecidas a partir da saída e é uma consequência esperada de um bom projeto da função.',
  },
  {
    question: 'Quantas mensagens diferentes um SHA-256 distingue? Colisões existem?',
    answer:
      'A saída tem 2^256 valores possíveis, mas as entradas são infinitas, logo colisões existem pelo princípio da casa dos pombos. O que a segurança exige é que encontrá-las seja computacionalmente inviável (cerca de 2^128 operações, pelo paradoxo do aniversário). O SHA-1 já tem colisões práticas demonstradas (2017) e não deve ser usado em novas aplicações.',
  },
  {
    question: 'O HMAC cifra a mensagem? Como combinar sigilo e autenticidade?',
    answer:
      'Não: a mensagem trafega em claro e apenas a etiqueta é acrescentada. Para sigilo e autenticidade juntos usa-se um modo de criptografia autenticada, como o AES-GCM, ou cifra-se e aplica-se o HMAC sobre o texto cifrado (encrypt-then-MAC).',
  },
  {
    question: 'Por que a comparação de etiquetas deve ser feita em tempo constante?',
    answer:
      'Uma comparação que termina no primeiro byte diferente revela, pelo tempo gasto, quantos bytes iniciais estão corretos. Um atacante pode explorar isso para descobrir uma etiqueta válida byte a byte (ataque de temporização). A comparação em tempo constante examina sempre todos os bytes.',
  },
];
