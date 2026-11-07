// Diagramas de sequência conceituais (item 2.1 da Fundamentação) de ECDH/ECDSA/Ed25519, TLS 1.3, ML-KEM,
// Hash/HMAC e AES, e artigos originais de Needham-Schroeder e DAP. Mesmo padrão de scripts/diagramas-fundamentacao.mjs.
// Os links dos artigos foram conferidos em 2026-11-07: os PDFs hospedados pelos autores respondem como application/pdf;
// os DOIs levam à página da editora, que bloqueia leitura automática, mas abre no navegador.

export const ARTIGOS_FUNDAMENTACAO = {
  'needham-schroeder': [
    {
      citacao: 'Needham, R. M.; Schroeder, M. D. *Using encryption for authentication in large networks of computers*. Communications of the ACM, v. 21, n. 12, p. 993-999, dez. 1978.',
      links: [
        ['Acessar o artigo (PDF, cópia hospedada na Universidade de Washington)', 'https://homes.cs.washington.edu/~arvind/cs422/doc/needham.pdf'],
        ['DOI 10.1145/359657.359659', 'https://doi.org/10.1145/359657.359659'],
      ],
    },
    {
      citacao: 'Lowe, G. *An attack on the Needham-Schroeder public-key authentication protocol*. Information Processing Letters, v. 56, n. 3, p. 131-133, nov. 1995.',
      links: [
        ['Página da publicação na Universidade de Oxford', 'https://www.cs.ox.ac.uk/publications/publication641-abstract.html'],
        ['DOI 10.1016/0020-0190(95)00144-2', 'https://doi.org/10.1016/0020-0190(95)00144-2'],
      ],
    },
    {
      citacao: 'Denning, D. E.; Sacco, G. M. *Timestamps in key distribution protocols*. Communications of the ACM, v. 24, n. 8, p. 533-536, ago. 1981.',
      links: [['DOI 10.1145/358722.358740', 'https://doi.org/10.1145/358722.358740']],
    },
  ],
  dap: [
    {
      citacao: 'Melo, L. P. de. *DAP (Dynamic Authorization Protocol): Uma Abordagem Segura Out-of-Band para E-Bank com um Segundo Fator de Autenticação Visual*. Tese (Doutorado em Engenharia Elétrica), Universidade de Brasília, 2012.',
      links: [['Acessar a tese (PDF, repositório da UnB)', 'https://repositorioantigo.bce.unb.br/bitstream/10482/12963/1/2012_LaertePeottadeMelo.pdf']],
    },
    {
      citacao: 'Melo, L. P. de; Amaral, D. M.; Albuquerque, R. de O.; Gondim, J. J. C.; Mendonça, F. L. L. de. *A Secure Approach Out-of-Band for e-Bank with Visual Two-Factor Authorization Protocol*. Cryptography, v. 8, n. 4, art. 51, 2024.',
      links: [
        ['Acessar o artigo (acesso aberto, MDPI)', 'https://www.mdpi.com/2410-387X/8/4/51'],
        ['DOI 10.3390/cryptography8040051', 'https://doi.org/10.3390/cryptography8040051'],
      ],
    },
  ],
};

