import type { ReviewQuestion } from '../../components/ui';

export const OTP_OBJECTIVES = [
  'Cifrar e decifrar com o one-time pad por soma e subtração módulo 26, e relacioná-lo ao XOR dos bits.',
  'Enunciar as quatro condições do sigilo perfeito: chave aleatória, tão longa quanto a mensagem, de uso único e secreta.',
  'Demonstrar o sigilo perfeito: para qualquer texto de mesmo tamanho existe uma chave que leva a cifra a ele.',
  'Mostrar por que reutilizar a chave a destrói: a diferença das duas cifras elimina a chave.',
  'Executar o arrasto de texto provável (crib dragging) e entender por que um único trecho acertado vaza a chave.',
  'Reconhecer que o one-time pad não protege a integridade (é maleável) e o custo prático de distribuir chaves tão longas.',
];

export const OTP_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Cifre "HELLO" com a chave "XMCKL" por soma módulo 26. Qual é a cifra?',
    answer: 'H+X = 7+23 = 30 ≡ 4 (E); E+M = 4+12 = 16 (Q); L+C = 11+2 = 13 (N); L+K = 11+10 = 21 (V); O+L = 14+11 = 25 (Z). A cifra é "EQNVZ". Para decifrar, subtrai-se a chave.',
  },
  {
    question: 'O que é o sigilo perfeito e por que o one-time pad o possui?',
    answer:
      'Sigilo perfeito (Shannon, 1949) significa que a cifra não revela informação alguma sobre o texto claro: P(M = m | C = c) = P(M = m). No one-time pad, com chave uniforme, para qualquer texto de mesmo tamanho existe exatamente uma chave que leva a cifra a ele, e todas são igualmente prováveis. Eva só aprende o tamanho da mensagem.',
  },
  {
    question: 'Por que a chave precisa ser tão longa quanto a mensagem?',
    answer:
      'Se a chave for menor e for repetida, o texto cifrado passa a ter periodicidade, e Eva usa Kasiski e frequência por coluna, como na Vigenère. Com uma chave curta, não há mais uma chave para cada texto possível, e o sigilo perfeito se perde. A prova de Shannon exige que o número de chaves seja pelo menos igual ao número de mensagens.',
  },
  {
    question: 'O que acontece quando a mesma chave cifra duas mensagens, e como Eva se aproveita?',
    answer:
      'A diferença das cifras elimina a chave: C2 − C1 = P2 − P1. Eva passa a trabalhar com uma relação entre dois textos em português. Ela desliza um texto provável pelas posições (arrasto de texto provável): onde acerta, o trecho correspondente da outra mensagem aparece legível, e o fragmento de chave (C − P) vaza. Estendendo o trecho, ela lê as duas mensagens. O projeto Venona decifrou parte do tráfego soviético porque pads foram reutilizados.',
  },
  {
    question: 'O one-time pad garante integridade? Dê um exemplo de ataque.',
    answer:
      'Não. A cifra é maleável: somar d a uma letra da cifra soma d à mesma letra do texto claro, sem que Eva conheça a chave. Se Eva sabe que a mensagem diz "PAGAR 100" na posição X, ela pode trocar o 1 por 9 e Bob decifrará "PAGAR 900" sem qualquer erro. Por isso o sigilo precisa ser combinado com autenticação (como um HMAC ou o GCM).',
  },
  {
    question: 'Se o one-time pad é perfeitamente seguro, por que quase não é usado?',
    answer:
      'Porque o custo prático é enorme: a chave deve ser sorteada por uma fonte realmente aleatória, ser tão longa quanto todo o tráfego, distribuída previamente por um canal seguro e nunca reutilizada (o que exige descartar cada trecho usado). A criptografia moderna substitui isso por chaves curtas e cifras de fluxo, como o AES-CTR, cujo fluxo de chaves é pseudoaleatório: a segurança passa a ser computacional, e não perfeita.',
  },
];
