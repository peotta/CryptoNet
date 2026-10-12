import type { ReviewQuestion } from '../../components/ui';

export const AES_OBJECTIVES = [
  'Descrever a estrutura do AES: bloco de 128 bits, chaves de 128, 192 e 256 bits, e as operações SubBytes, ShiftRows, MixColumns e AddRoundKey.',
  'Explicar confusão e difusão e identificar qual operação do AES contribui para cada propriedade.',
  'Diferenciar cifra de bloco de modo de operação, e justificar por que o modo importa tanto quanto o algoritmo.',
  'Observar o vazamento de padrões do ECB e a ausência dele em CBC, CTR e GCM.',
  'Mostrar o que um atacante (Eva) consegue fazer ao alterar bits da cifra em cada modo, sem conhecer a chave.',
  'Reconhecer o AES-GCM como criptografia autenticada (AEAD) e o papel do nonce.',
];

export const AES_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Por que o AES, sozinho, não define como cifrar uma mensagem maior que 16 bytes?',
    answer:
      'O AES é uma cifra de bloco: transforma um bloco de 128 bits em outro, sob uma chave. Para mensagens maiores é preciso um modo de operação (ECB, CBC, CTR, GCM...) que defina como os blocos são encadeados, e essa escolha determina propriedades como vazamento de padrões e proteção de integridade.',
  },
  {
    question: 'Por que o ECB é considerado inseguro mesmo com o AES-256?',
    answer:
      'Porque cifra cada bloco de forma independente e determinística: blocos iguais geram cifras iguais. Quem observa a cifra vê a estrutura do texto claro (como o contorno de uma imagem), sem precisar da chave. A fraqueza está no modo, não no AES.',
  },
  {
    question: 'Eva inverte um bit do bloco 2 da cifra em CBC. O que acontece com os blocos 2 e 3 de texto claro?',
    answer:
      'O bloco 2 é decifrado como um valor aleatório (corrompido), e o mesmo bit é invertido no bloco 3, porque o texto claro do bloco 3 é o XOR da saída do AES com o bloco cifrado 2. Eva controla a alteração do bloco 3, e Bob não percebe, pois o CBC não autentica.',
  },
  {
    question: 'Por que reutilizar o nonce no CTR ou no GCM com a mesma chave é uma falha grave?',
    answer:
      'O fluxo de chaves seria idêntico nas duas mensagens: o XOR das duas cifras é igual ao XOR dos dois textos claros, o que permite análises e, com texto conhecido, a recuperação de uma das mensagens. No GCM, a repetição do nonce também compromete a chave de autenticação (GHASH).',
  },
  {
    question: 'O que o GCM oferece além da confidencialidade, e como Bob percebe uma adulteração?',
    answer:
      'Integridade e autenticidade (criptografia autenticada com dados associados, AEAD). A cifra vem acompanhada de uma etiqueta de 128 bits calculada com a chave; Bob a recalcula e, se não conferir, a operação falha e nenhuma mensagem é entregue. Eva não consegue produzir uma etiqueta válida sem a chave.',
  },
  {
    question: 'O IV do CBC precisa ser secreto? E precisa ser imprevisível?',
    answer:
      'Não precisa ser secreto (trafega junto com a cifra), mas deve ser imprevisível e aleatório a cada mensagem. IVs previsíveis permitem ataques, como o BEAST contra o TLS 1.0. Já o nonce de CTR e GCM precisa apenas ser único para cada chave.',
  },
];
