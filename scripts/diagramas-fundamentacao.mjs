// Diagramas de sequência conceituais inseridos como item 2.1 da Fundamentação de alguns laboratórios.
// Mostram o protocolo em si (geração de chaves, troca, cifragem, assinatura), com Alice, Bob e Eva, antes dos
// cenários executados da seção 5. Não trazem valores numéricos: esses aparecem nas fórmulas do laboratório.

export const FUNDAMENTACAO_DIAGRAMAS = {
  'diffie-hellman': {
    artigos: [
      {
        citacao: 'Diffie, W.; Hellman, M. E. *New directions in cryptography*. IEEE Transactions on Information Theory, v. IT-22, n. 6, p. 644-654, nov. 1976.',
        links: [
          ['Acessar o artigo (PDF, cópia de Martin Hellman na Universidade de Stanford)', 'https://ee.stanford.edu/~hellman/publications/24.pdf'],
          ['DOI 10.1109/TIT.1976.1055638', 'https://doi.org/10.1109/TIT.1976.1055638'],
        ],
      },
    ],
    titulo: 'Diagramas da geração e da troca de chaves',
    intro:
      'Os diagramas abaixo mostram o protocolo em si, antes dos cenários executados da seção 5. Alice e Bob são os participantes legítimos e Eva observa o canal. Nas mensagens, **p** é o módulo primo e **g** o gerador, ambos públicos; **a** e **b** são os expoentes privados de Alice e de Bob; **A** e **B** são os valores públicos; **K** é o segredo compartilhado. O segredo K nunca trafega pelo canal.',
    diagramas: [
      {
        titulo: 'Geração das chaves e acordo do segredo compartilhado',
        ref: 'visão de Eva, observadora passiva',
        descricao:
          'Cenário-base do protocolo. Alice e Bob combinam o grupo público (p, g). Cada um sorteia um expoente privado, que nunca sai da sua máquina, e calcula o valor público correspondente (A = g^a mod p e B = g^b mod p). Os valores públicos atravessam o canal, onde Eva os copia. Cada lado eleva o valor recebido ao seu expoente privado e chega ao mesmo K = g^(ab) mod p, pois (g^b)^a = (g^a)^b. Eva conhece p, g, A e B, mas obter a ou b a partir deles é o problema do logaritmo discreto, inviável para parâmetros grandes.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Parâmetros públicos do grupo
    A->>B: (p, g)
    Note over E: Eva copia p e g
    Note over A: Sorteia o expoente privado a<br/>e o mantém em segredo
    Note over B: Sorteia o expoente privado b<br/>e o mantém em segredo
    A->>A: A = g^a mod p
    B->>B: B = g^b mod p
    A->>B: A
    B->>A: B
    Note over E: Eva copia A e B, mas não<br/>conhece a nem b
    A->>A: K = B^a mod p
    B->>B: K = A^b mod p
    Note over A,B: Os dois obtêm<br/>K = g^(ab) mod p,<br/>que nunca trafegou
    Note over E: Para obter K, Eva precisaria<br/>de a ou de b (logaritmo<br/>discreto)`,
      },
      {
        titulo: 'Do segredo compartilhado à chave de sessão e ao tráfego cifrado',
        ref: 'HKDF e AES-GCM',
        descricao:
          'O segredo K não é usado diretamente como chave. Cada lado o passa por uma função de derivação (HKDF com SHA-256), junto com um sal e um contexto públicos, e obtém uma chave simétrica de sessão com a distribuição e o tamanho adequados. Com ela, Alice cifra a mensagem com o AES-GCM, que usa um nonce único por mensagem e produz uma etiqueta de autenticação. Bob deriva a mesma chave, verifica a etiqueta e só então decifra. Eva vê apenas o nonce, o texto cifrado e a etiqueta; qualquer alteração em trânsito faz a verificação falhar.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Ponto de partida: ambos têm<br/>o mesmo segredo K
    A->>A: chave = HKDF-SHA-256(K, sal, contexto)
    B->>B: chave = HKDF-SHA-256(K, sal, contexto)
    Note over A,B: As duas chaves de sessão são<br/>idênticas
    A->>A: Sorteia um nonce único para esta mensagem
    A->>A: texto cifrado e etiqueta = AES-GCM-Cifrar(chave, nonce, mensagem)
    A->>B: nonce, texto cifrado, etiqueta
    Note over E: Eva vê apenas dados cifrados
    B->>B: Verifica a etiqueta com a chave
    alt etiqueta correta
        B->>B: mensagem = AES-GCM-Decifrar(chave, nonce, texto cifrado)
    else etiqueta incorreta (dado alterado)
        B->>B: Rejeita a mensagem sem decifrar
    end`,
      },
      {
        titulo: 'Troca de chaves sem autenticação: o homem do meio',
        ref: 'Eva ativa',
        descricao:
          'O Diffie-Hellman garante que o segredo é compartilhado entre quem trocou os valores públicos, mas não prova quem são essas pessoas. Se Eva controla o canal, ela mesma executa o protocolo com cada lado: substitui A por E (o seu valor público) diante de Bob e substitui B por E diante de Alice. O resultado são dois segredos distintos, K_AE entre Alice e Eva e K_EB entre Eva e Bob. Alice e Bob não compartilham nada entre si e acreditam o contrário, enquanto Eva decifra, lê, altera e recifra todo o tráfego.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant E as Eva
    participant B as Bob
    Note over A,B: Eva controla o canal entre<br/>Alice e Bob
    A->>E: A
    E->>B: E (no lugar de A)
    B->>E: B
    E->>A: E (no lugar de B)
    A->>A: K_AE = E^a mod p
    B->>B: K_EB = E^b mod p
    E->>E: K_AE = A^e mod p e K_EB = B^e mod p
    Note over A,E: Alice compartilha K_AE com<br/>Eva
    Note over E,B: Bob compartilha<br/>K_EB com Eva
    Note over A,B: Alice e Bob não compartilham<br/>segredo algum entre si
    A->>E: Mensagem cifrada com K_AE
    E->>E: Decifra, lê e pode alterar
    E->>B: Mensagem recifrada com K_EB`,
      },
      {
        titulo: 'Troca de chaves autenticada com assinatura digital',
        ref: 'a defesa usada, por exemplo, no TLS 1.3',
        descricao:
          'A defesa é vincular os valores públicos a uma identidade verificável. Alice e Bob possuem pares de chaves de assinatura de longo prazo, e a chave pública de cada um é conhecida pelo outro (por exemplo, por meio de um certificado). Cada lado assina os dois valores públicos da troca com a sua chave privada de assinatura, e o outro verifica a assinatura com a chave pública correspondente antes de aceitar o segredo. Se Eva trocar A ou B, a assinatura não confere, pois ela não possui as chaves privadas de assinatura de Alice nem de Bob, e a troca é abortada. Este diagrama é conceitual: mostra a ideia, e não o formato exato de um protocolo específico.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant E as Eva
    participant B as Bob
    Note over A,B: Cada um conhece a chave<br/>pública de assinatura do<br/>outro
    A->>A: A = g^a mod p
    A->>B: A
    B->>B: B = g^b mod p
    B->>B: s_B = Assinar(chave privada de Bob, A e B)
    B->>A: B e s_B
    A->>A: Verifica s_B com a chave pública de Bob
    alt assinatura válida
        A->>A: K = B^a mod p
        A->>A: s_A = Assinar(chave privada de Alice, A e B)
        A->>B: s_A
        B->>B: Verifica s_A com a chave pública de Alice
        B->>B: K = A^b mod p
        Note over A,B: Os dois têm K e sabem<br/>com quem o compartilham
    else Eva substituiu B ou A (assinatura inválida)
        A->>A: Aborta a troca sem calcular K
    end
    Note over E: Eva não tem as chaves<br/>privadas de assinatura, não<br/>forja s_A nem s_B`,
      },
    ],
  },

  rsa: {
    artigos: [
      {
        citacao: 'Rivest, R. L.; Shamir, A.; Adleman, L. *A method for obtaining digital signatures and public-key cryptosystems*. Communications of the ACM, v. 21, n. 2, p. 120-126, fev. 1978.',
        links: [
          ['Acessar o artigo (PDF, cópia de Ronald Rivest no MIT)', 'https://people.csail.mit.edu/rivest/Rsapaper.pdf'],
          ['DOI 10.1145/359340.359342', 'https://doi.org/10.1145/359340.359342'],
        ],
      },
    ],
    titulo: 'Diagramas da geração de chaves, da cifragem e da assinatura digital',
    intro:
      'Os diagramas abaixo mostram o RSA em operação, antes dos cenários executados da seção 5. Alice e Bob são os participantes legítimos e Eva observa o canal. O **par de chaves** pertence a quem **recebe** a mensagem cifrada (Bob) ou a quem **assina** (Alice): a chave pública (n, e) é divulgada a todos, inclusive a Eva, e a chave privada d fica apenas com o dono. Cifrar usa a chave pública do destinatário, e assinar usa a chave privada do signatário.',
    diagramas: [
      {
        titulo: 'Geração do par de chaves e divulgação da chave pública',
        ref: 'feita pelo dono do par, aqui Bob',
        descricao:
          'Bob escolhe dois primos grandes e distintos, p e q, e calcula o módulo n = p·q e o totiente φ(n) = (p-1)(q-1). Escolhe o expoente público e, coprimo de φ(n), e calcula o expoente privado d como o inverso de e módulo φ(n), ou seja, e·d ≡ 1 (mod φ(n)). Divulga (n, e) e guarda d, e também p, q e φ(n), em segredo. Eva e Alice recebem a mesma chave pública; recuperar d a partir de (n, e) exige fatorar n, o que é inviável para módulos de 2048 bits ou mais.',
        mermaid: `sequenceDiagram
    autonumber
    participant B as Bob (dono do par)
    participant A as Alice
    participant E as Eva
    B->>B: Escolhe dois primos grandes e distintos, p e q
    B->>B: n = p · q
    B->>B: φ(n) = (p - 1) · (q - 1)
    B->>B: Escolhe e coprimo de φ(n)
    B->>B: d = inverso de e módulo φ(n), isto é, e · d ≡ 1 mod φ(n)
    Note over B: Guarda d (e p, q, φ) em<br/>segredo: chave privada
    B->>A: Chave pública (n, e)
    B->>E: Chave pública (n, e), pois o canal é aberto
    Note over E: Eva conhece n e e, mas para<br/>obter d precisaria fatorar<br/>n`,
      },
      {
        titulo: 'Cifragem com a chave pública e decifragem com a chave privada',
        ref: 'confidencialidade',
        descricao:
          'Alice quer enviar uma mensagem confidencial a Bob. Ela usa a chave pública de Bob para cifrar (c = m^e mod n) e envia c pelo canal aberto. Eva vê c, n e e, mas não consegue inverter a exponenciação sem d. Bob usa a sua chave privada para decifrar (m = c^d mod n), recuperando a mensagem original, pois m^(e·d) ≡ m (mod n). Qualquer um pode cifrar para Bob, mas só Bob decifra. Neste diagrama a mensagem é um número m < n, como no modo didático sem padding do laboratório (inseguro); o RSA real usa o preenchimento do diagrama seguinte.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice (remetente)
    participant B as Bob (destinatário)
    participant E as Eva
    B->>A: Chave pública (n, e)
    Note over A: Mensagem m, com 0 ≤ m < n
    A->>A: c = m^e mod n (usa a chave pública de Bob)
    A->>B: c
    Note over E: Eva vê c, n e e, mas não<br/>consegue calcular m sem d
    B->>B: m = c^d mod n (usa a chave privada de Bob)
    Note over B: Bob recupera m, pois m^(e·d)<br/>≡ m mod n`,
      },
      {
        titulo: 'Cifragem real com RSA-OAEP',
        ref: 'com preenchimento aleatório',
        descricao:
          'O RSA de livro-texto é determinístico e maleável: a mesma mensagem produz sempre a mesma cifra, e Eva pode manipular a cifra de modo previsível. O RSA-OAEP corrige isso. Antes de exponenciar, Alice monta um bloco com a mensagem, um rótulo opcional e um valor aleatório, misturados por uma função de hash (máscara). Como o valor aleatório muda a cada cifragem, a mesma mensagem gera cifras diferentes. Ao decifrar, Bob desfaz a máscara e confere a estrutura do bloco; se a cifra foi alterada, a conferência falha e a mensagem é rejeitada.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice (remetente)
    participant B as Bob (destinatário)
    participant E as Eva
    B->>A: Chave pública (n, e)
    A->>A: Sorteia um valor aleatório (semente)
    A->>A: Monta o bloco OAEP com a mensagem, o rótulo e a semente, mascarados por hash
    A->>A: c = (bloco)^e mod n
    A->>B: c
    Note over E: Eva vê c, mas cifrar a mesma<br/>mensagem de novo daria outra<br/>cifra
    B->>B: bloco = c^d mod n
    B->>B: Desfaz a máscara e confere a estrutura do bloco
    alt estrutura válida
        B->>B: Extrai a mensagem
    else cifra alterada ou chave errada
        B->>B: Rejeita sem revelar o motivo
    end`,
      },
      {
        titulo: 'Assinatura digital com a chave privada e verificação com a chave pública',
        ref: 'autenticidade e integridade',
        descricao:
          'Aqui o par de chaves pertence a Alice, a signatária. Ela calcula o resumo (hash) da mensagem e o transforma com a sua chave privada, obtendo a assinatura s = h^d mod n, e envia a mensagem e a assinatura. Bob calcula o hash da mensagem recebida e aplica a chave pública de Alice à assinatura (h\' = s^e mod n). Se os dois valores coincidem, a mensagem veio de quem possui a chave privada de Alice e não foi alterada. Se Eva muda a mensagem, o hash muda e a verificação falha; Eva não consegue refazer a assinatura sem a chave privada. No modo didático do laboratório assina-se o número m diretamente, e no RSA-PSS real o resumo passa por um preenchimento probabilístico antes da exponenciação.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice (signatária)
    participant B as Bob (verificador)
    participant E as Eva
    A->>B: Chave pública (n, e)
    A->>A: h = Hash(m)
    A->>A: s = h^d mod n (usa a chave privada de Alice)
    A->>E: (m, s) passa pelo canal
    alt Eva não altera
        E->>B: (m, s)
    else Eva altera a mensagem
        E->>B: (m', s) com m' diferente de m
    end
    B->>B: h1 = Hash(mensagem recebida)
    B->>B: h2 = s^e mod n (usa a chave pública de Alice)
    alt h1 igual a h2
        B->>B: Assinatura válida: autêntica e íntegra
    else h1 diferente de h2
        B->>B: Assinatura inválida: mensagem alterada ou assinatura forjada
    end`,
      },
      {
        titulo: 'Cifrar e assinar a mesma mensagem',
        ref: 'confidencialidade, autenticidade e integridade',
        descricao:
          'Os dois usos se combinam, cada um com a chave certa. Alice assina a mensagem com a sua chave privada (prova de autoria e integridade) e cifra o conjunto com a chave pública de Bob (confidencialidade). Bob decifra com a sua chave privada e, em seguida, verifica a assinatura com a chave pública de Alice. Eva vê apenas a cifra e não consegue lê-la nem alterá-la sem que a verificação falhe. Cada par de chaves serve a um único propósito: o de Bob, para receber cifras, e o de Alice, para assinar. Em sistemas reais, a mensagem longa é cifrada com uma chave simétrica e só essa chave é protegida pelo RSA.',
        mermaid: `sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Cada um conhece a chave<br/>pública do outro
    A->>A: s = Assinar(chave privada de Alice, Hash(m))
    A->>A: c = Cifrar(chave pública de Bob, m e s)
    A->>B: c
    Note over E: Eva vê apenas c, que não lê<br/>nem altera sem ser detectada
    B->>B: m e s = Decifrar(chave privada de Bob, c)
    B->>B: Verificar(chave pública de Alice, s, Hash(m))
    alt assinatura válida
        B->>B: Aceita m: confidencial, autêntica e íntegra
    else assinatura inválida
        B->>B: Rejeita m
    end`,
      },
    ],
  },
};
