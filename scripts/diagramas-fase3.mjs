// Fase 3 do item 2.1 da Fundamentação: cifras clássicas e Enigma/Bombe.
// Cada laboratório traz diagramas de sequência (Alice, Bob e Eva) e um fluxograma da estrutura interna
// (campo tipo: 'fluxograma'). Mesmo formato de scripts/diagramas-fase2.mjs.
// Os links foram conferidos em 2026-11-07: PDFs e páginas respondem por HTTP e os DOIs foram confrontados com o Crossref
// (título, volume, número e páginas). Editoras que bloqueiam leitura automática (T&F) abrem no navegador.
// Referências sem link (Friedman 1922) não têm cópia pública conferida; a citação vem do conhecimento do autor do módulo
// e deve ser conferida antes do uso em material oficial.

const SHANNON = {
  citacao: 'Shannon, C. E. *Communication theory of secrecy systems*. Bell System Technical Journal, v. 28, n. 4, p. 656-715, out. 1949.',
  links: [
    ['Acessar o artigo (Internet Archive)', 'https://archive.org/details/bstj28-4-656'],
    ['PDF hospedado pela Universidade de Virgínia', 'https://www.cs.virginia.edu/~evans/greatworks/shannon1949.pdf'],
  ],
};

const REJEWSKI = {
  citacao: 'Rejewski, M. *An application of the theory of permutations in breaking the Enigma cipher*. Applicationes Mathematicae, v. 16, n. 4, p. 543-559, 1980.',
  links: [
    ['Acessar o artigo (PDF digitalizado, Crypto Cellar)', 'https://cryptocellar.org/enigma/files/rew80.pdf'],
    ['DOI 10.4064/am-16-4-543-559', 'https://doi.org/10.4064/am-16-4-543-559'],
  ],
};

const TURING = {
  citacao: 'Turing, A. M. *Mathematical theory of ENIGMA machine* (o "Prof\'s Book", ou *Treatise on the Enigma*), c. 1939-1942. The National Archives, Reino Unido, HW 25/3.',
  links: [['Registro no catálogo do National Archives', 'https://beta.nationalarchives.gov.uk/catalogue/id/C6136633']],
};

