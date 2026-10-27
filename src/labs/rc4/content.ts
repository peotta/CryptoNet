import type { ReviewQuestion } from '../../components/ui';

export const RC4_OBJECTIVES = [
  'Executar a KSA (256 trocas que embaralham o estado com a chave) e a PRGA (uma troca por byte emitido) do RC4, conferidas com os vetores conhecidos e com a RFC 6229.',
  'Explicar que o RC4 é uma cifra de fluxo sem nonce: a mesma chave gera sempre o mesmo fluxo, o que obriga a acrescentar um IV à chave (como no WEP).',
  'Mostrar a maleabilidade: sem autenticação, Eva inverte bits do claro sem conhecer a chave.',
  'Reproduzir o ataque FMS contra o WEP: com o IV em claro e um primeiro byte de claro conhecido (0xAA), Eva recupera a chave raiz byte a byte por votação.',
  'Verificar o viés do segundo byte do fluxo (zero com probabilidade próxima de 2/256) e o efeito de descartar o início do fluxo.',
  'Situar o RC4 entre as cifras abandonadas (RFC 7465 e RFC 8758) e compará-lo com o ChaCha20 e o AES-CTR.',
];

export const RC4_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Como o RC4 transforma uma chave curta em um fluxo de bytes?',
    answer:
      'O estado S começa como a permutação identidade de 0 a 255. A KSA percorre i de 0 a 255, calcula j = j + S[i] + K[i mod tamanho] e troca S[i] com S[j], o que embaralha S de modo dependente da chave. A PRGA, a cada byte, faz i = i + 1, j = j + S[i], troca S[i] com S[j] e emite S[(S[i] + S[j]) mod 256]. A mensagem é combinada com esse fluxo por XOR, e decifrar é a mesma operação.',
  },
  {
    question: 'Por que o RC4 precisa de um IV acrescentado à chave, e por que isso foi um problema no WEP?',
    answer:
      'O RC4 não tem nonce: com a mesma chave, o fluxo é sempre o mesmo, e reutilizá-lo permite a Eva obter C1 ⊕ C2 = m1 ⊕ m2. O WEP resolveu isso formando a chave de cada quadro como IV (24 bits) seguido da chave raiz. Mas o IV é curto (repete-se após cerca de 16 milhões de quadros), viaja em claro e fica justamente no início da chave, onde a KSA é mais fraca. Isso permite o ataque FMS.',
  },
  {
    question: 'Como funciona o ataque FMS em linhas gerais?',
    answer:
      'Para IVs da forma (B+3, 255, X), quando os três primeiros bytes são conhecidos e o byte B da chave raiz é o próximo, a KSA, depois de B+3 passos, deixa o estado em uma situação em que, com probabilidade de cerca de 5%, o primeiro byte do fluxo é determinado pelo byte desconhecido: K[B+3] = S⁻¹[z0] − j − S[B+3]. Eva obtém z0 pelo XOR do primeiro byte cifrado com 0xAA (cabeçalho SNAP conhecido). Cada quadro vota em um valor; o certo recebe mais votos que os outros. Repetindo para cada byte, ela recupera a chave sem testar as 2^40 possibilidades.',
  },
  {
    question: 'Por que o primeiro byte do claro ser conhecido facilita o ataque?',
    answer:
      'Porque a cifra de fluxo é C = m ⊕ fluxo: se Eva conhece m, obtém o fluxo diretamente, sem adivinhar nada. No 802.11, todo quadro IP começa pelo cabeçalho LLC/SNAP AA AA 03 00 00 00. É um caso de texto claro conhecido, comum em protocolos, com cabeçalhos fixos.',
  },
  {
    question: 'O que é o viés do segundo byte e como descartar o início do fluxo ajuda?',
    answer:
      'No RC4, o segundo byte do fluxo vale zero com probabilidade próxima de 2/256 (o dobro de um fluxo aleatório), por uma propriedade da PRGA quando S[2] = 0. Se uma mesma mensagem é cifrada com muitas chaves, o atacante vê um valor aparecer mais que os outros naquela posição e deduz o claro. Descartar os primeiros 256 bytes (RC4-drop[256]) elimina esse viés e outros do início do fluxo, mas vieses em posições posteriores continuam, e o RC4 acabou proibido no TLS (RFC 7465).',
  },
  {
    question: 'Por que o ChaCha20 e o AES-CTR são preferíveis ao RC4?',
    answer:
      'Têm nonce (a mesma chave serve para muitas mensagens sem repetir o fluxo), não apresentam vieses estatísticos conhecidos, têm análise de segurança mais completa e, no caso do ChaCha20-Poly1305 e do AES-GCM, vêm em modos autenticados (AEAD), o que impede a maleabilidade. O RC4 só cifra, é enviesado e exige gambiarras como o IV do WEP.',
  },
];
