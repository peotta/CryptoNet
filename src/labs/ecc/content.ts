import type { ReviewQuestion } from '../../components/ui';

export const ECC_OBJECTIVES = [
  'Descrever uma curva elíptica sobre um corpo finito e a lei de grupo: soma de pontos, dobro, oposto e ponto no infinito.',
  'Executar, passo a passo, a soma de pontos (inclinação, inverso modular, coordenadas) e a multiplicação escalar por dobrar e somar.',
  'Explicar o ECDH e por que a segurança vem do problema do logaritmo discreto, que só é difícil em grupos grandes.',
  'Assinar e verificar com o ECDSA e entender cada quantidade (hash z, nonce k, r, s).',
  'Demonstrar o ataque de reutilização do nonce k, que revela a chave privada em qualquer tamanho de curva.',
  'Comparar o ECDSA P-256 e o Ed25519 (assinaturas determinísticas) com a Web Crypto, e relacionar ao handshake do TLS 1.3.',
];

export const ECC_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Na curva y² = x³ + 2x + 2 (mod 17), calcule 2G com G = (5, 1).',
    answer:
      'Dobro: λ = (3x² + a)/(2y) = (3·25 + 2)/2 = 77/2. Módulo 17, 77 ≡ 9 e 2⁻¹ = 9, então λ = 81 ≡ 13. x₃ = λ² − 2x = 169 − 10 = 159 ≡ 6. y₃ = λ(x − x₃) − y = 13·(5 − 6) − 1 = −14 ≡ 3. Logo 2G = (6, 3).',
  },
  {
    question: 'Por que o ECDH com chaves de 256 bits é seguro, se a conta k · G é tão simples?',
    answer:
      'Calcular k · G é rápido (cerca de 256 dobras e somas), mas descobrir k a partir de k · G é o logaritmo discreto em curva elíptica, para o qual o melhor ataque conhecido (rho de Pollard) leva cerca de 2¹²⁸ operações em uma curva de 256 bits. Na curva didática de ordem 19 bastam 19 tentativas. A segurança vem do tamanho do grupo, e não da conta em si.',
  },
  {
    question: 'Por que o ECDSA com a mesma chave de 256 bits oferece segurança equivalente a um RSA de 3072 bits?',
    answer:
      'Para o RSA existem algoritmos subexponenciais de fatoração (crivo de corpo de números), então o módulo precisa ser grande. Para curvas bem escolhidas só se conhecem ataques exponenciais (cerca de a raiz quadrada da ordem do grupo), de modo que 256 bits de curva dão cerca de 128 bits de segurança, o que o RSA só atinge com cerca de 3072 bits. Daí chaves e assinaturas menores e operações mais rápidas.',
  },
  {
    question: 'O que acontece se Alice reutilizar o nonce k em duas assinaturas ECDSA?',
    answer:
      'As duas assinaturas têm o mesmo r. Subtraindo as equações s = k⁻¹(z + r·d), obtém-se s₁ − s₂ = k⁻¹(z₁ − z₂), logo k = (z₁ − z₂)/(s₁ − s₂). Com k conhecido, d = (s₁·k − z₁)/r. Eva obtém a chave privada e assina o que quiser. Isso vale para qualquer curva. Casos reais: a chave de assinatura do PlayStation 3 (2010) e carteiras de bitcoin com geradores aleatórios defeituosos.',
  },
  {
    question: 'Como o Ed25519 evita o problema do nonce?',
    answer:
      'O nonce r é derivado por hash da parte secreta da chave e da mensagem, sem sorteio: duas assinaturas da mesma mensagem são idênticas, e mensagens diferentes dão nonces diferentes e imprevisíveis para quem não conhece a chave. O ECDSA moderno pode fazer o mesmo (RFC 6979), mas o Ed25519 já nasceu assim.',
  },
  {
    question: 'Por que a troca de chaves elíptica sozinha não protege contra o homem do meio?',
    answer:
      'O ECDH garante apenas que, se Alice e a outra ponta calculam o mesmo ponto, só elas o conhecem. Não diz quem é a outra ponta: Eva pode fazer um ECDH com cada lado. Por isso o TLS 1.3 combina o ECDHE com certificados e com uma assinatura (ECDSA ou Ed25519) sobre a transcrição do handshake.',
  },
];
