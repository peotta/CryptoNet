# ECDH, ECDSA e Ed25519

Aritmética de curvas elípticas passo a passo, ECDH e ECDSA em uma curva didática (com o ataque ao nonce reutilizado) e assinaturas reais ECDSA P-256 e Ed25519.

- **Categoria:** Criptografia Assimétrica e Acordo de Chaves
- **Abrir o laboratório:** <https://peotta.github.io/CryptoNet/#/lab/ecdh-assinaturas>
- **Motor:** didático (curva minúscula, BigInt) e real (Web Crypto: ECDSA P-256 e Ed25519)
- **Código-fonte:** `src/labs/ecc/` (interface e fluxos) e `src/crypto/ecc.ts` (operações)
- **Padrões e referências:** [RFC 6979](https://www.rfc-editor.org/rfc/rfc6979) (ECDSA determinístico); [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032) (Ed25519); [RFC 7748](https://www.rfc-editor.org/rfc/rfc7748) (X25519); [FIPS 186-5](https://csrc.nist.gov/pubs/fips/186-5/final) (ECDSA e EdDSA); NIST [SP 800-186](https://csrc.nist.gov/pubs/sp/800/186/final) (curvas elípticas recomendadas, como a P-256); NIST [SP 800-56A Rev. 3](https://csrc.nist.gov/pubs/sp/800/56/a/r3/final) (ECDH).

## 1. Objetivos de aprendizagem

- Descrever uma curva elíptica sobre um corpo finito e a lei de grupo: soma de pontos, dobro, oposto e ponto no infinito.
- Executar, passo a passo, a soma de pontos (inclinação, inverso modular, coordenadas) e a multiplicação escalar por dobrar e somar.
- Explicar o ECDH e por que a segurança vem do problema do logaritmo discreto, que só é difícil em grupos grandes.
- Assinar e verificar com o ECDSA e entender cada quantidade (hash z, nonce k, r, s).
- Demonstrar o ataque de reutilização do nonce k, que revela a chave privada em qualquer tamanho de curva.
- Comparar o ECDSA P-256 e o Ed25519 (assinaturas determinísticas) com a Web Crypto, e relacionar ao handshake do TLS 1.3.

## 2. Fundamentação

Numa curva elíptica sobre um corpo finito, somar pontos e multiplicar por um escalar (dobrar e somar) são operações fáceis, mas descobrir k a partir de k·G é o logaritmo discreto elíptico. O ECDH acorda um segredo; o ECDSA assina com um nonce k que não pode se repetir (repetir k revela a chave privada, como no caso do PlayStation 3). O Ed25519 deriva o nonce da chave e da mensagem, sem sorteio.

**Artigos originais.**

- Miller, V. S. *Use of elliptic curves in cryptography*. In: CRYPTO 1985, Lecture Notes in Computer Science, v. 218, p. 417-426. Springer, 1986. [DOI 10.1007/3-540-39799-X_31](https://doi.org/10.1007/3-540-39799-X_31).
- Koblitz, N. *Elliptic curve cryptosystems*. Mathematics of Computation, v. 48, n. 177, p. 203-209, jan. 1987. [DOI 10.1090/S0025-5718-1987-0866109-5](https://doi.org/10.1090/S0025-5718-1987-0866109-5).
- Bernstein, D. J. *Curve25519: new Diffie-Hellman speed records*. In: PKC 2006, Lecture Notes in Computer Science, v. 3958, p. 207-228. Springer, 2006. [Acessar o artigo (PDF, página do autor)](https://cr.yp.to/ecdh/curve25519-20060209.pdf).
- Bernstein, D. J.; Duif, N.; Lange, T.; Schwabe, P.; Yang, B.-Y. *High-speed high-security signatures*. Journal of Cryptographic Engineering, v. 2, n. 2, p. 77-89, 2012. [Acessar o artigo (PDF, página do Ed25519)](https://ed25519.cr.yp.to/ed25519-20110926.pdf).
- Johnson, D.; Menezes, A.; Vanstone, S. *The Elliptic Curve Digital Signature Algorithm (ECDSA)*. International Journal of Information Security, v. 1, n. 1, p. 36-63, 2001. [DOI 10.1007/s102070100002](https://doi.org/10.1007/s102070100002).

### 2.1 Diagramas da geração de chaves, do acordo e das assinaturas em curvas elípticas

Os diagramas abaixo mostram o protocolo em si, antes dos cenários executados da seção 5. Alice e Bob são os participantes legítimos e Eva observa (ou, quando indicado, altera) o canal. Nas mensagens, **G** é o ponto gerador da curva, de ordem prima **n**; **d** é uma chave privada (um escalar) e **Q = d·G** a chave pública correspondente; **x(P)** é a coordenada x do ponto P. Recuperar d a partir de Q é o logaritmo discreto elíptico.

#### 2.1.1 Geração das chaves e acordo ECDH (visão de Eva, observadora passiva)

Alice e Bob usam a mesma curva e o mesmo ponto G, públicos. Cada um sorteia uma chave privada (d_A e d_B) e calcula a chave pública multiplicando G pelo escalar (Q_A = d_A·G e Q_B = d_B·G). Trocam as chaves públicas pelo canal aberto e cada um multiplica a chave pública recebida pela sua chave privada: d_A·Q_B = d_A·d_B·G = d_B·Q_A. O ponto S é o mesmo nos dois lados e a sua coordenada x é o segredo compartilhado, que na prática passa por uma função de derivação antes de virar chave simétrica. Eva conhece a curva, G, Q_A e Q_B, mas obter d_A ou d_B exige resolver o logaritmo discreto elíptico.

```mermaid
sequenceDiagram
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
    Note over E: Obter S exige resolver o<br/>logaritmo discreto elíptico
```

*Figura 2.1.1 (sequência).* Geração das chaves e acordo ECDH.

#### 2.1.2 Assinatura e verificação com ECDSA (o nonce k deve ser secreto e único)

Alice tem o par (d, Q = d·G). Para assinar, calcula o hash h da mensagem, sorteia um nonce k, calcula o ponto R = k·G e toma r = x(R) mod n; depois s = k⁻¹·(h + r·d) mod n. A assinatura é o par (r, s). Bob recebe a mensagem e a assinatura, calcula w = s⁻¹, u1 = h·w e u2 = r·w, e então o ponto P = u1·G + u2·Q. A assinatura é válida se x(P) mod n for igual a r, pois P = k·G. Se Eva altera a mensagem, o hash muda e a verificação falha; sem d, ela não refaz (r, s).

```mermaid
sequenceDiagram
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
    end
```

*Figura 2.1.2 (sequência).* Assinatura e verificação com ECDSA.

#### 2.1.3 O ataque ao nonce reutilizado no ECDSA (como a chave privada vaza)

Se Alice usa o mesmo nonce k em duas assinaturas, o valor r é o mesmo nas duas, e Eva, que vê as duas assinaturas e os hashes das mensagens, resolve duas equações lineares. Subtraindo s1 = k⁻¹·(h1 + r·d) e s2 = k⁻¹·(h2 + r·d), obtém k = (h1 - h2)·(s1 - s2)⁻¹ mod n e, com k, a chave privada: d = (s1·k - h1)·r⁻¹ mod n. É o erro de implementação que expôs a chave de assinatura do console PlayStation 3. O Ed25519 evita o problema derivando o nonce da chave e da mensagem.

```mermaid
sequenceDiagram
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
    Note over E: Eva obtém a chave privada de<br/>Alice e forja assinaturas
```

*Figura 2.1.3 (sequência).* O ataque ao nonce reutilizado no ECDSA.

#### 2.1.4 Assinatura e verificação com Ed25519 (nonce determinístico)

No Ed25519, Alice deriva da semente secreta um escalar a e um prefixo; a chave pública é A = a·B, em que B é o ponto base da curva. Para assinar, calcula o nonce r como o hash do prefixo seguido da mensagem, sem sorteio algum, e então R = r·B e S = r + H(R, A, m)·a (mod L). Bob verifica a equação S·B = R + H(R, A, m)·A. Como o nonce depende da chave e da mensagem, mensagens diferentes nunca reutilizam o mesmo nonce e uma falha do gerador de números aleatórios não compromete a chave.

```mermaid
sequenceDiagram
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
    end
```

*Figura 2.1.4 (sequência).* Assinatura e verificação com Ed25519.

> **Aviso:** a partir deste ponto são apresentados os cenários para simulação em laboratório, com Alice, Bob e Eva como participantes.

## 3. Participantes

Alice e Bob são os participantes legítimos; Eva é a atacante (observadora passiva ou, quando há adulteração, ativa). As tabelas abaixo listam o que cada um mantém em cada cenário.

| Participante | Papel | Dados que pode guardar (tipo) |
| --- | --- | --- |
| Alice | Participante | Chave privada (segredo); Chave pública A = a·G (valor público); Ponto compartilhado (segredo); Nonce k (segredo); Assinatura (assinatura ou etiqueta) |
| Bob | Participante | Chave privada b (segredo); Chave pública de Alice (valor público); Ponto compartilhado (segredo); Resultado da verificação (parâmetro público) |
| Eva | Atacante (observa o canal) | Observado no canal (assinatura ou etiqueta); Chave privada deduzida (segredo); Ponto deduzido por Eva (segredo); Nonce k deduzido (segredo); Mensagem alterada (texto claro) |

## 4. Como ler os diagramas

Cada figura é um diagrama de sequência gerado a partir da mesma definição de protocolo que anima o laboratório: as colunas são os participantes, o tempo corre de cima para baixo e cada faixa horizontal é o início de uma etapa. Os valores numéricos e as chaves não aparecem aqui (são aleatórios ou dependem das entradas); eles são mostrados nas fórmulas do próprio laboratório.

- Seta cheia: mensagem enviada pelo canal, com o rótulo do que trafega.
- Número no início do rótulo: ordem da interação no diagrama, de cima para baixo.
- Botão Ampliar diagrama (no site): abre o diagrama em tela cheia, com zoom.
- `[adulterada]` no início do rótulo: a mensagem foi alterada em trânsito por Eva.
- Faixa com texto: título da etapa que começa naquele ponto.

**Lista de figuras**

- [Figura 5.1.1](#511-ecdh-e-logaritmo-discreto-por-força-bruta): ECDH e logaritmo discreto por força bruta
- [Figura 5.2.1](#521-uso-correto-com-eva-alterando-a-mensagem): Uso correto, com Eva alterando a mensagem
- [Figura 5.2.2](#522-nonce-reutilizado): Nonce reutilizado
- [Figura 5.3.1](#531-ecdsa-p-256-com-eva-alterando-a-mensagem): ECDSA P-256 com Eva alterando a mensagem

## 5. Cenários

### 5.1 ECDH na curva didática

#### 5.1.1 ECDH e logaritmo discreto por força bruta

**Entradas usadas:** a = 11, b = 7.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: Alice envia A a Bob
  n_alice->>n_bob: A
  Note over n_alice,n_eva: Bob envia B a Alice
  n_bob->>n_alice: B
```

*Figura 5.1.1 (sequência).* ECDH e logaritmo discreto por força bruta: 2 mensagens, entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice e Bob combinam a curva e o ponto G | Nenhum cálculo: os parâmetros são públicos. |
| 2 | Alice calcula a chave pública A = a · G | Multiplicação escalar a · G. |
| 3 | Bob calcula a chave pública B = b · G | Multiplicação escalar b · G. |
| 4 | Alice envia A a Bob | Envio da chave pública A. |
| 5 | Bob envia B a Alice | Envio da chave pública B. |
| 6 | Alice calcula a · B | Multiplicação escalar a · B. |
| 7 | Bob calcula b · A | Multiplicação escalar b · A. |
| 8 | Eva procura a chave privada de Alice (força bruta) | Cálculo de G, 2G, 3G, ... até obter A. |
| 9 | Eva calcula k · B | Multiplicação escalar k · B. |
| 10 | A curva didática foi quebrada | Avaliação do resultado. |

**Veredito do cenário:** Eva viu A = (13, 10) e B = (0, 6) e testou os múltiplos de G até achar A: bastaram 11 somas (a ordem do grupo é só 19). Com a = 11, calculou a · B = (5, 1), o mesmo ponto de Alice e Bob. Numa curva real como a P-256, a ordem é cerca de 2²⁵⁶: a mesma busca exigiria cerca de 2¹²⁸ operações pelo melhor ataque conhecido (rho de Pollard), inviável. O que protege o ECDH é o tamanho do grupo, e não o formato da conta.

### 5.2 ECDSA na curva didática

#### 5.2.1 Uso correto, com Eva alterando a mensagem

**Entradas usadas:** d = 7, k = 9.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: Alice tem o par de chaves e publica Q
  n_alice->>n_bob: Q
  Note over n_alice,n_eva: Eva altera a mensagem em trânsito
  n_alice->>n_eva: m, (r, s)
  n_eva->>n_bob: [adulterada] m', (r, s)
```

*Figura 5.2.1 (sequência).* Uso correto, com Eva alterando a mensagem: 3 mensagens (1 adulterada), entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice tem o par de chaves e publica Q | Envio da chave pública Q. |
| 2 | Alice calcula o hash da mensagem 1 | SHA-256 e redução ao tamanho de n. |
| 3 | Alice assina com o nonce k | Cálculo de r e s. |
| 4 | Eva altera a mensagem em trânsito | Alteração da mensagem. |
| 5 | Bob verifica a assinatura | Verificação ECDSA. |
| 6 | A alteração foi detectada | Avaliação do resultado. |

**Veredito do cenário:** Eva alterou a mensagem em trânsito e manteve a assinatura de Alice. Bob recalculou o hash da mensagem recebida e a verificação falhou: a assinatura protege a integridade e a autoria. (Numa curva real o hash tem 256 bits e a colisão é inviável.) Eva não conseguiu forjar uma assinatura sem a chave privada. Nesta curva minúscula ela poderia achar d por força bruta, como na aba de ECDH; aqui Eva só usa ataques que valem em qualquer tamanho de curva.

#### 5.2.2 Nonce reutilizado

**Entradas usadas:** d = 7, k = 9 nas duas assinaturas.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: Alice tem o par de chaves e publica Q
  n_alice->>n_bob: Q
  Note over n_alice,n_eva: Alice envia a mensagem 1 e a assinatura
  n_alice->>n_bob: m₁, (r, s₁)
  Note over n_alice,n_eva: Alice envia a mensagem 2 e a assinatura
  n_alice->>n_bob: m₂, (r, s₂)
  Note over n_alice,n_eva: Eva envia a mensagem falsa a Bob
  n_eva->>n_bob: [adulterada] m′, (r, s)
```

*Figura 5.2.2 (sequência).* Nonce reutilizado: 4 mensagens (1 adulterada), entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice tem o par de chaves e publica Q | Envio da chave pública Q. |
| 2 | Alice calcula o hash da mensagem 1 | SHA-256 e redução ao tamanho de n. |
| 3 | Alice assina com o nonce k | Cálculo de r e s. |
| 4 | Alice envia a mensagem 1 e a assinatura | Envio de (m₁, r, s₁). |
| 5 | Alice assina a mensagem 2 com o MESMO k (erro) | Cálculo de r e s₂ com o mesmo k. |
| 6 | Alice envia a mensagem 2 e a assinatura | Envio de (m₂, r, s₂). |
| 7 | Eva calcula o nonce k | Cálculo de k = (z₁ − z₂)/(s₁ − s₂) mod n. |
| 8 | Eva calcula a chave privada d | Cálculo de d = (s₁ · k − z₁)/r mod n. |
| 9 | Eva assina uma mensagem falsa | Assinatura ECDSA com a chave roubada. |
| 10 | Eva envia a mensagem falsa a Bob | Envio da mensagem falsa e da assinatura forjada. |
| 11 | Bob verifica a assinatura forjada | Verificação ECDSA. |
| 12 | A reutilização de k revelou a chave privada | Avaliação do resultado. |

**Veredito do cenário:** As duas assinaturas têm o mesmo r = 7, o que mostra a Eva que o mesmo k foi usado. De s₁ − s₂ = k⁻¹(z₁ − z₂) ela obtém k = 9 e, de d = (s₁·k − z₁)/r, a chave privada d = 7, a mesma de Alice (7). Com ela, forjou uma assinatura de "TRANSFERIR TUDO PARA EVA" que Bob aceitou: aceita. Isso vale para qualquer curva, inclusive a P-256: foi assim que se extraiu a chave de assinatura do PlayStation 3 (2010). Por isso o ECDSA moderno deriva k de forma determinística ([RFC 6979](https://www.rfc-editor.org/rfc/rfc6979)) e o Ed25519 não usa nonce aleatório.

### 5.3 Assinaturas reais

#### 5.3.1 ECDSA P-256 com Eva alterando a mensagem

**Entradas usadas:** mensagem "Transferir R$ 100".

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: Alice envia a chave pública a Bob
  n_alice->>n_bob: Chave pública
  Note over n_alice,n_eva: Eva altera um bit da mensagem
  n_alice->>n_eva: m, assinatura
  n_eva->>n_bob: [adulterada] m', assinatura
```

*Figura 5.3.1 (sequência).* ECDSA P-256 com Eva alterando a mensagem: 3 mensagens (1 adulterada), entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice gera o par de chaves | Geração do par ECDSA-P256. |
| 2 | Alice envia a chave pública a Bob | Envio da chave pública. |
| 3 | Alice assina a mensagem | Assinatura ECDSA-P256. |
| 4 | Eva altera um bit da mensagem | Inversão de um bit da mensagem. |
| 5 | Bob verifica a assinatura | Verificação ECDSA-P256. |
| 6 | A alteração foi detectada | Avaliação do resultado. |

**Veredito do cenário:** Eva trocou um bit da mensagem e manteve a assinatura. Bob verificou com a chave pública de Alice e rejeitou: qualquer alteração invalida a assinatura. Eva não pode gerar outra sem a chave privada, e o problema do logaritmo discreto em P-256 (cerca de 2²⁵⁶ elementos) impede que ela a derive da chave pública.

## 6. Perguntas de fixação

1. Na curva y² = x³ + 2x + 2 (mod 17), calcule 2G com G = (5, 1).

   **Resposta.** Dobro: λ = (3x² + a)/(2y) = (3·25 + 2)/2 = 77/2. Módulo 17, 77 ≡ 9 e 2⁻¹ = 9, então λ = 81 ≡ 13. x₃ = λ² − 2x = 169 − 10 = 159 ≡ 6. y₃ = λ(x − x₃) − y = 13·(5 − 6) − 1 = −14 ≡ 3. Logo 2G = (6, 3).

2. Por que o ECDH com chaves de 256 bits é seguro, se a conta k · G é tão simples?

   **Resposta.** Calcular k · G é rápido (cerca de 256 dobras e somas), mas descobrir k a partir de k · G é o logaritmo discreto em curva elíptica, para o qual o melhor ataque conhecido (rho de Pollard) leva cerca de 2¹²⁸ operações em uma curva de 256 bits. Na curva didática de ordem 19 bastam 19 tentativas. A segurança vem do tamanho do grupo, e não da conta em si.

3. Por que o ECDSA com a mesma chave de 256 bits oferece segurança equivalente a um RSA de 3072 bits?

   **Resposta.** Para o RSA existem algoritmos subexponenciais de fatoração (crivo de corpo de números), então o módulo precisa ser grande. Para curvas bem escolhidas só se conhecem ataques exponenciais (cerca de a raiz quadrada da ordem do grupo), de modo que 256 bits de curva dão cerca de 128 bits de segurança, o que o RSA só atinge com cerca de 3072 bits. Daí chaves e assinaturas menores e operações mais rápidas.

4. O que acontece se Alice reutilizar o nonce k em duas assinaturas ECDSA?

   **Resposta.** As duas assinaturas têm o mesmo r. Subtraindo as equações s = k⁻¹(z + r·d), obtém-se s₁ − s₂ = k⁻¹(z₁ − z₂), logo k = (z₁ − z₂)/(s₁ − s₂). Com k conhecido, d = (s₁·k − z₁)/r. Eva obtém a chave privada e assina o que quiser. Isso vale para qualquer curva. Casos reais: a chave de assinatura do PlayStation 3 (2010) e carteiras de bitcoin com geradores aleatórios defeituosos.

5. Como o Ed25519 evita o problema do nonce?

   **Resposta.** O nonce r é derivado por hash da parte secreta da chave e da mensagem, sem sorteio: duas assinaturas da mesma mensagem são idênticas, e mensagens diferentes dão nonces diferentes e imprevisíveis para quem não conhece a chave. O ECDSA moderno pode fazer o mesmo ([RFC 6979](https://www.rfc-editor.org/rfc/rfc6979)), mas o Ed25519 já nasceu assim.

6. Por que a troca de chaves elíptica sozinha não protege contra o homem do meio?

   **Resposta.** O ECDH garante apenas que, se Alice e a outra ponta calculam o mesmo ponto, só elas o conhecem. Não diz quem é a outra ponta: Eva pode fazer um ECDH com cada lado. Por isso o TLS 1.3 combina o ECDHE com certificados e com uma assinatura (ECDSA ou Ed25519) sobre a transcrição do handshake.

## 7. Limitações e cuidados

- A curva didática tem 19 pontos: qualquer chave cai por tentativa e nada ali oferece segurança.
- As assinaturas reais (ECDSA P-256 e Ed25519) dependem do suporte do navegador à Web Crypto; o Ed25519 pode não estar disponível em versões antigas.
- Uso exclusivamente didático: os laboratórios não devem proteger dados reais.

---

*CryptoNet é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
