import type { ReviewQuestion } from '../../components/ui';

export const DH_OBJECTIVES = [
  'Explicar que o Diffie-Hellman é um mecanismo de acordo de chaves, e não de cifragem de mensagens.',
  'Calcular A = g^a mod p, B = g^b mod p e o segredo compartilhado K = g^(ab) mod p, verificando que K_A = K_B.',
  'Identificar quais informações Eve observa (p, g, A, B) e quais permanecem secretas (a, b, K).',
  'Relacionar a segurança do protocolo ao problema do logaritmo discreto.',
  'Demonstrar o ataque do homem do meio (MITM) e justificar a necessidade de autenticação.',
  'Compreender o papel de uma função de derivação de chaves (HKDF) entre o segredo compartilhado e a chave simétrica.',
];

export const DH_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Com p = 23, g = 5, a = 6 e b = 15, quais são A, B e o segredo compartilhado K?',
    answer: 'A = 5^6 mod 23 = 8; B = 5^15 mod 23 = 19; K = 19^6 mod 23 = 8^15 mod 23 = 2.',
  },
  {
    question: 'Por que Eve, conhecendo p, g, A e B, não consegue calcular K com facilidade em um grupo grande?',
    answer:
      'Ela precisaria obter a a partir de A = g^a mod p (ou b a partir de B), isto é, resolver o problema do logaritmo discreto. Em grupos adequados de 2048 bits ou mais, não se conhece algoritmo eficiente. Computar K diretamente a partir de (g, A, B) é o problema Diffie-Hellman computacional, que na prática é considerado tão difícil quanto o logaritmo discreto.',
  },
  {
    question: 'O Diffie-Hellman cifra mensagens? O que o segredo K é, de fato?',
    answer:
      'Não. O protocolo apenas faz com que dois participantes, trocando valores públicos, obtenham o mesmo segredo. Esse segredo é então processado por uma função de derivação (como HKDF) para produzir chaves simétricas, que cifram os dados com algoritmos como AES-GCM.',
  },
  {
    question: 'Por que o DH sem autenticação é vulnerável ao homem do meio?',
    answer:
      'Nada na troca vincula A ou B a uma identidade. Eve pode substituir os valores por E = g^e mod p e estabelecer um segredo com cada lado. Alice e Bob acreditam compartilhar uma chave entre si, mas Eve a conhece e repassa/altera todo o tráfego. A contramedida é autenticar a troca (assinaturas e certificados, como no TLS 1.3).',
  },
  {
    question: 'Por que os parâmetros deste laboratório (p = 23, 467, 2027) não são seguros?',
    answer:
      'Com p tão pequeno, a busca exaustiva por a (no máximo p - 2 tentativas) é instantânea. O botão de força bruta de Eve demonstra isso. Na prática, usam-se grupos de pelo menos 2048 bits (RFC 7919) ou curvas elípticas como X25519.',
  },
];
