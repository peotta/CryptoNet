// Fase 2 do item 2.1 da Fundamentação: DES, ChaCha20, RC4 e one-time pad.
// Cada laboratório traz diagramas de sequência (Alice, Bob e Eva) e um fluxograma da estrutura interna da cifra
// (campo tipo: 'fluxograma'). Mesmo formato de scripts/diagramas-fase1.mjs.
// Os links dos artigos foram conferidos em 2026-11-07: os PDFs hospedados pelos autores respondem como application/pdf;
// os DOIs levam à página da editora, que bloqueia leitura automática, mas abre no navegador.
// Os dados de volume, número e páginas das citações vêm do conhecimento do autor do módulo e devem ser conferidos
// contra a publicação antes de uso em material oficial.

export const FUNDAMENTACAO_FASE2 = {
  des: {
    artigos: [
      {
        citacao: 'Feistel, H. *Cryptography and computer privacy*. Scientific American, v. 228, n. 5, p. 15-23, maio 1973.',
        links: [['DOI 10.1038/scientificamerican0573-15', 'https://doi.org/10.1038/scientificamerican0573-15']],
      },
      {
        citacao: 'Diffie, W.; Hellman, M. E. *Exhaustive cryptanalysis of the NBS Data Encryption Standard*. Computer, v. 10, n. 6, p. 74-84, jun. 1977.',
        links: [['Acessar o artigo (PDF, Universidade de Stanford)', 'https://ee.stanford.edu/~hellman/publications/27.pdf']],
      },
      {
        citacao: 'Bhargavan, K.; Leurent, G. *On the practical (in-)security of 64-bit block ciphers: collision attacks on HTTP over TLS and OpenVPN* (Sweet32). In: ACM CCS 2016.',
        links: [['Página do ataque Sweet32', 'https://sweet32.info/']],
      },
    ],
    titulo: 'Diagramas do DES em uso e da rede de Feistel',
    intro:
      'Os diagramas abaixo mostram o DES antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal e, quando indicado, altera a cifra ou testa chaves. **K** é a chave secreta, **IV** o vetor de inicialização (*initialization vector*), **P_i** o bloco i do texto claro (8 bytes) e **C_i** o bloco i da cifra. O último diagrama é um fluxograma da estrutura interna: a rede de Feistel de 16 rodadas e o escalonamento de chaves.',
    diagramas: [
      {
        titulo: 'DES em modo CBC e a alteração de um bit pela Eva',
        ref: 'Cipher Block Chaining',
        descricao:
          'Alice completa a mensagem até um múltiplo de 8 bytes (preenchimento PKCS#7), sorteia um IV novo e cifra bloco a bloco: cada bloco claro é somado (XOR) à cifra anterior antes de entrar no DES, e o primeiro usa o IV. O IV trafega em claro junto com a cifra. Eva inverte um bit do bloco cifrado 2 e reenvia. Bob decifra: o bloco 2 sai embaralhado e o bloco 3 sai com exatamente o mesmo bit invertido, sem que o DES, que não autentica, perceba a alteração.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: K combinada antes<br/>por canal seguro
    A->>A: Completa a mensagem em blocos de 8 bytes
    A->>A: Sorteia um IV novo
    A->>A: C1 = DES(K, P1 xor IV)
    A->>A: Ci = DES(K, Pi xor C(i-1))
    A->>E: IV e C1, C2, C3 pelo canal público
    Note over E: Eva inverte<br/>um bit de C2
    E->>B: IV, C1, C2', C3
    B->>B: Pi = DES inverso(Ci) xor C(i-1)
    Note over B: P2 sai embaralhado<br/>e P3 sai com o bit<br/>invertido de Eva`,
      },
      {
        titulo: 'Busca exaustiva contra o DES e o Triple DES',
        ref: 'chave de 56 bits e bloco de 64 bits',
        descricao:
          'Eva conhece o início do texto claro (um cabeçalho de protocolo) e captura o IV e a cifra. Para cada uma das chaves possíveis ela decifra o primeiro bloco e compara com o cabeçalho conhecido; a chave que confere é a correta. Com 56 bits úteis o espaço é de 2^56 chaves, viável com máquinas dedicadas (o EFF DES Cracker o percorreu em 56 horas, em 1998). O Triple DES (cifrar, decifrar, cifrar com K1, K2 e K3) eleva o custo da busca, mas mantém o bloco de 64 bits: após cerca de 2^32 blocos sob a mesma chave, o paradoxo do aniversário produz colisões que vazam informação (ataque Sweet32).',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    A->>B: IV e cifra em CBC com o DES
    Note over E: Eva captura o IV<br/>e a cifra
    E->>E: X = P1 conhecido xor IV
    loop Para cada chave K' possível
        E->>E: Calcula DES(K', X)
        E->>E: Compara com C1
    end
    Note over E: A chave que confere<br/>é a chave de Alice
    E->>E: Decifra a mensagem inteira
    Note over A,B: Troca para o Triple DES<br/>com K1, K2 e K3
    A->>A: C = E(K3, D(K2, E(K1, X)))
    A->>B: IV e cifra
    B->>B: Decifra na ordem inversa
    Note over E: A busca fica inviável,<br/>mas o bloco continua<br/>com 64 bits (Sweet32)`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Estrutura interna: rede de Feistel de 16 rodadas e escalonamento de chaves',
        ref: 'fluxograma',
        descricao:
          'O bloco de 64 bits sofre a permutação inicial (IP) e é dividido em duas metades de 32 bits, L e R. Em cada uma das 16 rodadas, a metade direita passa pela função f e o resultado é somado (XOR) à metade esquerda; depois as metades trocam de lugar. Dentro de f, R é expandido para 48 bits, somado à subchave da rodada, dividido em oito grupos de 6 bits que passam pelas caixas S (cada uma devolve 4 bits) e os 32 bits resultantes são permutados (P). Ao final, as metades são trocadas uma última vez e aplica-se a permutação final (IP inversa). As 16 subchaves de 48 bits vêm da chave de 64 bits (56 úteis): a permutação PC-1 descarta os bits de paridade, as duas metades de 28 bits sofrem rotações à esquerda a cada rodada e a permutação PC-2 seleciona 48 bits. Decifrar é executar o mesmo caminho com as subchaves em ordem inversa.',
        mermaid: `flowchart TD
    P["Bloco claro de 64 bits"] --> IP["Permutação inicial IP"]
    IP --> SPL["Divide em L0 e R0, 32 bits cada"]
    SPL --> RD
    subgraph RD["Rodada i, de 1 a 16"]
        direction TB
        R1["R(i-1), 32 bits"] --> EX["Expansão E: 48 bits"]
        EX --> XK["XOR com a subchave Ki"]
        XK --> SB["Oito caixas S: 6 bits entram, 4 saem"]
        SB --> PP["Permutação P: 32 bits"]
        PP --> XL["XOR com L(i-1)"]
        XL --> NR["Ri = resultado e Li = R(i-1)"]
    end
    RD --> SW["Troca final das metades"]
    SW --> FP["Permutação final IP inversa"]
    FP --> C["Bloco cifrado de 64 bits"]
    K["Chave de 64 bits, 56 úteis"] --> PC1["PC-1: descarta paridade"]
    PC1 --> ROT["Rotações à esquerda de C e D"]
    ROT --> PC2["PC-2: seleciona 48 bits"]
    PC2 --> KI["Subchave Ki"]
    KI --> XK`,
      },
    ],
  },

  chacha20: {
    artigos: [
      {
        citacao: 'Bernstein, D. J. *ChaCha, a variant of Salsa20*. Documento técnico, 28 jan. 2008.',
        links: [['Acessar o documento (PDF, autor)', 'https://cr.yp.to/chacha/chacha-20080128.pdf']],
      },
      {
        citacao: 'Bernstein, D. J. *The Salsa20 family of stream ciphers*, cifra da qual o ChaCha deriva.',
        links: [['Página da família Salsa20', 'https://cr.yp.to/snuffle.html'], ['Especificação do Salsa20 (PDF)', 'https://cr.yp.to/snuffle/spec.pdf']],
      },
      {
        citacao: 'Nir, Y.; Langley, A. *ChaCha20 and Poly1305 for IETF Protocols*. [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439), jun. 2018, que define o ChaCha20 de 96 bits de nonce e o modo autenticado.',
        links: [],
      },
    ],
    titulo: 'Diagramas do ChaCha20 em uso e da estrutura do bloco',
    intro:
      'Os diagramas abaixo mostram o ChaCha20 antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal e, quando indicado, altera a cifra. **K** é a chave de 256 bits, **N** o nonce de 96 bits, **KS** o fluxo de chaves e **m** a mensagem. O último diagrama é um fluxograma da estrutura interna: o estado de 16 palavras, as 20 rodadas e o *quarter round*.',
    diagramas: [
      {
        titulo: 'Cifragem com nonce novo e a alteração de um bit pela Eva',
        ref: 'uso correto sem autenticação',
        descricao:
          'Alice e Bob compartilham K. Para cada mensagem Alice sorteia um nonce novo, calcula os blocos de 64 bytes do fluxo de chaves com o contador 1, 2, 3 e assim por diante, e soma o fluxo à mensagem por XOR. O nonce trafega em claro junto com a cifra. Como a cifra é só um XOR, Eva inverte um bit da cifra e o mesmo bit sai invertido no claro de Bob, que não percebe: o ChaCha20 sozinho garante sigilo, não integridade. A prática é usá-lo com o autenticador Poly1305 (ChaCha20-Poly1305).',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: K de 256 bits<br/>combinada antes
    A->>A: Sorteia um nonce N novo
    A->>A: KS = ChaCha20(K, N, contador 1, 2, ...)
    A->>A: C = m xor KS
    A->>E: N e C pelo canal público
    Note over E: Eva inverte<br/>um bit de C
    E->>B: N e C'
    B->>B: KS = ChaCha20(K, N, contador 1, 2, ...)
    B->>B: m' = C' xor KS
    Note over B: O mesmo bit de m<br/>sai invertido<br/>e Bob aceita`,
      },
      {
        titulo: 'Reutilização do nonce e o arrasto de texto provável',
        ref: 'mesmo par (K, N) em duas mensagens',
        descricao:
          'Alice comete o erro de usar o mesmo nonce em duas mensagens, de modo que as duas são somadas ao mesmo fluxo de chaves. Eva captura as duas cifras e as soma: o fluxo se cancela e sobra m1 xor m2. Eva então arrasta um trecho de texto que ela supõe existir em uma das mensagens (um texto provável, ou *crib*) sobre m1 xor m2; onde o palpite acerta, aparece trecho legível da outra mensagem. Bob decifra normalmente e não detecta o problema. A regra é nunca repetir o par (chave, nonce).',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Mesma K e mesmo N<br/>nas duas mensagens
    A->>A: C1 = m1 xor KS
    A->>A: C2 = m2 xor KS
    A->>E: N e C1
    A->>E: N e C2
    E->>E: C1 xor C2 = m1 xor m2
    Note over E: O fluxo KS<br/>se cancelou
    E->>E: Arrasta um texto provável<br/>sobre m1 xor m2
    Note over E: Onde o palpite acerta,<br/>surge texto legível<br/>da outra mensagem
    E->>B: C1 e C2 seguem a Bob
    B->>B: Decifra normalmente`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Estrutura interna: estado, 20 rodadas e quarter round',
        ref: 'fluxograma',
        descricao:
          'O estado é uma matriz de 4 por 4 palavras de 32 bits: quatro constantes ("expand 32-byte k"), as oito palavras da chave, o contador de bloco e as três palavras do nonce. O bloco executa 20 rodadas, agrupadas em 10 pares: uma rodada de colunas e uma rodada de diagonais, cada uma aplicando o *quarter round* a quatro palavras. O quarter round usa apenas soma módulo 2^32, XOR e rotação (por isso se diz ARX, de *add-rotate-xor*), com rotações de 16, 12, 8 e 7 bits. Ao final, o estado inicial é somado ao estado embaralhado e o resultado é serializado em 64 bytes de fluxo de chaves. Cada bloco usa um valor diferente do contador.',
        mermaid: `flowchart TD
    CST["4 constantes"] --> ST
    KEY["Chave K: 8 palavras"] --> ST
    CTR["Contador de bloco"] --> ST
    NON["Nonce N: 3 palavras"] --> ST
    ST["Estado inicial: matriz 4 por 4 de palavras de 32 bits"] --> DR
    subgraph DR["10 repetições de um par de rodadas"]
        direction TB
        COL["Rodada de colunas: 4 quarter rounds"] --> DIA["Rodada de diagonais: 4 quarter rounds"]
    end
    DR --> ADD["Soma do estado inicial ao estado final, palavra a palavra"]
    ADD --> SER["Serializa em 64 bytes do fluxo de chaves"]
    SER --> XR["XOR com 64 bytes da mensagem"]
    subgraph QR["Quarter round sobre a, b, c, d"]
        direction TB
        Q1["a = a + b, d = d xor a, d gira 16 bits"] --> Q2["c = c + d, b = b xor c, b gira 12 bits"]
        Q2 --> Q3["a = a + b, d = d xor a, d gira 8 bits"]
        Q3 --> Q4["c = c + d, b = b xor c, b gira 7 bits"]
    end
    COL -.-> QR`,
      },
    ],
  },

  rc4: {
    artigos: [
      {
        citacao: 'Fluhrer, S.; Mantin, I.; Shamir, A. *Weaknesses in the Key Scheduling Algorithm of RC4*. In: Selected Areas in Cryptography (SAC 2001), Lecture Notes in Computer Science, v. 2259. Springer, 2001.',
        links: [
          ['Acessar o artigo (PDF, cópia hospedada na Universidade Cornell)', 'https://www.cs.cornell.edu/people/egs/615/rc4_ksaproc.pdf'],
          ['DOI 10.1007/3-540-45537-X_1', 'https://doi.org/10.1007/3-540-45537-X_1'],
        ],
      },
      {
        citacao: 'AlFardan, N. J.; Bernstein, D. J.; Paterson, K. G.; Poettering, B.; Schuldt, J. C. N. *On the Security of RC4 in TLS*. In: 22nd USENIX Security Symposium, 2013.',
        links: [['Acessar o artigo (PDF, USENIX)', 'https://www.usenix.org/system/files/conference/usenixsecurity13/sec13-paper_alfardan.pdf']],
      },
      {
        citacao: 'Popov, A. *Prohibiting RC4 Cipher Suites*. [RFC 7465](https://www.rfc-editor.org/rfc/rfc7465), fev. 2015.',
        links: [],
      },
    ],
    rotuloArtigos: '**Artigos e especificação.** O RC4 foi projetado por Ronald Rivest em 1987 e nunca foi publicado oficialmente: o algoritmo tornou-se público por divulgação não autorizada em 1994, de modo que não há artigo original do autor.',
    titulo: 'Diagramas do RC4 em uso, do ataque ao WEP e da estrutura interna',
    intro:
      'Os diagramas abaixo mostram o RC4 antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal e, quando indicado, altera a cifra ou coleta quadros. **K** é a chave, **S** o estado de 256 bytes, **KS** o fluxo de chaves e **m** a mensagem. O último diagrama é um fluxograma da estrutura interna: o escalonamento de chaves (KSA) e a geração do fluxo (PRGA).',
    diagramas: [
      {
        titulo: 'Chave de sessão, cifragem e a alteração de um bit pela Eva',
        ref: 'uso sem nonce',
        descricao:
          'Alice e Bob compartilham K. Cada um executa o KSA, que embaralha o estado S com a chave, e depois o PRGA, que emite um byte de fluxo por troca de elementos de S. Alice soma o fluxo à mensagem por XOR. O RC4 não tem nonce: usar a mesma chave duas vezes reproduz o mesmo fluxo. Eva inverte um bit da cifra e o mesmo bit sai invertido no claro de Bob, que não percebe, pois a cifra não autentica. Além disso, o fluxo tem vieses estatísticos (o segundo byte vale zero com probabilidade próxima de 2/256, o dobro do esperado), o que motivou a proibição do RC4 no TLS.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: K combinada antes<br/>por canal seguro
    A->>A: KSA: embaralha S com K
    A->>A: PRGA: gera KS byte a byte
    A->>A: C = m xor KS
    A->>E: C pelo canal público
    Note over E: Eva inverte<br/>um bit de C
    E->>B: C'
    B->>B: KSA e PRGA com a mesma K
    B->>B: m' = C' xor KS
    Note over B: O mesmo bit de m<br/>sai invertido<br/>e Bob aceita`,
      },
      {
        titulo: 'WEP: Eva recupera a chave raiz (ataque FMS)',
        ref: 'IV de 3 bytes em claro',
        descricao:
          'No WEP, a estação (Alice) cifra cada quadro com o RC4 usando como chave o IV de 3 bytes, transmitido em claro, seguido da chave raiz K compartilhada com o ponto de acesso (Bob). Como o IV é curto e visível, Eva colhe quadros e separa os que têm IV fracos (na forma A+3, 255, X). Todo quadro começa com o cabeçalho 0xAA, então Eva obtém o primeiro byte do fluxo de cada quadro por z0 = c0 xor 0xAA. Pelo ataque de Fluhrer, Mantin e Shamir, cada quadro fraco vota em um valor para o byte seguinte da chave raiz com probabilidade acima da ao acaso (cerca de 5%); com votos suficientes o valor mais votado é o byte correto. Byte a byte, Eva reconstrói a chave raiz e passa a ler o tráfego.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice (estação)
    participant B as Bob (ponto de acesso)
    participant E as Eva
    Note over A,B: Chave raiz K<br/>compartilhada
    A->>A: Chave do quadro = IV seguido de K
    A->>B: IV em claro e quadro cifrado com RC4
    B->>B: Decifra com IV seguido de K
    Note over E: Eva colhe quadros<br/>e guarda os de IV fraco
    E->>E: z0 = c0 xor 0xAA
    loop Para cada byte da chave raiz
        E->>E: Cada quadro fraco vota<br/>no próximo byte de K
        E->>E: Fica com o valor mais votado
    end
    Note over E: Chave raiz recuperada,<br/>o tráfego é legível`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Estrutura interna: KSA e PRGA',
        ref: 'fluxograma',
        descricao:
          'O estado S começa como a permutação identidade dos valores 0 a 255. No KSA (*key-scheduling algorithm*), um índice j é atualizado com j = j + S[i] + K[i mod n] (módulo 256) e S[i] troca de lugar com S[j], para i de 0 a 255; a chave decide como o estado é embaralhado. No PRGA (*pseudo-random generation algorithm*), a cada byte de saída i avança uma posição, j soma S[i], os elementos S[i] e S[j] trocam de lugar e o byte do fluxo é S[(S[i] + S[j]) mod 256]. O fluxo é combinado com a mensagem por XOR.',
        mermaid: `flowchart TD
    K["Chave K de n bytes"] --> KSA
    subgraph KSA["KSA, escalonamento de chaves"]
        direction TB
        I0["S = 0, 1, ..., 255 e j = 0"] --> KL["Para i de 0 a 255: j = j + S i + K i mod n, módulo 256"]
        KL --> KS1["Troca S i com S j"]
        KS1 -->|"próximo i"| KL
    end
    KSA --> PRGA
    subgraph PRGA["PRGA, geração do fluxo de chaves"]
        direction TB
        P0["i = 0 e j = 0"] --> PL["i = i + 1 e j = j + S i, módulo 256"]
        PL --> PS["Troca S i com S j"]
        PS --> PO["Byte de saída = S de S i + S j, módulo 256"]
        PO -->|"próximo byte"| PL
    end
    PO --> XR["XOR do byte de saída com um byte da mensagem"]`,
      },
    ],
  },

  otp: {
    artigos: [
      {
        citacao: 'Shannon, C. E. *Communication theory of secrecy systems*. Bell System Technical Journal, v. 28, n. 4, p. 656-715, out. 1949.',
        links: [
          ['Acessar o artigo (Internet Archive)', 'https://archive.org/details/bstj28-4-656'],
          ['PDF hospedado pela Universidade de Virgínia', 'https://www.cs.virginia.edu/~evans/greatworks/shannon1949.pdf'],
        ],
      },
      {
        citacao: 'Vernam, G. S. *Secret signaling system*. Patente US 1.310.719, 1919, origem da cifra com chave de uso único.',
        links: [['Acessar a patente (Google Patents)', 'https://patents.google.com/patent/US1310719A/en']],
      },
    ],
    titulo: 'Diagramas do one-time pad e do seu uso incorreto',
    intro:
      'Os diagramas abaixo mostram o one-time pad antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal e, quando indicado, altera a cifra ou explora a reutilização da chave. **K** é a chave aleatória do tamanho da mensagem, **P** o texto claro e **C** a cifra. O último diagrama é um fluxograma do ciclo de vida da chave.',
    diagramas: [
      {
        titulo: 'Sigilo perfeito e a maleabilidade da cifra',
        ref: 'uso correto',
        descricao:
          'Alice e Bob possuem a mesma chave K, verdadeiramente aleatória, do tamanho da mensagem. Alice soma K ao claro letra a letra (módulo 26) e Bob subtrai K da cifra para recuperar a mensagem. Eva vê apenas C: como qualquer texto de mesmo tamanho é compatível com alguma chave, a cifra não revela nada além do tamanho, e esta é a propriedade que Shannon chamou de sigilo perfeito. Mesmo assim a cifra é maleável: se Eva soma 1 a uma letra da cifra, Bob obtém o claro com aquela letra somada de 1, sem que a chave seja conhecida por Eva.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: K aleatória, do tamanho<br/>da mensagem, combinada antes
    A->>A: Ci = (Pi + Ki) mod 26
    A->>E: C pelo canal público
    Note over E: Qualquer claro de mesmo<br/>tamanho é compatível<br/>com alguma chave
    E->>B: C' com uma letra somada de 1
    B->>B: Pi' = (C'i - Ki) mod 26
    Note over B: A letra alterada sai<br/>somada de 1 no claro`,
      },
      {
        titulo: 'Reutilização da chave (two-time pad)',
        ref: 'a mesma K em duas mensagens',
        descricao:
          'Alice usa a mesma chave K em duas mensagens P1 e P2. Eva captura C1 e C2 e subtrai uma da outra: a chave se cancela e sobra P1 - P2 (módulo 26), a diferença dos dois claros. Eva arrasta um texto provável sobre essa diferença e, onde o palpite acerta, aparece o trecho correspondente da outra mensagem. Foi assim que o projeto Venona decifrou parte do tráfego soviético, produzido com blocos de chaves repetidos. Bob decifra normalmente e não detecta nada. A chave de uso único só é segura se for usada uma vez.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: A mesma K<br/>nas duas mensagens
    A->>A: C1 = P1 + K, mod 26
    A->>A: C2 = P2 + K, mod 26
    A->>E: C1
    A->>E: C2
    E->>E: C1 - C2 = P1 - P2
    Note over E: A chave K<br/>se cancelou
    E->>E: Arrasta um texto provável<br/>sobre P1 - P2
    Note over E: Onde o palpite acerta,<br/>surge texto legível<br/>da outra mensagem
    E->>B: C1 e C2 seguem a Bob
    B->>B: Decifra normalmente`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Ciclo de vida da chave de uso único',
        ref: 'fluxograma',
        descricao:
          'A segurança do one-time pad está inteira no tratamento da chave. Ela deve vir de uma fonte verdadeiramente aleatória, ter pelo menos o tamanho da mensagem, ser entregue a Alice e a Bob por um meio seguro antes da comunicação e ser destruída logo depois do uso. O fluxograma mostra o caminho correto e o desvio perigoso: reutilizar uma chave já gasta leva ao two-time pad do diagrama anterior.',
        mermaid: `flowchart TD
    G["Gera a chave com fonte verdadeiramente aleatória"] --> L["Tamanho da chave igual ou maior que o da mensagem"]
    L --> D["Entrega a Alice e a Bob por meio seguro"]
    D --> U{"A chave já foi usada?"}
    U -->|"não"| EN["Alice cifra: C = P + K, módulo 26"]
    EN --> DE["Bob decifra: P = C - K, módulo 26"]
    DE --> X["Destrói a chave nos dois lados"]
    U -->|"sim"| R["Reutilização: Eva obtém P1 - P2"]
    R --> F["Sigilo perfeito perdido"]`,
      },
    ],
  },
};