export const FUNDAMENTACAO_FASE1 = {
  'ecdh-assinaturas': {
    artigos: [
      {
        citacao: 'Miller, V. S. *Use of elliptic curves in cryptography*. In: CRYPTO 1985, Lecture Notes in Computer Science, v. 218, p. 417-426. Springer, 1986.',
        links: [['DOI 10.1007/3-540-39799-X_31', 'https://doi.org/10.1007/3-540-39799-X_31']],
      },
      {
        citacao: 'Koblitz, N. *Elliptic curve cryptosystems*. Mathematics of Computation, v. 48, n. 177, p. 203-209, jan. 1987.',
        links: [['DOI 10.1090/S0025-5718-1987-0866109-5', 'https://doi.org/10.1090/S0025-5718-1987-0866109-5']],
      },
      {
        citacao: 'Bernstein, D. J. *Curve25519: new Diffie-Hellman speed records*. In: PKC 2006, Lecture Notes in Computer Science, v. 3958, p. 207-228. Springer, 2006.',
        links: [['Acessar o artigo (PDF, página do autor)', 'https://cr.yp.to/ecdh/curve25519-20060209.pdf']],
      },
      {
        citacao: 'Bernstein, D. J.; Duif, N.; Lange, T.; Schwabe, P.; Yang, B.-Y. *High-speed high-security signatures*. Journal of Cryptographic Engineering, v. 2, n. 2, p. 77-89, 2012.',
        links: [['Acessar o artigo (PDF, página do Ed25519)', 'https://ed25519.cr.yp.to/ed25519-20110926.pdf']],
      },
      {
        citacao: 'Johnson, D.; Menezes, A.; Vanstone, S. *The Elliptic Curve Digital Signature Algorithm (ECDSA)*. International Journal of Information Security, v. 1, n. 1, p. 36-63, 2001.',
        links: [['DOI 10.1007/s102070100002', 'https://doi.org/10.1007/s102070100002']],
      },
    ],
    titulo: 'Diagramas da geração de chaves, do acordo e das assinaturas em curvas elípticas',
    intro:
      'Os diagramas abaixo mostram o protocolo em si, antes dos cenários executados da seção 5. Alice e Bob são os participantes legítimos e Eva observa (ou, quando indicado, altera) o canal. Nas mensagens, **G** é o ponto gerador da curva, de ordem prima **n**; **d** é uma chave privada (um escalar) e **Q = d·G** a chave pública correspondente; **x(P)** é a coordenada x do ponto P. Recuperar d a partir de Q é o logaritmo discreto elíptico.',
    diagramas: [
      {
        titulo: 'Geração das chaves e acordo ECDH',
        ref: 'visão de Eva, observadora passiva',
        descricao:
          'Alice e Bob usam a mesma curva e o mesmo ponto G, públicos. Cada um sorteia uma chave privada (d_A e d_B) e calcula a chave pública multiplicando G pelo escalar (Q_A = d_A·G e Q_B = d_B·G). Trocam as chaves públicas pelo canal aberto e cada um multiplica a chave pública recebida pela sua chave privada: d_A·Q_B = d_A·d_B·G = d_B·Q_A. O ponto S é o mesmo nos dois lados e a sua coordenada x é o segredo compartilhado, que na prática passa por uma função de derivação antes de virar chave simétrica. Eva conhece a curva, G, Q_A e Q_B, mas obter d_A ou d_B exige resolver o logaritmo discreto elíptico.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Curva e ponto G públicos
    A->>A: Sorteia a chave privada d_A
    B->>B: Sorteia a chave privada d_B
    A->>A: Q_A = d_A · G
    B->>B: Q_B = d_B · G
    A->>B: Q_A
    B->>A: Q_B
    Note over E: Eva copia Q_A e Q_B, mas não<br/>conhece d_A nem d_B
    A->>A: S = d_A · Q_B
    B->>B: S = d_B · Q_A
    Note over A,B: Os dois obtêm o mesmo ponto<br/>S = d_A · d_B · G
    A->>A: Segredo = x(S), depois derivação
    B->>B: Segredo = x(S), depois derivação
    Note over E: Obter S exige resolver o<br/>logaritmo discreto elíptico`,
      },
      {
        titulo: 'Assinatura e verificação com ECDSA',
        ref: 'o nonce k deve ser secreto e único',
        descricao:
          'Alice tem o par (d, Q = d·G). Para assinar, calcula o hash h da mensagem, sorteia um nonce k, calcula o ponto R = k·G e toma r = x(R) mod n; depois s = k⁻¹·(h + r·d) mod n. A assinatura é o par (r, s). Bob recebe a mensagem e a assinatura, calcula w = s⁻¹, u1 = h·w e u2 = r·w, e então o ponto P = u1·G + u2·Q. A assinatura é válida se x(P) mod n for igual a r, pois P = k·G. Se Eva altera a mensagem, o hash muda e a verificação falha; sem d, ela não refaz (r, s).',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice (signatária)
    participant B as Bob (verificador)
    participant E as Eva
    A->>B: Chave pública Q
    A->>A: h = Hash(m)
    A->>A: Sorteia o nonce k
    A->>A: R = k · G e r = x(R) mod n
    A->>A: s = k⁻¹ · (h + r · d) mod n
    A->>E: m e a assinatura (r, s)
    alt Eva não altera
        E->>B: m e (r, s)
    else Eva altera a mensagem
        E->>B: m' e (r, s)
    end
    B->>B: h = Hash(mensagem recebida)
    B->>B: w = s⁻¹, u1 = h · w, u2 = r · w mod n
    B->>B: P = u1 · G + u2 · Q
    alt x(P) mod n é igual a r
        B->>B: Assinatura válida
    else x(P) mod n é diferente de r
        B->>B: Assinatura inválida
    end`,
      },
      {
        titulo: 'O ataque ao nonce reutilizado no ECDSA',
        ref: 'como a chave privada vaza',
        descricao:
          'Se Alice usa o mesmo nonce k em duas assinaturas, o valor r é o mesmo nas duas, e Eva, que vê as duas assinaturas e os hashes das mensagens, resolve duas equações lineares. Subtraindo s1 = k⁻¹·(h1 + r·d) e s2 = k⁻¹·(h2 + r·d), obtém k = (h1 - h2)·(s1 - s2)⁻¹ mod n e, com k, a chave privada: d = (s1·k - h1)·r⁻¹ mod n. É o erro de implementação que expôs a chave de assinatura do console PlayStation 3. O Ed25519 evita o problema derivando o nonce da chave e da mensagem.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice (signatária)
    participant B as Bob
    participant E as Eva
    A->>A: Assina m1 com o nonce k, obtendo (r, s1)
    A->>B: m1 e (r, s1)
    Note over E: Eva copia m1 e (r, s1)
    A->>A: Assina m2 com o MESMO nonce k, obtendo (r, s2)
    A->>B: m2 e (r, s2)
    Note over E: Eva copia m2 e (r, s2)
    E->>E: Percebe que o valor r é igual nas duas assinaturas
    E->>E: k = (h1 - h2) · (s1 - s2)⁻¹ mod n
    E->>E: d = (s1 · k - h1) · r⁻¹ mod n
    Note over E: Eva obtém a chave privada de<br/>Alice e forja assinaturas`,
      },
      {
        titulo: 'Assinatura e verificação com Ed25519',
        ref: 'nonce determinístico',
        descricao:
          'No Ed25519, Alice deriva da semente secreta um escalar a e um prefixo; a chave pública é A = a·B, em que B é o ponto base da curva. Para assinar, calcula o nonce r como o hash do prefixo seguido da mensagem, sem sorteio algum, e então R = r·B e S = r + H(R, A, m)·a (mod L). Bob verifica a equação S·B = R + H(R, A, m)·A. Como o nonce depende da chave e da mensagem, mensagens diferentes nunca reutilizam o mesmo nonce e uma falha do gerador de números aleatórios não compromete a chave.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice (signatária)
    participant B as Bob (verificador)
    participant E as Eva
    A->>A: Deriva a e o prefixo da semente secreta
    A->>A: A = a · B (chave pública)
    A->>B: Chave pública A
    A->>A: r = Hash(prefixo e m), sem sorteio
    A->>A: R = r · B
    A->>A: S = r + Hash(R, A, m) · a mod L
    A->>E: m e a assinatura (R, S)
    E->>B: m' e (R, S) se Eva alterar a mensagem
    B->>B: h = Hash(R, A, m recebida)
    alt S · B é igual a R + h · A
        B->>B: Assinatura válida
    else a equação não fecha
        B->>B: Assinatura inválida
    end`,
      },
    ],
  },

  tls13: {
    rotuloArtigos: 'Especificação.',
    artigos: [
      {
        citacao: 'IETF. *The Transport Layer Security (TLS) Protocol Version 1.3*. [RFC 9846](https://www.rfc-editor.org/rfc/rfc9846), 2026, que substitui a [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446).',
        links: [],
      },
    ],
    titulo: 'Diagramas do handshake e do cronograma de chaves',
    intro:
      'Os diagramas abaixo mostram o TLS 1.3 em si, antes dos cenários executados da seção 5. Alice é o cliente, Bob é o servidor e Eva observa o canal (e, quando indicado, o controla). **ECDHE** é o acordo de chaves com curvas elípticas efêmeras; **HKDF** é a função de derivação de chaves; o **transcrito** é o resumo de todas as mensagens do handshake até aquele ponto. As mensagens marcadas como cifradas já usam as chaves de handshake.',
    diagramas: [
      {
        titulo: 'Handshake completo de 1-RTT',
        ref: 'ClientHello até os dados de aplicação',
        descricao:
          'Alice envia o ClientHello com um valor aleatório, as suítes aceitas e a sua parte do acordo ECDHE (key_share). Bob responde com o ServerHello, que traz a parte dele do ECDHE, e a partir daí os dois derivam o segredo de handshake e passam a cifrar tudo. Bob então envia, cifrados, as extensões, o certificado, o CertificateVerify (assinatura do transcrito com a chave privada do certificado) e o Finished (um HMAC do transcrito). Alice valida o certificado, a assinatura e o Finished, responde com o seu Finished e ambos derivam as chaves de tráfego da aplicação. Eva vê o ClientHello e o ServerHello, mas as demais mensagens estão cifradas.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice (cliente)
    participant B as Bob (servidor)
    participant E as Eva
    A->>A: Gera o par ECDHE efêmero e um valor aleatório
    A->>B: ClientHello (valor aleatório, suítes e key_share)
    Note over E: Eva vê o ClientHello
    B->>B: Gera o par ECDHE efêmero
    B->>A: ServerHello (suíte escolhida e key_share)
    Note over E: Eva vê o ServerHello, mas<br/>não as próximas mensagens
    A->>A: Segredo ECDHE e chaves de handshake
    B->>B: Segredo ECDHE e chaves de handshake
    B->>A: EncryptedExtensions (cifrada)
    B->>A: Certificate (cifrada)
    B->>A: CertificateVerify, assinatura do transcrito (cifrada)
    B->>A: Finished, HMAC do transcrito (cifrada)
    A->>A: Valida o certificado, a assinatura e o Finished
    A->>B: Finished do cliente (cifrada)
    B->>B: Valida o Finished do cliente
    A->>A: Deriva as chaves de tráfego da aplicação
    B->>B: Deriva as chaves de tráfego da aplicação
    A->>B: Dados de aplicação (cifrados)
    B->>A: Dados de aplicação (cifrados)`,
      },
      {
        titulo: 'Cronograma de chaves com HKDF',
        ref: 'do segredo ECDHE às chaves de tráfego',
        descricao:
          'Cada lado, com os mesmos insumos, executa a mesma sequência de derivações. Parte-se de um Early Secret (sem chave pré-compartilhada, entra um valor nulo). O Handshake Secret mistura o segredo ECDHE ao anterior com o HKDF-Extract, e dele saem, com o transcrito do ClientHello ao ServerHello, os segredos de tráfego de handshake de cada sentido. O Master Secret é derivado do Handshake Secret, e dele saem, com o transcrito até o Finished do servidor, os segredos de tráfego da aplicação. De cada segredo de tráfego o HKDF-Expand-Label extrai a chave e o IV usados pelo algoritmo de cifragem autenticada. Como o ECDHE é efêmero, o comprometimento futuro das chaves de longo prazo não expõe o tráfego passado (sigilo futuro).',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice (cliente)
    participant B as Bob (servidor)
    Note over A,B: Mesmos insumos nos dois<br/>lados
    A->>A: Early Secret = HKDF-Extract(nulo, nulo)
    B->>B: Early Secret = HKDF-Extract(nulo, nulo)
    A->>A: Handshake Secret = HKDF-Extract(derivado do anterior, segredo ECDHE)
    B->>B: Handshake Secret = HKDF-Extract(derivado do anterior, segredo ECDHE)
    A->>A: Segredos de tráfego de handshake (cliente e servidor)
    B->>B: Segredos de tráfego de handshake (cliente e servidor)
    A->>A: Master Secret = HKDF-Extract(derivado do Handshake Secret, nulo)
    B->>B: Master Secret = HKDF-Extract(derivado do Handshake Secret, nulo)
    A->>A: Segredos de tráfego da aplicação
    B->>B: Segredos de tráfego da aplicação
    A->>A: Chave e IV = HKDF-Expand-Label de cada segredo
    B->>B: Chave e IV = HKDF-Expand-Label de cada segredo`,
      },
      {
        titulo: 'Eva como homem do meio diante de um cliente que valida',
        ref: 'a autenticação do servidor barra o ataque',
        descricao:
          'Eva intercepta o ClientHello e responde a Alice com o seu próprio ServerHello, fazendo o ECDHE com ela. Para completar o handshake, porém, precisa provar que é Bob. Se apresenta o seu próprio certificado, Alice o recusa, pois não é válido para o nome de Bob nem emitido por uma autoridade confiável. Se repassa o certificado verdadeiro de Bob, que é público, não consegue produzir o CertificateVerify, porque a assinatura do transcrito exige a chave privada de Bob. Nos dois casos Alice aborta o handshake. O ataque só passa se o cliente deixar de validar o certificado.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice (cliente)
    participant E as Eva
    participant B as Bob (servidor)
    A->>E: ClientHello (key_share de Alice)
    E->>A: ServerHello (key_share de Eva)
    Note over A,E: Alice e Eva derivam chaves<br/>de handshake
    alt Eva apresenta o próprio certificado
        E->>A: Certificate de Eva (cifrada)
        A->>A: O certificado não vale para o nome de Bob
        A->>E: Alerta e aborta o handshake
    else Eva repassa o certificado real de Bob
        E->>A: Certificate de Bob (cifrada)
        E->>A: CertificateVerify forjado (cifrada)
        A->>A: A assinatura não confere com a chave pública de Bob
        A->>E: Alerta e aborta o handshake
    end
    Note over B: Bob nunca chega a falar com<br/>Alice`,
      },
    ],
  },

  'ml-kem': {
    artigos: [
      {
        citacao: 'Regev, O. *On lattices, learning with errors, random linear codes, and cryptography*. In: ACM Symposium on Theory of Computing (STOC), p. 84-93, 2005. Versão estendida no Journal of the ACM, v. 56, n. 6, art. 34, 2009.',
        links: [['Acessar o artigo (PDF, página do autor)', 'https://cims.nyu.edu/~regev/papers/qcrypto.pdf']],
      },
      {
        citacao: 'Bos, J.; Ducas, L.; Kiltz, E.; Lepoint, T.; Lyubashevsky, V.; Schanck, J. M.; Schwabe, P.; Seiler, G.; Stehlé, D. *CRYSTALS-Kyber: a CCA-secure module-lattice-based KEM*. In: IEEE European Symposium on Security and Privacy (EuroS&P), 2018.',
        links: [['Acessar o artigo (ePrint IACR 2017/634)', 'https://eprint.iacr.org/2017/634']],
      },
    ],
    titulo: 'Diagramas do LWE, do encapsulamento de chave e do modo híbrido',
    intro:
      'Os diagramas abaixo mostram o protocolo em si, antes dos cenários executados da seção 5. Alice gera o par de chaves e Bob encapsula uma chave nela; Eva observa o canal e, quando indicado, altera o texto cifrado. **ek** é a chave de encapsulamento (pública), **dk** a de desencapsulamento (privada), **c** o texto cifrado e **K** a chave compartilhada de 32 bytes. Os valores aqui são símbolos, não números.',
    diagramas: [
      {
        titulo: 'Cifragem de um bit com LWE em escala didática',
        ref: 'a ideia do aprendizado com erros',
        descricao:
          'A chave secreta de Alice é um vetor pequeno s. Ela publica uma matriz aleatória A e o vetor b = A·s + e, em que e é um erro pequeno: sem o erro, s sairia de um sistema linear; com ele, o problema é difícil. Para cifrar um bit, Bob escolhe um vetor r pequeno e calcula u = rᵀ·A e v = rᵀ·b + bit·⌊q/2⌋. Alice calcula v - u·s = rᵀ·e + bit·⌊q/2⌋: o termo de erro é pequeno, e o resultado fica perto de 0 (bit 0) ou perto de q/2 (bit 1). Eva, que vê A, b, u e v, não separa o erro do segredo.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    A->>A: Escolhe o segredo s e o erro pequeno e
    A->>A: b = A · s + e
    A->>B: Chave pública (A, b)
    Note over E: Eva copia (A, b)
    B->>B: Escolhe r pequeno
    B->>B: u = rᵀ · A e v = rᵀ · b + bit · ⌊q/2⌋
    B->>A: (u, v)
    Note over E: Eva vê (u, v), mas não<br/>separa o erro do segredo
    A->>A: d = v - u · s = rᵀ · e + bit · ⌊q/2⌋
    A->>A: Perto de 0 é bit 0, perto de q/2 é bit 1`,
      },
      {
        titulo: 'Geração de chaves, encapsulamento e desencapsulamento',
        ref: 'o fluxo do ML-KEM',
        descricao:
          'Alice executa a geração de chaves e obtém ek e dk; envia ek a Bob e guarda dk. Bob sorteia uma mensagem m, executa o encapsulamento sobre ek e obtém a chave K e o texto cifrado c; envia c a Alice e mantém K. Alice executa o desencapsulamento com dk e c e recupera a mesma K. Eva vê ek e c, mas sem dk não resolve o problema Module-LWE que protege K. A chave K é então usada em um algoritmo simétrico, e não para cifrar dados diretamente.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    A->>A: (ek, dk) = ML-KEM.KeyGen
    A->>B: ek
    Note over E: Eva copia ek
    B->>B: Sorteia a mensagem m
    B->>B: (K, c) = ML-KEM.Encaps(ek, m)
    B->>A: c
    Note over E: Eva copia c, mas não obtém K
    A->>A: K = ML-KEM.Decaps(dk, c)
    Note over A,B: Os dois têm a mesma chave K<br/>de 32 bytes
    A->>B: Dados cifrados com K (algoritmo simétrico)`,
      },
      {
        titulo: 'Eva altera o texto cifrado: rejeição implícita',
        ref: 'a transformação de Fujisaki-Okamoto',
        descricao:
          'Se Eva inverte um bit de c, Alice não recebe nenhum erro. No desencapsulamento, ela decifra, recifra o resultado com a chave pública e compara com o c recebido. Como o c alterado não confere, em vez de devolver a chave derivada da mensagem Alice devolve uma chave pseudoaleatória calculada a partir de um valor secreto de dk e do próprio c. A chave de Alice passa a ser diferente da de Bob, e a falha só aparece depois, quando os dados cifrados com K não decifram. Não há mensagem de erro que sirva de oráculo para Eva.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant E as Eva
    participant B as Bob
    B->>B: (K, c) = ML-KEM.Encaps(ek, m)
    B->>E: c
    E->>E: Inverte um bit, obtendo c'
    E->>A: c'
    A->>A: m' = decifra c' com dk
    A->>A: Recifra m' e compara com c'
    alt a comparação falha (c' foi alterado)
        A->>A: K' = Hash(valor secreto de dk e c'), pseudoaleatória
    else a comparação confere
        A->>A: K = derivada de m'
    end
    Note over A,B: Alice não vê erro algum, mas<br/>K' é diferente de K
    A->>B: Dados cifrados com K'
    B->>B: A autenticação falha e os dados são descartados`,
      },
      {
        titulo: 'Modo híbrido com X25519',
        ref: 'clássico e pós-quântico juntos',
        descricao:
          'No modo híbrido, o acordo combina um segredo clássico (ECDH com X25519) e um segredo pós-quântico (ML-KEM). Cada lado calcula os dois segredos e os concatena como entrada de uma função de derivação, de modo que a chave final só é obtida por Eva se ela quebrar os dois mecanismos. Isso protege contra um computador quântico futuro, sem abrir mão da segurança comprovada ao longo de anos do X25519 caso o ML-KEM tenha uma falha ainda desconhecida. O custo é o aumento do tamanho das mensagens trocadas.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    A->>A: Gera o par X25519 e o par ML-KEM
    A->>B: Chave pública X25519 e ek
    B->>B: Gera o par X25519 e encapsula em ek
    B->>A: Chave pública X25519 e c
    Note over E: Eva vê as duas chaves<br/>públicas, ek e c
    A->>A: K1 = X25519 e K2 = Decaps(dk, c)
    B->>B: K1 = X25519 e K2 = chave encapsulada
    A->>A: K = KDF(K1 e K2)
    B->>B: K = KDF(K1 e K2)
    Note over E: Eva precisa quebrar o X25519<br/>e o ML-KEM`,
      },
    ],
  },

  'hash-hmac': {
    artigos: [
      {
        citacao: 'Bellare, M.; Canetti, R.; Krawczyk, H. *Keying hash functions for message authentication*. In: CRYPTO 1996, Lecture Notes in Computer Science, v. 1109, p. 1-15. Springer, 1996.',
        links: [['Acessar o artigo (PDF, página de Mihir Bellare)', 'https://cseweb.ucsd.edu/~mihir/papers/kmd5.pdf']],
      },
      {
        citacao: 'Krawczyk, H.; Bellare, M.; Canetti, R. *HMAC: Keyed-Hashing for Message Authentication*. [RFC 2104](https://www.rfc-editor.org/rfc/rfc2104), IETF, 1997.',
        links: [],
      },
    ],
    titulo: 'Diagramas da integridade e da autenticação de mensagens',
    intro:
      'Os diagramas abaixo mostram o uso do hash e do HMAC, antes do cenário executado da seção 5. Alice e Bob são os participantes legítimos e Eva controla o canal. **H** é uma função hash, como a SHA-256; **K** é uma chave secreta compartilhada por Alice e Bob; **ipad** e **opad** são constantes do HMAC. O hash é público: qualquer um o calcula.',
    diagramas: [
      {
        titulo: 'Um hash sem chave não autentica',
        ref: 'Eva recalcula o resumo',
        descricao:
          'Alice envia a mensagem m e o seu hash H(m). Bob recalcula H sobre o que recebeu e compara. Isso detecta erros acidentais, mas não protege contra Eva, que controla o canal: ela troca m por m\', calcula H(m\') e envia os dois. Bob recalcula, o hash confere e ele aceita a mensagem adulterada. O hash garante integridade só se o resumo chegar por um canal que Eva não altera.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant E as Eva
    participant B as Bob
    A->>A: h = H(m)
    A->>E: m e h
    E->>E: Troca m por m' e calcula h' = H(m')
    E->>B: m' e h'
    B->>B: Recalcula H(m') e compara com h'
    Note over B: Confere, então Bob aceita m'<br/>sem perceber a troca`,
      },
      {
        titulo: 'Autenticação de mensagem com HMAC',
        ref: 'a chave secreta impede a falsificação',
        descricao:
          'Alice e Bob compartilham a chave K, combinada antes por um canal seguro. Alice calcula a etiqueta t = HMAC(K, m), que aplica o hash em duas passagens: um hash interno sobre a mensagem precedida de K ⊕ ipad e um hash externo sobre o resultado precedido de K ⊕ opad. Bob refaz o cálculo com a sua cópia de K e compara as etiquetas em tempo constante. Eva, sem K, não calcula a etiqueta correta para m\' e, com isso, não consegue alterar a mensagem sem ser notada. Isso garante integridade e autenticidade da origem, mas não confidencialidade nem não repúdio, pois Bob também conhece K.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant E as Eva
    participant B as Bob
    Note over A,B: Chave secreta K já combinada
    A->>A: interno = H((K ⊕ ipad) ‖ m)
    A->>A: t = H((K ⊕ opad) ‖ interno)
    A->>E: m e t
    alt Eva não altera
        E->>B: m e t
    else Eva altera a mensagem
        E->>B: m' e t (Eva não conhece K)
    end
    B->>B: Recalcula t' = HMAC(K, mensagem recebida)
    alt t' é igual a t (tempo constante)
        B->>B: Mensagem autêntica e íntegra
    else t' é diferente de t
        B->>B: Rejeita a mensagem
    end`,
      },
      {
        titulo: 'Autenticação por desafio e resposta com HMAC',
        ref: 'a repetição de respostas antigas falha',
        descricao:
          'O HMAC também prova posse da chave sem revelá-la. Bob quer saber se fala com Alice: envia um desafio aleatório (nonce) que nunca usou antes. Alice responde com HMAC(K, nonce). Bob calcula o mesmo valor e compara. Eva pode gravar a resposta, mas, em uma nova tentativa, Bob envia outro nonce e a resposta antiga não confere. Por isso o nonce deve ser imprevisível e usado uma única vez. Este é um esquema didático: protocolos reais também amarram as identidades à resposta, como mostra o laboratório do Needham-Schroeder.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Chave secreta K já combinada
    B->>B: Sorteia o nonce n1
    B->>A: Desafio n1
    A->>A: resposta = HMAC(K, n1)
    A->>B: resposta
    Note over E: Eva grava n1 e a resposta
    B->>B: Calcula HMAC(K, n1) e compara
    Note over B: Confere, então Bob autentica<br/>Alice
    B->>B: Em outra tentativa, sorteia n2
    B->>E: Desafio n2
    E->>B: Resposta antiga a n1
    B->>B: Compara com HMAC(K, n2), que é diferente
    Note over B: Não confere, então Bob<br/>rejeita Eva`,
      },
    ],
  },

  aes: {
    artigos: [
      {
        citacao: 'Daemen, J.; Rijmen, V. *AES Proposal: Rijndael*. Documento enviado ao NIST no concurso do AES, versão revista, 1999.',
        links: [['Acessar o documento (PDF, NIST)', 'https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/aes-development/rijndael-ammended.pdf']],
      },
      {
        citacao: 'McGrew, D. A.; Viega, J. *The Security and Performance of the Galois/Counter Mode (GCM) of Operation*. In: INDOCRYPT 2004, Lecture Notes in Computer Science, v. 3348, p. 343-355. Springer, 2004.',
        links: [['Acessar o artigo (ePrint IACR 2004/193)', 'https://eprint.iacr.org/2004/193']],
      },
    ],
    titulo: 'Diagramas da cifragem de um bloco e dos modos de operação',
    intro:
      'Os diagramas abaixo mostram o AES em uso, antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal e, quando indicado, altera a cifra. **K** é a chave secreta compartilhada, **P_i** é o bloco i do texto claro (16 bytes), **C_i** o bloco i da cifra, **E** a cifragem de um bloco com o AES e **D** a decifragem. A chave K foi combinada antes por um canal seguro.',
    diagramas: [
      {
        titulo: 'Cifragem de um bloco com as rodadas do AES',
        ref: 'AES-128, 10 rodadas',
        descricao:
          'A chave é expandida em chaves de rodada. O bloco de 16 bytes entra em uma matriz de estado e recebe o AddRoundKey inicial. As rodadas 1 a 9 aplicam, em ordem, SubBytes (substituição não linear byte a byte pela caixa S), ShiftRows (deslocamento das linhas), MixColumns (mistura linear das colunas) e AddRoundKey (XOR com a chave da rodada). A rodada 10 é igual, mas sem MixColumns. Bob, que tem a mesma chave, aplica as operações inversas em ordem inversa e recupera o bloco. Uma única cifragem de bloco, sozinha, não define como cifrar uma mensagem longa: isso é papel do modo de operação.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    A->>A: Expande K nas chaves de rodada
    A->>A: Estado = bloco de 16 bytes
    A->>A: AddRoundKey com a chave da rodada 0
    A->>A: Rodadas 1 a 9: SubBytes, ShiftRows, MixColumns, AddRoundKey
    A->>A: Rodada 10: SubBytes, ShiftRows, AddRoundKey
    A->>B: Bloco cifrado de 16 bytes
    Note over E: Eva vê o bloco cifrado
    B->>B: Expande K nas mesmas chaves de rodada
    B->>B: Aplica as operações inversas em ordem inversa
    B->>B: Recupera o bloco original`,
      },
      {
        titulo: 'Modo ECB: blocos iguais geram cifras iguais',
        ref: 'o modo que vaza padrões',
        descricao:
          'No ECB, cada bloco é cifrado de forma independente, com a mesma chave: C_i = E(K, P_i). Dois blocos de texto claro iguais produzem dois blocos cifrados iguais, de modo que Eva enxerga a estrutura da mensagem mesmo sem decifrar (o exemplo clássico é a imagem cifrada em ECB cujo contorno continua visível). Como os blocos são independentes, Eva também pode trocar, repetir ou remover blocos, e Bob decifra tudo sem perceber. O ECB não deve ser usado para mensagens com mais de um bloco.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant E as Eva
    participant B as Bob
    A->>A: C1 = E(K, P1)
    A->>A: C2 = E(K, P2)
    A->>A: C3 = E(K, P3), com P3 igual a P1
    A->>E: C1, C2, C3
    Note over E: C3 é igual a C1, então Eva<br/>sabe que P3 é igual a P1
    E->>E: Troca a ordem dos blocos
    E->>B: C3, C2, C1
    B->>B: Decifra cada bloco de forma independente
    Note over B: Bob aceita o texto<br/>reordenado, sem erro algum`,
      },
      {
        titulo: 'Modo CBC: encadeamento com vetor de inicialização',
        ref: 'cada bloco depende do anterior',
        descricao:
          'No CBC, Alice sorteia um vetor de inicialização (IV) imprevisível e cifra cada bloco após um XOR com a cifra anterior: C_i = E(K, P_i ⊕ C_(i-1)), com C_0 = IV. Blocos iguais deixam de gerar cifras iguais. Bob decifra cada bloco e aplica o XOR com a cifra anterior. Se Eva inverte um bit de C_i, o bloco P_i sai totalmente embaralhado e o bloco seguinte, P_(i+1), sofre a inversão do mesmo bit. O CBC oculta padrões, mas não autentica: a alteração passa sem que Bob receba um aviso.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant E as Eva
    participant B as Bob
    A->>A: Sorteia o IV imprevisível
    A->>A: C1 = E(K, P1 ⊕ IV)
    A->>A: C2 = E(K, P2 ⊕ C1)
    A->>E: IV, C1, C2
    E->>E: Inverte um bit de C1, obtendo C1'
    E->>B: IV, C1', C2
    B->>B: P1' = D(K, C1') ⊕ IV, bloco totalmente corrompido
    B->>B: P2' = D(K, C2) ⊕ C1', com o mesmo bit invertido
    Note over B: Nenhum erro é sinalizado:<br/>Eva alterou P2 de modo<br/>previsível`,
      },
      {
        titulo: 'Modo CTR: fluxo de chaves gerado pelo contador',
        ref: 'cifra de fluxo construída com o AES',
        descricao:
          'No CTR, o AES não cifra o texto: cifra um contador, produzindo um fluxo de chaves que é combinado com o texto por XOR. Alice usa um nonce único por mensagem e um contador que cresce a cada bloco: C_i = P_i ⊕ E(K, nonce ‖ i). Bob gera o mesmo fluxo e repete o XOR. Não há preenchimento e os blocos podem ser calculados em paralelo. Mas, como a cifragem é um XOR, inverter um bit de C_i inverte o mesmo bit de P_i, e Eva faz mudanças previsíveis sem conhecer K. O nonce nunca pode se repetir com a mesma chave, pois a repetição revela P_1 ⊕ P_2.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant E as Eva
    participant B as Bob
    A->>A: Escolhe um nonce único para a mensagem
    A->>A: F1 = E(K, nonce e contador 1)
    A->>A: C1 = P1 ⊕ F1
    A->>E: nonce e C1
    E->>E: Inverte o bit j de C1, obtendo C1'
    E->>B: nonce e C1'
    B->>B: F1 = E(K, nonce e contador 1)
    B->>B: P1' = C1' ⊕ F1
    Note over B: O bit j de P1' está<br/>invertido, sem aviso: o CTR<br/>é maleável`,
      },
      {
        titulo: 'Modo GCM: cifragem autenticada',
        ref: 'a etiqueta detecta a adulteração',
        descricao:
          'O GCM combina o CTR, para a confidencialidade, com uma função de autenticação sobre o corpo finito GF(2^128) (GHASH), que produz uma etiqueta de autenticação. Alice usa um nonce único, cifra e calcula a etiqueta sobre a cifra e sobre os dados associados (cabeçalhos em claro, quando houver). Bob recalcula a etiqueta antes de liberar qualquer texto claro. Se Eva alterou um bit da cifra, do nonce ou dos dados associados, as etiquetas diferem e Bob rejeita a mensagem. O GCM é o modo recomendado quando se quer sigilo e integridade juntos, com o mesmo cuidado de nunca repetir o nonce com a mesma chave.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant E as Eva
    participant B as Bob
    A->>A: Escolhe um nonce único
    A->>A: C = cifra em CTR do texto claro P
    A->>A: t = GHASH sobre os dados associados e C, com a chave
    A->>E: nonce, C e t
    alt Eva não altera
        E->>B: nonce, C e t
    else Eva inverte um bit de C
        E->>B: nonce, C' e t
    end
    B->>B: Recalcula a etiqueta t' sobre o que recebeu
    alt t' é igual a t
        B->>B: Decifra e entrega P
    else t' é diferente de t
        B->>B: Rejeita sem decifrar
    end`,
      },
    ],
  },
};
