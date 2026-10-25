import type { ReviewQuestion } from '../../components/ui';

export const MLKEM_OBJECTIVES = [
  'Explicar por que um computador quântico suficientemente grande quebra o RSA, o Diffie-Hellman e a criptografia de curvas elípticas, e por que a criptografia simétrica sofre bem menos.',
  'Descrever o problema LWE (Learning With Errors) e o papel do ruído: sem ele, a eliminação de Gauss revela o segredo.',
  'Acompanhar a geração de chaves, o encapsulamento e o desencapsulamento do ML-KEM (FIPS 203), com Alice, Bob e Eva.',
  'Entender a rejeição implícita: um texto cifrado adulterado leva a uma chave diferente, sem mensagem de erro, e por que isso protege o segredo.',
  'Comparar tamanhos de chaves e textos cifrados (X25519, P-256, ML-KEM e o modo híbrido) e relacionar ao custo no TLS.',
  'Reconhecer a urgência de migrar a troca de chaves (colher agora, decifrar depois) e o papel do modo híbrido.',
];

export const MLKEM_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Por que o algoritmo de Shor ameaça o RSA, o Diffie-Hellman e o ECDH, mas o AES-256 continua seguro?',
    answer:
      'O algoritmo de Shor resolve a fatoração de inteiros e o logaritmo discreto (inclusive em curvas elípticas) em tempo polinomial em um computador quântico grande o bastante, o que desfaz a base do RSA, do Diffie-Hellman e do ECDH. Contra a criptografia simétrica e as funções de hash, o melhor ataque quântico conhecido é o de Grover, que dá apenas um ganho quadrático na busca: uma chave de 256 bits passa a valer cerca de 128 bits, ainda seguro. Para o AES basta usar chaves de 256 bits.',
  },
  {
    question: 'O que é "colher agora, decifrar depois" e por que a troca de chaves precisa migrar antes de existir o computador quântico?',
    answer:
      'Um atacante pode gravar hoje o tráfego cifrado (incluindo o acordo de chaves, que é público) e guardá-lo até ter um computador quântico, quando recuperaria as chaves de sessão e leria tudo. Dados que precisam permanecer secretos por muitos anos já estão em risco. Por isso a troca de chaves deve ser pós-quântica já, enquanto as assinaturas só precisam migrar antes de alguém conseguir forjá-las em tempo real.',
  },
  {
    question: 'No LWE, por que o ruído é necessário? O que acontece sem ele?',
    answer:
      'Sem ruído, b = A·s (mod q) é um sistema linear, e a eliminação de Gauss recupera s com poucas contas. O ruído pequeno e aleatório torna as equações levemente inconsistentes: a álgebra deixa de funcionar e o problema vira "achar o vetor do reticulado mais próximo", que não tem algoritmo eficiente conhecido, nem quântico, em dimensões grandes. O ruído não atrapalha quem tem s, porque o erro acumulado fica bem abaixo de q/4 e some no arredondamento.',
  },
  {
    question: 'Por que o ML-KEM usa q = 3329 e polinômios de 256 coeficientes?',
    answer:
      'Cada polinômio vive no anel Z_q[X]/(X^256 + 1). Com q = 3329 (primo), q − 1 = 3328 = 2^8 · 13 é divisível por 256, então existe uma raiz primitiva 256ª da unidade (17). Isso permite a NTT, a versão modular da transformada de Fourier, que multiplica polinômios em cerca de 256·log 256 operações, em vez de 256². Também mantém todos os coeficientes em 12 bits.',
  },
  {
    question: 'O que é a rejeição implícita e por que Alice não devolve um erro quando o texto cifrado foi alterado?',
    answer:
      'Alice recifra a mensagem que recuperou e compara com o texto cifrado recebido. Se diferirem, em vez de sinalizar erro ela devolve K̄ = J(z ‖ c), uma chave pseudoaleatória derivada de uma semente secreta z. Se Alice respondesse "inválido", Eva poderia testar textos cifrados modificados e usar a resposta como oráculo para descobrir o segredo (ataque de texto cifrado escolhido). Com a rejeição implícita, toda resposta parece uma chave normal e não vaza nada.',
  },
  {
    question: 'Qual é o tamanho da chave pública e do texto cifrado no ML-KEM-768, e que impacto isso tem no TLS?',
    answer:
      'A chave de encapsulamento tem 384·k + 32 = 1184 bytes e o texto cifrado tem 32·(d_u·k + d_v) = 32·(10·3 + 4) = 1088 bytes, contra 32 bytes do X25519. No modo híbrido X25519 mais ML-KEM-768, o key_share do cliente passa a ter 1216 bytes e o do servidor 1120 bytes. O ClientHello fica grande, podendo ultrapassar um pacote, mas o custo é pequeno perto do benefício. A computação é rápida, comparável à de curvas elípticas.',
  },
  {
    question: 'Por que usar um modo híbrido (X25519 mais ML-KEM) em vez de só ML-KEM?',
    answer:
      'O ML-KEM foi padronizado em 2024 e os reticulados têm menos décadas de criptoanálise que as curvas elípticas. No híbrido, a chave final depende dos dois segredos: se alguém quebrar o ML-KEM por um defeito matemático ou de implementação, o X25519 ainda protege contra atacantes clássicos; se surgir o computador quântico, o ML-KEM protege. Para o atacante vencer, precisa quebrar os dois.',
  },
];
