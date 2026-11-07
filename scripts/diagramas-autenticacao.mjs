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
};