export const FUNDAMENTACAO_FASE3 = {
  'cesar-afim': {
    artigos: [
      {
        citacao: 'Suetônio. *Vidas dos Doze Césares*, Júlio César, cap. 56: descreve o deslocamento de três letras (D no lugar de A) usado por César em cartas confidenciais. Texto em tradução inglesa.',
        links: [['Acessar o texto (LacusCurtius, Universidade de Chicago)', 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Suetonius/12Caesars/Julius%2A.html']],
      },
    ],
    rotuloArtigos: '**Fonte histórica.** Não há artigo original do autor da cifra afim; o registro mais antigo do César é o relato de Suetônio.',
    titulo: 'Diagramas das cifras de César e afim',
    intro:
      'Os diagramas abaixo mostram as cifras antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal e, quando indicado, altera a cifra ou testa as chaves. As letras são numeradas de 0 (A) a 25 (Z). **P** é uma letra do texto claro, **C** a letra cifrada, **a** e **b** os parâmetros da chave. O último diagrama é um fluxograma da função de cifragem.',
    diagramas: [
      {
        titulo: 'César e a busca por força bruta',
        ref: 'deslocamento de b letras',
        descricao:
          'Alice e Bob combinam o deslocamento b. Alice desloca cada letra do texto claro b posições no alfabeto (C = P + b, módulo 26) e Bob desloca de volta (P = C - b). Com apenas 26 chaves, Eva não precisa conhecer b: ela decifra a cifra interceptada com cada deslocamento possível e escolhe o resultado que se parece com o português, o que ela confirma pelo teste χ² (qui-quadrado) da distribuição de letras.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Deslocamento b<br/>combinado antes
    A->>A: C = (P + b) mod 26
    A->>E: Texto cifrado pelo canal
    Note over E: Eva intercepta<br/>o texto cifrado
    loop Para cada b' de 0 a 25
        E->>E: Decifra com b'
        E->>E: Mede a distância às<br/>frequências do português
    end
    Note over E: O menor valor de χ²<br/>indica a chave b
    E->>B: Texto cifrado segue a Bob
    B->>B: P = (C - b) mod 26`,
      },
      {
        titulo: 'Cifra afim e a alteração do texto cifrado',
        ref: 'C = a·P + b mod 26',
        descricao:
          'Na cifra afim, a chave é o par (a, b). Para que Bob consiga decifrar, a deve ser coprimo de 26 (12 valores possíveis), o que dá 12 × 26 = 312 chaves. Alice calcula C = a·P + b módulo 26 e Bob usa o inverso multiplicativo de a: P = a⁻¹·(C - b) módulo 26. A cifra não autentica: Eva troca letras do texto cifrado e Bob as decifra sem perceber, obtendo letras diferentes das enviadas. Continua válida a força bruta, agora sobre 312 chaves.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Chave (a, b), com a<br/>coprimo de 26
    A->>A: C = (a·P + b) mod 26
    A->>E: Texto cifrado pelo canal
    Note over E: Eva troca letras<br/>do texto cifrado
    E->>B: Texto cifrado alterado
    B->>B: Calcula o inverso de a
    B->>B: P' = a⁻¹·(C' - b) mod 26
    Note over B: Bob obtém letras<br/>diferentes das enviadas<br/>e não percebe`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Estrutura interna: função de cifragem e de decifragem',
        ref: 'fluxograma',
        descricao:
          'A letra é convertida em um número de 0 a 25, passa pela função afim e volta a ser letra. O César é o caso particular a = 1. Para decifrar, o inverso multiplicativo de a módulo 26 é encontrado (existe apenas quando a é coprimo de 26) e a função inversa é aplicada.',
        mermaid: `flowchart TD
    L["Letra do texto claro"] --> N["Converte para número x, de 0 a 25"]
    N --> F["y = a·x + b, módulo 26"]
    F --> M["Converte y em letra"]
    M --> C["Letra do texto cifrado"]
    CH["Chave: a coprimo de 26 e b de 0 a 25"] --> F
    CH --> INV["Calcula o inverso a⁻¹ módulo 26"]
    C --> D["Converte a letra cifrada em número y"]
    D --> G["x = a⁻¹·(y - b), módulo 26"]
    INV --> G
    G --> R["Letra do texto claro recuperada"]`,
      },
    ],
  },

  'substituicao-frequencia': {
    artigos: [
      {
        citacao: 'Al-Kindi (Abu Yusuf Yaqub ibn Ishaq al-Kindi). *Risalah fi istikhraj al-mu\'amma* (Manuscrito sobre a decifração de mensagens criptográficas), século IX: a descrição mais antiga conhecida da análise de frequências. Edição moderna: Mrayati, M.; Meer Alam, Y.; at-Tayyan, M. H. (org.), Damasco, 1987.',
        links: [['Leitura complementar: Simon Singh, "Arab Code Breakers"', 'https://simonsingh.net/media/articles/maths-and-science/arab-code-breakers']],
      },
    ],
    rotuloArtigos: '**Fonte histórica.** O manuscrito original não tem cópia pública conferida; o link abaixo é uma leitura complementar sobre ele.',
    titulo: 'Diagramas da substituição simples e da análise de frequências',
    intro:
      'Os diagramas abaixo mostram a cifra e o ataque antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal. A **chave** é uma permutação das 26 letras do alfabeto. O último diagrama é um fluxograma das etapas da criptoanálise.',
    diagramas: [
      {
        titulo: 'Substituição simples e as estatísticas que a revelam',
        ref: '26! chaves',
        descricao:
          'Alice e Bob compartilham uma permutação do alfabeto: cada letra clara vira sempre a mesma letra cifrada. Há cerca de 4,0 × 10²⁶ chaves, o que torna inviável a força bruta. Mas a substituição preserva a distribuição das letras: a letra mais frequente na cifra corresponde, com boa probabilidade, à mais frequente do português (A, E ou O). Eva conta as letras, também o índice de coincidência (que continua alto, característico de uma língua natural) e os pares de letras.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Chave: permutação<br/>das 26 letras
    A->>A: Substitui cada letra<br/>pela letra da permutação
    A->>E: Texto cifrado pelo canal
    Note over E: Eva intercepta<br/>o texto cifrado
    E->>E: Conta a frequência de cada letra
    E->>E: Calcula o índice de coincidência
    Note over E: Índice alto indica<br/>substituição simples
    E->>B: Texto cifrado segue a Bob
    B->>B: Aplica a permutação inversa`,
      },
      {
        titulo: 'Eva reconstrói a chave por etapas',
        ref: 'frequências e bigramas',
        descricao:
          'Eva associa as letras mais frequentes da cifra às mais frequentes do português e testa a hipótese pelos bigramas (pares de letras adjacentes), que também mantêm sua distribuição. Cada hipótese confirmada fixa uma letra da chave e deixa legíveis trechos do texto, o que revela as demais. Repete até obter um texto sem erros. Não há busca sobre as 26! chaves: a estrutura da língua reduz o problema a poucas tentativas.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    A->>E: Texto cifrado pelo canal
    E->>E: Associa as letras mais<br/>frequentes às do português
    E->>E: Confere os bigramas<br/>mais comuns
    loop Até o texto ficar legível
        E->>E: Fixa uma letra da chave
        E->>E: Lê trechos do texto<br/>e corrige as hipóteses
    end
    Note over E: Eva obtém a chave<br/>completa e lê o texto
    E->>B: Texto cifrado segue a Bob
    B->>B: Decifra com a chave de Alice`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Estrutura interna: etapas da criptoanálise por frequência',
        ref: 'fluxograma',
        descricao:
          'O fluxograma resume o método de Eva: medir, classificar a cifra, propor associações e refinar até o texto fazer sentido. O índice de coincidência separa substituição simples (valor próximo ao do idioma) de cifras que achatam as frequências (valor próximo ao de um texto aleatório).',
        mermaid: `flowchart TD
    T["Texto cifrado interceptado"] --> F["Conta a frequência de cada letra"]
    F --> IC["Calcula o índice de coincidência"]
    IC --> Q{"Valor próximo ao do idioma?"}
    Q -->|"não"| O["Não é substituição simples: tenta outro ataque"]
    Q -->|"sim"| A["Associa as letras mais frequentes às do idioma"]
    A --> B["Confere os bigramas e as palavras curtas"]
    B --> L{"Texto legível?"}
    L -->|"não"| R["Corrige as associações"]
    R --> B
    L -->|"sim"| K["Chave recuperada"]`,
      },
    ],
  },

  vigenere: {
    artigos: [
      {
        citacao: 'Vigenère, B. de. *Traicté des chiffres, ou secretes manieres d\'escrire*. Paris: Abel L\'Angelier, 1586.',
        links: [['Registro bibliográfico (Universidade de Liège)', 'https://hdl.handle.net/2268.1/9711']],
      },
      {
        citacao: 'Kasiski, F. W. *Die Geheimschriften und die Dechiffrir-Kunst*. Berlim: E. S. Mittler und Sohn, 1863.',
        links: [['Acessar o livro (Google Livros)', 'https://books.google.com/books?id=fB5dAAAAcAAJ']],
      },
      {
        citacao: 'Friedman, W. F. *The Index of Coincidence and Its Applications in Cryptography*. Geneva, Illinois: Riverbank Laboratories, Publicação n. 22, 1922.',
        links: [],
      },
    ],
    titulo: 'Diagramas do Vigenère e do ataque de Kasiski',
    intro:
      'Os diagramas abaixo mostram a cifra e o ataque antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal. A **chave** é uma palavra de n letras que se repete ao longo do texto. O último diagrama é um fluxograma do ataque.',
    diagramas: [
      {
        titulo: 'Cifragem de Vigenère com uma palavra-chave',
        ref: 'César variável',
        descricao:
          'Alice e Bob combinam uma palavra-chave. A i-ésima letra do texto claro é deslocada pela letra da chave na posição i módulo n, de modo que a mesma letra clara vira letras cifradas diferentes e as frequências ficam achatadas. Bob desfaz o deslocamento com a mesma chave. Como a chave se repete, a cifra é, em cada coluna, um César, e é essa regularidade que Eva explora.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Palavra-chave de n<br/>letras combinada antes
    A->>A: Ci = (Pi + K(i mod n)) mod 26
    A->>E: Texto cifrado pelo canal
    Note over E: Eva intercepta<br/>o texto cifrado
    E->>B: Texto cifrado segue a Bob
    B->>B: Pi = (Ci - K(i mod n)) mod 26`,
      },
      {
        titulo: 'Eva descobre o tamanho da chave e resolve cada coluna',
        ref: 'Kasiski e índice de coincidência',
        descricao:
          'Trechos repetidos no texto claro que caem na mesma posição da chave produzem trechos repetidos na cifra: a distância entre eles é múltiplo do tamanho da chave (teste de Kasiski). Eva confirma o tamanho pelo índice de coincidência calculado para cada tamanho candidato, que sobe ao valor do idioma quando o candidato é correto. Conhecido o tamanho n, ela separa o texto em n colunas, cada uma cifrada por um César, e resolve cada coluna por análise de frequências.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    A->>E: Texto cifrado pelo canal
    E->>E: Procura trechos repetidos<br/>e mede as distâncias
    Note over E: O tamanho da chave<br/>divide as distâncias
    loop Para cada tamanho n candidato
        E->>E: Separa em n colunas<br/>e calcula o índice<br/>de coincidência
    end
    E->>E: Resolve cada coluna<br/>como um César
    Note over E: Eva obtém a palavra-chave<br/>e lê o texto
    E->>B: Texto cifrado segue a Bob`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Estrutura interna: do tamanho da chave à palavra-chave',
        ref: 'fluxograma',
        descricao:
          'O ataque tem duas fases: descobrir o tamanho da chave (Kasiski e índice de coincidência) e, com o tamanho conhecido, quebrar cada coluna como um César, o que recai na análise de frequências ou no teste χ² das 26 letras possíveis para cada posição da chave.',
        mermaid: `flowchart TD
    T["Texto cifrado"] --> K["Kasiski: distâncias entre trechos repetidos"]
    K --> C["Candidatos a tamanho: divisores comuns"]
    C --> IC["Índice de coincidência por tamanho candidato"]
    IC --> N["Escolhe o tamanho n da chave"]
    N --> S["Separa o texto em n colunas"]
    S --> Q["Para cada coluna: testa as 26 letras de chave com χ²"]
    Q --> W["Junta as n letras: palavra-chave"]
    W --> D["Decifra o texto inteiro"]`,
      },
    ],
  },

  'playfair-hill': {
    artigos: [
      {
        citacao: 'Hill, L. S. *Cryptography in an algebraic alphabet*. The American Mathematical Monthly, v. 36, n. 6, p. 306-312, 1929.',
        links: [['DOI 10.1080/00029890.1929.11986963', 'https://doi.org/10.1080/00029890.1929.11986963']],
      },
      {
        citacao: 'Hill, L. S. *Concerning certain linear transformation apparatus of cryptography*. The American Mathematical Monthly, v. 38, n. 3, p. 135-154, 1931.',
        links: [['DOI 10.1080/00029890.1931.11987161', 'https://doi.org/10.1080/00029890.1931.11987161']],
      },
    ],
    rotuloArtigos: '**Artigos originais do Hill.** O Playfair, popularizado por Lord Playfair a partir de uma invenção de Charles Wheatstone (1854), não tem artigo original com cópia pública conferida.',
    titulo: 'Diagramas do Playfair e do Hill',
    intro:
      'Os diagramas abaixo mostram as cifras antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal e, quando indicado, ataca a cifra. O último diagrama é um fluxograma das regras de cifragem de um par de letras no Playfair.',
    diagramas: [
      {
        titulo: 'Playfair: grade 5 por 5 e cifragem de digrafos',
        ref: 'cifragem de pares de letras',
        descricao:
          'Alice e Bob montam a mesma grade 5 × 5 a partir de uma palavra-chave (I e J compartilham a célula). Alice divide o texto em pares de letras, separando letras iguais com um preenchimento, e cifra cada par conforme a posição na grade. Bob usa as regras inversas. Como cifra pares, o Playfair oculta as frequências de letras isoladas, mas preserva as de digrafos, o que Eva explora com bem mais texto.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Palavra-chave monta<br/>a grade 5 por 5
    A->>A: Divide o texto em pares<br/>de letras
    A->>A: Cifra cada par pelas<br/>regras da grade
    A->>E: Texto cifrado pelo canal
    Note over E: Eva intercepta<br/>o texto cifrado
    E->>B: Texto cifrado segue a Bob
    B->>B: Aplica as regras inversas<br/>a cada par`,
      },
      {
        titulo: 'Hill: a linearidade e o ataque de texto claro conhecido',
        ref: 'C = K·P mod 26',
        descricao:
          'No Hill, blocos de n letras viram vetores e são multiplicados por uma matriz-chave K, n por n, invertível módulo 26: C = K·P. Bob usa K⁻¹. Por ser linear, a cifra cai diante de um ataque de texto claro conhecido: se Eva conhece n blocos de texto claro com as cifras correspondentes, monta a matriz P dos claros e a matriz C das cifras, e resolve K = C·P⁻¹ módulo 26. Com a chave, lê todo o tráfego.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Matriz K n por n,<br/>invertível mod 26
    A->>A: C = K·P mod 26<br/>para cada bloco
    A->>E: Texto cifrado pelo canal
    Note over E: Eva conhece n blocos<br/>de texto claro
    E->>E: Monta as matrizes P e C
    E->>E: Resolve K = C·P⁻¹ mod 26
    E->>B: Texto cifrado segue a Bob
    B->>B: P = K⁻¹·C mod 26
    Note over E: Com K, Eva decifra<br/>todo o tráfego`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Estrutura interna: regras do Playfair para um par de letras',
        ref: 'fluxograma',
        descricao:
          'Cada par é cifrado conforme as posições das duas letras na grade: na mesma linha, cada letra é substituída pela da direita; na mesma coluna, pela de baixo (com retorno ao início); nos demais casos, formam-se os vértices de um retângulo e cada letra é trocada pela da mesma linha e da coluna da outra. Para decifrar, os deslocamentos são para a esquerda e para cima.',
        mermaid: `flowchart TD
    P["Par de letras X e Y"] --> I{"X e Y são iguais?"}
    I -->|"sim"| PAD["Insere uma letra de preenchimento"]
    PAD --> P
    I -->|"não"| L{"Mesma linha da grade?"}
    L -->|"sim"| R["Cada letra vira a da direita"]
    L -->|"não"| C{"Mesma coluna da grade?"}
    C -->|"sim"| D["Cada letra vira a de baixo"]
    C -->|"não"| RET["Retângulo: cada letra vira a da própria linha e da coluna da outra"]
    R --> O["Par cifrado"]
    D --> O
    RET --> O`,
      },
    ],
  },

  transposicao: {
    artigos: [SHANNON],
    rotuloArtigos: '**Artigo original.** A ideia de combinar substituição e transposição (confusão e difusão), base da cifra produto, vem de Shannon.',
    titulo: 'Diagramas da transposição e da cifra produto',
    intro:
      'Os diagramas abaixo mostram as cifras antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal e tenta reordenar o texto. Na transposição as letras não mudam, apenas de posição. O último diagrama é um fluxograma da transposição colunar.',
    diagramas: [
      {
        titulo: 'Transposição e a anagramação feita pela Eva',
        ref: 'cerca de trilhos e transposição colunar',
        descricao:
          'Alice reordena as letras do texto: nos trilhos, escreve em zigue-zague e lê trilho a trilho; na transposição colunar, escreve em linhas sob uma palavra-chave e lê as colunas na ordem alfabética das letras da chave. As letras permanecem as mesmas, então a frequência continua a do português e Eva reconhece que se trata de uma transposição. Ela testa as ordens possíveis das colunas e escolhe a que produz o texto mais legível. Bob desfaz a reordenação com a chave.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Número de trilhos ou<br/>palavra-chave combinados
    A->>A: Reordena as letras<br/>do texto
    A->>E: Texto cifrado pelo canal
    Note over E: A frequência das letras<br/>é a do português
    E->>E: Reconhece uma transposição
    loop Para cada ordem candidata
        E->>E: Reordena e mede<br/>a legibilidade
    end
    Note over E: A ordem mais legível<br/>revela a chave
    E->>B: Texto cifrado segue a Bob
    B->>B: Desfaz a reordenação`,
      },
      {
        titulo: 'Cifra produto: substituição seguida de transposição',
        ref: 'confusão e difusão',
        descricao:
          'Alice aplica primeiro uma substituição, que esconde a relação entre letra clara e letra cifrada (confusão), e depois uma transposição, que espalha a posição das letras (difusão). Eva, que sozinha quebraria cada etapa, enfrenta as duas ao mesmo tempo: a frequência das letras já não se parece com a do idioma e a ordem também foi embaralhada. Bob desfaz as etapas em ordem inversa. A repetição desse par de operações é a ideia por trás das cifras modernas, como o DES e o AES.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Chave de substituição<br/>e chave de transposição
    A->>A: Substitui as letras<br/>(confusão)
    A->>A: Reordena as letras<br/>(difusão)
    A->>E: Texto cifrado pelo canal
    Note over E: Frequências alteradas<br/>e ordem embaralhada
    E->>B: Texto cifrado segue a Bob
    B->>B: Desfaz a transposição
    B->>B: Desfaz a substituição`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Estrutura interna: transposição colunar com palavra-chave',
        ref: 'fluxograma',
        descricao:
          'O texto é escrito em linhas, em uma grade com tantas colunas quanto letras da palavra-chave. As colunas são numeradas pela ordem alfabética das letras da chave e lidas nessa ordem para formar o texto cifrado. Para decifrar, Bob calcula o tamanho de cada coluna, preenche as colunas na ordem da chave e lê a grade por linhas.',
        mermaid: `flowchart TD
    T["Texto claro"] --> G["Escreve em linhas, com tantas colunas quantas as letras da chave"]
    K["Palavra-chave"] --> O["Numera as colunas pela ordem alfabética da chave"]
    G --> RD["Lê as colunas na ordem numerada"]
    O --> RD
    RD --> C["Texto cifrado"]
    C --> BD["Bob separa o texto em colunas pela mesma ordem"]
    BD --> BL["Lê a grade por linhas"]
    BL --> P["Texto claro recuperado"]`,
      },
    ],
  },

  enigma: {
    artigos: [REJEWSKI, TURING],
    rotuloArtigos: '**Artigos originais e documento histórico.**',
    titulo: 'Diagramas da Enigma e do ataque por texto provável',
    intro:
      'Os diagramas abaixo mostram a Enigma I antes dos cenários executados da seção 5. Alice cifra, Bob decifra com uma máquina na mesma configuração e Eva observa o canal. A **configuração** reúne a ordem dos três rotores, a posição inicial de cada um e as ligações do painel de plugues. O último diagrama é um fluxograma do caminho do sinal elétrico.',
    diagramas: [
      {
        titulo: 'Cifragem tecla a tecla e reciprocidade',
        ref: 'a máquina é recíproca',
        descricao:
          'Alice e Bob ajustam suas máquinas com a mesma configuração. A cada tecla pressionada o rotor da direita avança antes de o sinal passar, de modo que a substituição muda a cada letra. Por causa do refletor, que devolve o sinal por outro caminho, a máquina é recíproca: se com uma posição o sinal A vira L, nessa mesma posição L vira A. Assim, Bob decifra digitando a cifra em sua máquina, ajustada igual. Uma consequência do refletor é que nenhuma letra é cifrada nela mesma.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Mesma configuração:<br/>rotores, posições e plugues
    A->>A: Cada tecla avança os rotores<br/>e acende a letra cifrada
    A->>E: Mensagem cifrada pelo rádio
    Note over E: Eva intercepta<br/>a mensagem cifrada
    E->>B: Mensagem cifrada segue a Bob
    B->>B: Digita a cifra na máquina<br/>ajustada igual
    Note over B: A reciprocidade devolve<br/>o texto claro`,
      },
      {
        titulo: 'Eva usa um texto provável para descartar posições',
        ref: 'a letra nunca vira ela mesma',
        descricao:
          'Eva supõe que a mensagem contém um trecho conhecido (um texto provável, ou *crib*, como um cabeçalho padronizado) e o alinha com a cifra em cada posição possível. Se, em algum alinhamento, uma letra do trecho coincidir com a letra cifrada na mesma posição, esse alinhamento é impossível, pois a Enigma nunca cifra uma letra nela mesma. Os alinhamentos que sobram são os candidatos, e a posição correta do texto provável serve de entrada para o ataque da Bombe.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    A->>E: Mensagem cifrada pelo rádio
    Note over E: Eva supõe um trecho<br/>conhecido (crib)
    loop Para cada alinhamento do crib
        E->>E: Alguma letra coincide<br/>com a cifra?
        E->>E: Se sim, descarta<br/>o alinhamento
    end
    Note over E: Os alinhamentos restantes<br/>são os candidatos
    E->>B: Mensagem cifrada segue a Bob`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Estrutura interna: caminho do sinal na Enigma I',
        ref: 'fluxograma',
        descricao:
          'Ao pressionar uma tecla, o rotor da direita avança (e, em posições determinadas, também o do meio e o da esquerda) e o circuito se fecha. O sinal atravessa o painel de plugues, os três rotores da direita para a esquerda, chega ao refletor, volta pelos três rotores da esquerda para a direita, passa de novo pelo painel de plugues e acende a lâmpada da letra cifrada. O refletor liga as letras em pares, o que torna a máquina recíproca.',
        mermaid: `flowchart TD
    TK["Tecla pressionada"] --> AV["Os rotores avançam antes de o circuito fechar"]
    AV --> PL1["Painel de plugues"]
    PL1 --> RD["Rotor da direita"]
    RD --> RM["Rotor do meio"]
    RM --> RE["Rotor da esquerda"]
    RE --> REF["Refletor: liga as letras em pares"]
    REF --> RE2["Rotor da esquerda, em sentido inverso"]
    RE2 --> RM2["Rotor do meio, em sentido inverso"]
    RM2 --> RD2["Rotor da direita, em sentido inverso"]
    RD2 --> PL2["Painel de plugues"]
    PL2 --> LM["Lâmpada da letra cifrada"]`,
      },
    ],
  },

  'enigma-bombe': {
    artigos: [TURING, REJEWSKI],
    rotuloArtigos: '**Documento histórico e artigo original.**',
    titulo: 'Diagramas da Bombe',
    intro:
      'Os diagramas abaixo mostram a Bombe antes dos cenários executados da seção 5. Alice cifra com a Enigma, Bob decifra e Eva observa o canal e tenta recuperar a posição dos rotores. A **Bombe** é a máquina eletromecânica que testa, para um texto provável, todas as posições iniciais dos rotores. O último diagrama é um fluxograma do procedimento.',
    diagramas: [
      {
        titulo: 'Do texto provável ao menu',
        ref: 'menu da Bombe',
        descricao:
          'Eva alinha um texto provável (crib) com a cifra, em uma posição que a regra da letra que nunca vira ela mesma não descartou. Cada par de letras (claro, cifra) em uma posição da mensagem é uma ligação entre duas letras do alfabeto, associada ao avanço dos rotores naquele ponto. O conjunto dessas ligações é o menu, um grafo cujos laços, quando existem, são o que permite à Bombe encontrar contradições. Menus com mais laços eliminam mais posições falsas.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    A->>E: Mensagem cifrada pelo rádio
    Note over E: Eva supõe um trecho<br/>conhecido (crib)
    E->>E: Alinha o crib com a cifra
    E->>E: Descarta alinhamentos em<br/>que uma letra se cifra<br/>nela mesma
    E->>E: Liga a letra clara à letra<br/>cifrada em cada posição
    Note over E: As ligações formam<br/>o menu, com laços
    E->>B: Mensagem cifrada segue a Bob`,
      },
      {
        titulo: 'Propagação, contradição e paradas',
        ref: 'teste das 17.576 posições',
        descricao:
          'Para cada uma das 17.576 posições iniciais dos rotores, a Bombe adota uma hipótese sobre o plugue de uma letra de teste e a propaga pelas ligações do menu. Se em algum ponto a hipótese gera uma contradição (a mesma letra ligada a duas letras diferentes), a posição é eliminada. As posições em que não há contradição são paradas: elas são verificadas por Eva, e as paradas falsas são descartadas pelos laços do menu. A posição que resiste revela a configuração dos rotores e, com ela, Eva decifra a mensagem.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    A->>E: Mensagem cifrada pelo rádio
    loop Para cada posição inicial dos rotores
        E->>E: Supõe o plugue de<br/>uma letra de teste
        E->>E: Propaga pelos laços<br/>do menu
        E->>E: Há contradição?<br/>Se sim, elimina a posição
    end
    Note over E: As posições sem contradição<br/>são as paradas
    E->>E: Verifica as paradas<br/>e descarta as falsas
    Note over E: A posição restante revela<br/>a configuração dos rotores
    E->>B: Mensagem cifrada segue a Bob`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Estrutura interna: o procedimento da Bombe',
        ref: 'fluxograma',
        descricao:
          'O procedimento começa pelo texto provável e pelo menu, percorre as posições dos rotores e, em cada uma, propaga a hipótese do plugue pelo menu até encontrar uma contradição ou esgotar os laços. As paradas passam por uma verificação final: a configuração candidata decifra a mensagem e o resultado é conferido com o texto esperado.',
        mermaid: `flowchart TD
    CR["Texto provável alinhado com a cifra"] --> MN["Monta o menu de ligações entre letras"]
    MN --> PO["Escolhe uma posição inicial dos rotores"]
    PO --> HP["Hipótese de plugue para a letra de teste"]
    HP --> PR["Propaga a hipótese pelos laços do menu"]
    PR --> CT{"Contradição?"}
    CT -->|"sim"| EL["Elimina a posição"]
    EL --> PX{"Há outra posição?"}
    CT -->|"não"| PA["Parada: posição candidata"]
    PA --> VF["Verifica a parada: decifra e confere com o texto esperado"]
    VF --> OK{"Confere?"}
    OK -->|"sim"| FIM["Configuração dos rotores encontrada"]
    OK -->|"não"| PX
    PX -->|"sim"| PO`,
      },
    ],
  },
};
