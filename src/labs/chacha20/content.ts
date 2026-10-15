import type { ReviewQuestion } from '../../components/ui';

export const CHACHA_OBJECTIVES = [
  'Descrever uma cifra de fluxo: um fluxo de chaves pseudoaleatório gerado de uma chave curta e combinado com a mensagem por XOR.',
  'Executar o quarter round (12 operações ARX) e a função de bloco do ChaCha20 (20 rodadas e soma final), conferidos com a RFC 8439.',
  'Explicar a função da chave de 256 bits, do nonce de 96 bits e do contador de 32 bits.',
  'Mostrar por que reutilizar o par (chave, nonce) é catastrófico: C1 ⊕ C2 = m1 ⊕ m2, e o arrasto de texto provável de Eva.',
  'Demonstrar a maleabilidade: sem autenticação, Eva altera bits da mensagem sem conhecer a chave.',
  'Comparar com o one-time pad (fluxo realmente aleatório) e com o AES-CTR, e situar o ChaCha20-Poly1305 no TLS 1.3.',
];

export const CHACHA_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'O que significa ARX e por que o ChaCha20 usa apenas essas operações?',
    answer:
      'ARX são as iniciais de Add (soma módulo 2³²), Rotate (rotação de bits) e XOR. Juntas são não lineares o bastante para misturar bem os bits e rodam em tempo constante em qualquer processador, sem tabelas de consulta. Por isso o ChaCha20 é rápido em software e resiste a ataques de tempo de acesso ao cache, ao contrário de implementações do AES baseadas em S-boxes sem instruções dedicadas.',
  },
  {
    question: 'Como o ChaCha20 transforma uma chave de 32 bytes em um fluxo de chaves longo?',
    answer:
      'Para cada contador i, monta-se um estado de 16 palavras (4 constantes, 8 da chave, o contador e 3 do nonce), aplica-se a função de bloco (20 rodadas) e soma-se o resultado ao estado inicial, obtendo 64 bytes. Com i = 1, 2, 3, ... os blocos são concatenados. A mensagem é combinada com esse fluxo por XOR, e a decifragem é a mesma operação.',
  },
  {
    question: 'Por que o nonce não pode se repetir com a mesma chave?',
    answer:
      'Porque o fluxo de chaves depende só de (chave, nonce, contador). Com o nonce repetido, duas mensagens usam o mesmo fluxo: C1 ⊕ C2 = (m1 ⊕ KS) ⊕ (m2 ⊕ KS) = m1 ⊕ m2. A chave se cancela, e Eva, com um trecho provável de uma das mensagens, lê o trecho correspondente da outra e recupera parte do fluxo de chaves. É o mesmo problema do one-time pad reutilizado.',
  },
  {
    question: 'O ChaCha20 sozinho protege a integridade da mensagem?',
    answer:
      'Não. Como C = m ⊕ KS, inverter um bit da cifra inverte exatamente o mesmo bit do texto claro, sem que Eva conheça a chave, e Bob não percebe. Por isso o ChaCha20 é combinado com o Poly1305 (código de autenticação) no ChaCha20-Poly1305 (RFC 8439), um AEAD usado no TLS 1.3 e no WireGuard.',
  },
  {
    question: 'Qual a diferença entre o one-time pad e o ChaCha20?',
    answer:
      'No one-time pad a chave é aleatória, tão longa quanto a mensagem e de uso único: o sigilo é perfeito (Shannon). No ChaCha20 o fluxo é pseudoaleatório, gerado de uma chave de 256 bits: a segurança é computacional, e depende de ninguém conseguir distinguir o fluxo de uma sequência aleatória em tempo viável. Em troca, a chave é curta e reutilizável (com nonces diferentes).',
  },
  {
    question: 'Quantas mensagens de 64 bytes cabem em um mesmo nonce e quanto tempo dura uma chave?',
    answer:
      'O contador tem 32 bits, então um par (chave, nonce) cifra até 2³² blocos de 64 bytes, cerca de 256 GiB. Com nonces de 96 bits e escolhidos sem repetição (um contador de mensagens, por exemplo), a mesma chave pode proteger muito tráfego. Se os nonces forem sorteados ao acaso, a probabilidade de colisão limita a quantidade de mensagens por chave (paradoxo do aniversário), motivo para existir a variante XChaCha20 com nonce de 192 bits.',
  },
];
