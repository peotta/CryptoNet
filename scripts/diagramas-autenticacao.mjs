// Item 2.1 da Fundamentação dos laboratórios da categoria Autenticação (HOTP e TOTP).
// Mesmo formato de scripts/diagramas-fase3.mjs: diagramas de sequência (Alice, Bob e Eva) e um fluxograma (tipo: 'fluxograma').
// Os links foram conferidos em 2026-11-07: as RFCs no rfc-editor.org (sem substituição ou atualização) e o DOI de Lamport
// confrontado com o Crossref (título, volume, número e páginas).

export const FUNDAMENTACAO_AUTENTICACAO = {
  'totp-hotp': {
    artigos: [
      {
        citacao: "M'Raihi, D.; Bellare, M.; Hoornaert, F.; Naccache, D.; Ranen, O. *HOTP: An HMAC-Based One-Time Password Algorithm*. [RFC 4226](https://www.rfc-editor.org/rfc/rfc4226), dez. 2005.",
        links: [],
      },
      {
        citacao: "M'Raihi, D.; Machani, S.; Pei, M.; Rydell, J. *TOTP: Time-Based One-Time Password Algorithm*. [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238), maio 2011.",
        links: [],
      },
      {
        citacao: 'Lamport, L. *Password authentication with insecure communication*. Communications of the ACM, v. 24, n. 11, p. 770-772, nov. 1981, origem da ideia de senhas de uso único derivadas por função unidirecional.',
        links: [['DOI 10.1145/358790.358797', 'https://doi.org/10.1145/358790.358797']],
      },
    ],
    rotuloArtigos: '**Especificações e artigo de origem.**',
    titulo: 'Diagramas do HOTP e do TOTP',
    intro:
      'Os diagramas abaixo mostram o HOTP e o TOTP antes dos cenários executados da seção 5. Alice é a usuária, com um aplicativo autenticador, Bob é o servidor e Eva observa o canal e age na rede. **K** é o segredo compartilhado, **C** o contador de 8 bytes e **T** o horário Unix. O último diagrama é um fluxograma do cálculo do código.',
    diagramas: [
      {
        titulo: 'Cadastro do segredo e acesso com o código',
        ref: 'RFC 4226 e RFC 6238',
        descricao:
          'No cadastro, Bob gera o segredo K e o entrega a Alice por um canal separado, em geral um QR code com K em Base32; Eva não participa dessa etapa. A cada acesso, o aplicativo de Alice calcula o contador (no TOTP, C = ⌊T / 30⌋), o HMAC de C com K e o código de 6 dígitos, e Alice o digita junto da senha. Bob repete o cálculo para o contador atual e os vizinhos e compara. Eva lê o código no canal, mas ele não revela K, pois sair do HMAC para o segredo exige inverter a função.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    B->>A: Segredo K em Base32, por QR code
    Note over A,B: K guardado nos dois lados<br/>e fora do alcance de Eva
    A->>A: C = piso(T / 30)
    A->>A: H = HMAC(K, C)
    A->>A: Código = truncamento de H, 6 dígitos
    A->>B: Usuário, senha e código
    Note over E: Eva lê o código<br/>no canal
    B->>B: Calcula o código para<br/>C - 1, C e C + 1
    B->>B: Compara com o recebido
    B->>A: Acesso concedido`,
      },
      {
        titulo: 'O que Eva consegue com o código capturado',
        ref: 'RFC 6238, seção 5.2',
        descricao:
          'O código vale só para um contador. Se Eva o apresenta depois da janela (mais de um passo de diferença), Bob o recusa. Dentro da janela, Eva o repete e Bob o aceita de novo, a menos que tenha guardado o último contador aceito: a RFC 6238 exige que o verificador não aceite uma segunda tentativa de um código já validado. O ataque que o TOTP não impede é o de retransmissão em tempo real: Alice digita o código em um site falso de Eva, e Eva o repassa na hora ao servidor verdadeiro, porque o código não está vinculado ao site em que é digitado.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    A->>B: Código do contador C
    B->>B: Aceita e guarda<br/>o contador C
    Note over E: Eva captura o código
    E->>B: Código, 90 s depois
    B->>E: Recusa: fora da janela
    E->>B: Código, 5 s depois
    B->>E: Recusa: contador C já aceito
    Note over A,E: Phishing em tempo real
    A->>E: Código digitado em site falso
    E->>B: Código retransmitido na hora
    B->>E: Aceita: o código não prova<br/>em qual site foi digitado`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Estrutura interna: do contador ao código de 6 dígitos',
        ref: 'fluxograma',
        descricao:
          'O contador de 64 bits é autenticado com o segredo (HMAC-SHA-1 no padrão, com 20 bytes de saída). O truncamento dinâmico usa os 4 bits menos significativos do último byte como deslocamento, copia 4 bytes a partir dali e apaga o bit mais significativo (máscara 0x7FFFFFFF), o que evita ambiguidade de sinal. O resto da divisão por 10^6 dá o código. No HOTP o contador é o número de códigos gerados; no TOTP é o tempo dividido pelo passo de 30 segundos.',
        mermaid: `flowchart TD
    M{"Variante"} -->|"HOTP"| CE["C = contador de eventos"]
    M -->|"TOTP"| CT["C = piso de T dividido por 30"]
    CE --> CB["C em 8 bytes, big-endian"]
    CT --> CB
    K["Segredo K"] --> H["H = HMAC de C com K, 20 bytes no SHA-1"]
    CB --> H
    H --> O["Deslocamento = 4 bits menos significativos do último byte"]
    O --> Q["Copia 4 bytes a partir do deslocamento"]
    Q --> MK["Apaga o bit mais significativo: máscara 0x7FFFFFFF"]
    MK --> R["Código = inteiro mod 10^6, com zeros à esquerda"]`,
      },
    ],
  },
  kerberos: {
    artigos: [
      {
        citacao: 'Neuman, C.; Yu, T.; Hartman, S.; Raeburn, K. *The Kerberos Network Authentication Service (V5)*. [RFC 4120](https://www.rfc-editor.org/rfc/rfc4120), jul. 2005 (atualizada por outras RFCs, entre elas a RFC 8429).',
        links: [],
      },
      {
        citacao: 'Needham, R. M.; Schroeder, M. D. *Using encryption for authentication in large networks of computers*. Communications of the ACM, v. 21, n. 12, p. 993-999, dez. 1978, base do uso de um servidor de chaves de confiança.',
        links: [['DOI 10.1145/359657.359659', 'https://doi.org/10.1145/359657.359659']],
      },
      {
        citacao: 'Denning, D. E.; Sacco, G. M. *Timestamps in key distribution protocols*. Communications of the ACM, v. 24, n. 8, p. 533-536, ago. 1981, origem do uso de carimbos de tempo, adotado pelo Kerberos no lugar dos nonces nas mensagens com o serviço.',
        links: [['DOI 10.1145/358722.358740', 'https://doi.org/10.1145/358722.358740']],
      },
      {
        citacao: 'Hartman, S.; Zhu, L. *A Generalized Framework for Kerberos Pre-Authentication*. [RFC 6113](https://www.rfc-editor.org/rfc/rfc6113), abr. 2011, que define o FAST, a proteção do pedido inicial.',
        links: [],
      },
    ],
    rotuloArtigos: '**Especificação e artigos de origem.**',
    titulo: 'Diagramas do Kerberos',
    intro:
      'Os diagramas abaixo mostram o Kerberos antes dos cenários executados da seção 5. Alice é a cliente, o KDC reúne o serviço de autenticação (AS) e o de concessão de tíquetes (TGS), Bob é o serviço e Eva observa o canal e age na rede. **K_c** é a chave derivada da senha de Alice, **K_AT** e **K_AB** são chaves de sessão e **K_b** é a chave de Bob. O último diagrama é um fluxograma da validação feita pelo serviço.',
    diagramas: [
      {
        titulo: 'As três trocas: AS, TGS e AP',
        ref: 'RFC 4120, seções 3.1 a 3.2',
        descricao:
          'Na troca AS, o KDC entrega a Alice a chave de sessão K_AT cifrada com K_c e o tíquete de concessão de tíquetes (TGT), selado com a chave do TGS, que Alice não consegue ler. Na troca TGS, Alice apresenta o TGT e um autenticador e recebe a chave K_AB e o tíquete de Bob, selado com K_b. Na troca AP, Alice apresenta a Bob o tíquete e um autenticador; Bob o valida sem consultar o KDC e prova quem é devolvendo o horário cifrado com K_AB. Eva vê todas as mensagens, mas só texto cifrado.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant K as KDC
    participant B as Bob
    participant E as Eva
    A->>K: AS-REQ: alice, krbtgt, N1
    K->>A: AS-REP: TGT e {K_AT, N1}K_c
    Note over E: Eva vê tudo,<br/>mas só texto cifrado
    A->>K: TGS-REQ: TGT, {alice, T}K_AT, bob, N2
    K->>A: TGS-REP: tíquete de Bob<br/>e {K_AB, N2}K_AT
    A->>B: AP-REQ: tíquete de Bob<br/>e {alice, T}K_AB
    B->>B: Abre o tíquete com K_b<br/>e o autenticador com K_AB
    B->>A: AP-REP: {T}K_AB`,
      },
      {
        titulo: 'O que Eva consegue fazer',
        ref: 'RFC 4120, seções 3.2.3 e 5.2.7.2; RFC 6113',
        descricao:
          'Dois ataques mostram os limites do protocolo. Na repetição, Eva reenvia o tíquete e o autenticador capturados: dentro da tolerância de relógio o carimbo de tempo ainda vale, e só o serviço que guarda os autenticadores já vistos recusa a repetição (KRB_AP_ERR_REPEAT). Na adivinhação de senha, Eva pede ao KDC uma resposta para Alice e testa senhas offline contra o texto cifrado com K_c; a pré-autenticação faz o KDC exigir antes uma prova de que o solicitante conhece K_c.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant K as KDC
    participant B as Bob
    participant E as Eva
    A->>B: AP-REQ com tíquete<br/>e autenticador
    Note over E: Eva captura o AP-REQ
    E->>B: AP-REQ repetido, 60 s depois
    B->>E: Sem registro: aceito<br/>Com registro: KRB_AP_ERR_REPEAT
    Note over E,K: Adivinhação de senha
    E->>K: AS-REQ em nome de Alice
    K->>E: Sem pré-autenticação: {K_AT, N1}K_c
    E->>E: Testa senhas offline<br/>até abrir a resposta
    K->>E: Com pré-autenticação:<br/>KDC_ERR_PREAUTH_REQUIRED`,
      },
      {
        tipo: 'fluxograma',
        titulo: 'Estrutura interna: validação do AP-REQ pelo serviço',
        ref: 'fluxograma',
        descricao:
          'O serviço abre o tíquete com a sua chave K_b, o que prova que o KDC o emitiu para ele, e dele tira a chave de sessão K_AB. Com K_AB abre o autenticador, confere que o nome coincide com o do tíquete, que o horário está dentro da tolerância de relógio e que o autenticador não foi visto antes. Só então aceita o cliente e, se for pedida a autenticação mútua, devolve o horário cifrado com K_AB.',
        mermaid: `flowchart TD
    R["AP-REQ: tíquete e autenticador"] --> T{"Tíquete abre com K_b?"}
    T -->|"Não"| X1["Recusa: tíquete inválido"]
    T -->|"Sim"| S["Extrai K_AB, o cliente e a validade"]
    S --> V{"Tíquete dentro da validade?"}
    V -->|"Não"| X2["Recusa: KRB_AP_ERR_TKT_EXPIRED"]
    V -->|"Sim"| A{"Autenticador abre com K_AB e o nome confere?"}
    A -->|"Não"| X3["Recusa: autenticador inválido"]
    A -->|"Sim"| C{"Horário dentro da tolerância de relógio?"}
    C -->|"Não"| X4["Recusa: KRB_AP_ERR_SKEW"]
    C -->|"Sim"| Q{"Autenticador já visto?"}
    Q -->|"Sim"| X5["Recusa: KRB_AP_ERR_REPEAT"]
    Q -->|"Não"| OK["Aceita e registra o autenticador"]
    OK --> M["AP-REP: horário cifrado com K_AB"]`,
      },
    ],
  },
};
