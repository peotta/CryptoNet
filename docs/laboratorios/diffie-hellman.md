# Diffie-Hellman

Acordo de chaves por um canal público, visão de Eva, derivação de chave com HKDF e o ataque do homem do meio.

- **Categoria:** Criptografia Assimétrica e Acordo de Chaves
- **Abrir o laboratório:** <https://peotta.github.io/CryptoNet/#/lab/diffie-hellman>
- **Motor:** didático (BigInt) com HKDF e AES-GCM reais (Web Crypto)
- **Código-fonte:** `src/labs/diffie-hellman/` (interface e fluxos) e `src/crypto/diffieHellman.ts e src/crypto/kdf.ts` (operações)
- **Padrões e referências:** [RFC 7919](https://www.rfc-editor.org/rfc/rfc7919) (grupos de Diffie-Hellman finitos negociados); NIST [SP 800-56A Rev. 3](https://csrc.nist.gov/pubs/sp/800/56/a/r3/final) (acordo de chaves por logaritmo discreto); [RFC 5869](https://www.rfc-editor.org/rfc/rfc5869) (HKDF) e NIST [SP 800-56C Rev. 2](https://csrc.nist.gov/pubs/sp/800/56/c/r2/final) (derivação de chaves); [FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) (SHA-256, usado no HKDF); NIST [SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final) (AES-GCM); [RFC 7748](https://www.rfc-editor.org/rfc/rfc7748) (X25519).

## 1. Objetivos de aprendizagem

- Explicar que o Diffie-Hellman é um mecanismo de acordo de chaves, e não de cifragem de mensagens.
- Calcular A = g^a mod p, B = g^b mod p e o segredo compartilhado K = g^(ab) mod p, verificando que K_A = K_B.
- Identificar quais informações Eva observa (p, g, A, B) e quais permanecem secretas (a, b, K).
- Relacionar a segurança do protocolo ao problema do logaritmo discreto.
- Demonstrar o ataque do homem do meio (MITM) e justificar a necessidade de autenticação.
- Compreender o papel de uma função de derivação de chaves (HKDF) entre o segredo compartilhado e a chave simétrica.

## 2. Fundamentação

No Diffie-Hellman, Alice e Bob escolhem expoentes privados a e b e trocam A = gᵃ mod p e B = gᵇ mod p; ambos obtêm K = gᵃᵇ mod p. Eva vê p, g, A e B, mas recuperar a ou b é o problema do logaritmo discreto. O protocolo não autentica ninguém, por isso um homem do meio (Eva ativa) estabelece um segredo com cada lado. Na prática, K passa por uma função de derivação (HKDF) e alimenta um algoritmo simétrico como o AES-GCM.

**Artigo original.**

- Diffie, W.; Hellman, M. E. *New directions in cryptography*. IEEE Transactions on Information Theory, v. IT-22, n. 6, p. 644-654, nov. 1976. [Acessar o artigo (PDF, cópia de Martin Hellman na Universidade de Stanford)](https://ee.stanford.edu/~hellman/publications/24.pdf); [DOI 10.1109/TIT.1976.1055638](https://doi.org/10.1109/TIT.1976.1055638).

### 2.1 Diagramas da geração e da troca de chaves

Os diagramas abaixo mostram o protocolo em si, antes dos cenários executados da seção 5. Alice e Bob são os participantes legítimos e Eva observa o canal. Nas mensagens, **p** é o módulo primo e **g** o gerador, ambos públicos; **a** e **b** são os expoentes privados de Alice e de Bob; **A** e **B** são os valores públicos; **K** é o segredo compartilhado. O segredo K nunca trafega pelo canal.

#### 2.1.1 Geração das chaves e acordo do segredo compartilhado (visão de Eva, observadora passiva)

Cenário-base do protocolo. Alice e Bob combinam o grupo público (p, g). Cada um sorteia um expoente privado, que nunca sai da sua máquina, e calcula o valor público correspondente (A = g^a mod p e B = g^b mod p). Os valores públicos atravessam o canal, onde Eva os copia. Cada lado eleva o valor recebido ao seu expoente privado e chega ao mesmo K = g^(ab) mod p, pois (g^b)^a = (g^a)^b. Eva conhece p, g, A e B, mas obter a ou b a partir deles é o problema do logaritmo discreto, inviável para parâmetros grandes.

```mermaid
sequenceDiagram
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
    Note over E: Para obter K, Eva precisaria<br/>de a ou de b (logaritmo<br/>discreto)
```

*Figura 2.1.1 (sequência).* Geração das chaves e acordo do segredo compartilhado.

#### 2.1.2 Do segredo compartilhado à chave de sessão e ao tráfego cifrado (HKDF e AES-GCM)

O segredo K não é usado diretamente como chave. Cada lado o passa por uma função de derivação (HKDF com SHA-256), junto com um sal e um contexto públicos, e obtém uma chave simétrica de sessão com a distribuição e o tamanho adequados. Com ela, Alice cifra a mensagem com o AES-GCM, que usa um nonce único por mensagem e produz uma etiqueta de autenticação. Bob deriva a mesma chave, verifica a etiqueta e só então decifra. Eva vê apenas o nonce, o texto cifrado e a etiqueta; qualquer alteração em trânsito faz a verificação falhar.

```mermaid
sequenceDiagram
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
    end
```

*Figura 2.1.2 (sequência).* Do segredo compartilhado à chave de sessão e ao tráfego cifrado.

#### 2.1.3 Troca de chaves sem autenticação: o homem do meio (Eva ativa)

O Diffie-Hellman garante que o segredo é compartilhado entre quem trocou os valores públicos, mas não prova quem são essas pessoas. Se Eva controla o canal, ela mesma executa o protocolo com cada lado: substitui A por E (o seu valor público) diante de Bob e substitui B por E diante de Alice. O resultado são dois segredos distintos, K_AE entre Alice e Eva e K_EB entre Eva e Bob. Alice e Bob não compartilham nada entre si e acreditam o contrário, enquanto Eva decifra, lê, altera e recifra todo o tráfego.

```mermaid
sequenceDiagram
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
    E->>B: Mensagem recifrada com K_EB
```

*Figura 2.1.3 (sequência).* Troca de chaves sem autenticação: o homem do meio.

#### 2.1.4 Troca de chaves autenticada com assinatura digital (a defesa usada, por exemplo, no TLS 1.3)

A defesa é vincular os valores públicos a uma identidade verificável. Alice e Bob possuem pares de chaves de assinatura de longo prazo, e a chave pública de cada um é conhecida pelo outro (por exemplo, por meio de um certificado). Cada lado assina os dois valores públicos da troca com a sua chave privada de assinatura, e o outro verifica a assinatura com a chave pública correspondente antes de aceitar o segredo. Se Eva trocar A ou B, a assinatura não confere, pois ela não possui as chaves privadas de assinatura de Alice nem de Bob, e a troca é abortada. Este diagrama é conceitual: mostra a ideia, e não o formato exato de um protocolo específico.

```mermaid
sequenceDiagram
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
    Note over E: Eva não tem as chaves<br/>privadas de assinatura, não<br/>forja s_A nem s_B
```

*Figura 2.1.4 (sequência).* Troca de chaves autenticada com assinatura digital.

> **Aviso:** a partir deste ponto são apresentados os cenários para simulação em laboratório, com Alice, Bob e Eva como participantes.

## 3. Participantes

Alice e Bob são os participantes legítimos; Eva é a atacante (observadora passiva ou, quando há adulteração, ativa). As tabelas abaixo listam o que cada um mantém em cada cenário.

| Participante | Papel | Dados que pode guardar (tipo) |
| --- | --- | --- |
| Alice | Participante | p (público) (parâmetro público); g (público) (parâmetro público); A (enviado) (valor público); Valor recebido (suposto B) (valor público); K_A (com quem este segredo é compartilhado?) (segredo); a (segredo privado) (chave privada) |
| Bob | Participante | p (público) (parâmetro público); g (público) (parâmetro público); B (enviado) (valor público); Valor recebido (suposto A) (valor público); K_B (com quem este segredo é compartilhado?) (segredo); b (segredo privado) (chave privada) |
| Eva | Observadora passiva da rede | p (observado) (parâmetro público); g (observado) (parâmetro público); A (capturado de Alice) (valor público); B (capturado de Bob) (valor público); E (valor falso enviado) (valor público); K_AE (segredo com Alice) (segredo); K_EB (segredo com Bob) (segredo); e (segredo privado de Eva) (chave privada) |

## 4. Como ler os diagramas

Cada figura é um diagrama de sequência gerado a partir da mesma definição de protocolo que anima o laboratório: as colunas são os participantes, o tempo corre de cima para baixo e cada faixa horizontal é o início de uma etapa. Os valores numéricos e as chaves não aparecem aqui (são aleatórios ou dependem das entradas); eles são mostrados nas fórmulas do próprio laboratório.

- Seta cheia: mensagem enviada pelo canal, com o rótulo do que trafega.
- Número no início do rótulo: ordem da interação no diagrama, de cima para baixo.
- Botão Ampliar diagrama (no site): abre o diagrama em tela cheia, com zoom.
- `[adulterada]` no início do rótulo: a mensagem foi alterada em trânsito por Eva.
- Faixa com texto: título da etapa que começa naquele ponto.

**Lista de figuras**

- [Figura 5.1.1](#511-acordo-de-chaves-com-eva-observando): Acordo de chaves com Eva observando
- [Figura 5.1.2](#512-homem-do-meio): Homem do meio

## 5. Cenários

### 5.1 Troca de chaves

#### 5.1.1 Acordo de chaves com Eva observando

**Entradas usadas:** p = 23, g = 5, a = 6, b = 15.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: Parâmetros públicos
  n_alice->>n_bob: (p, g)
  Note over n_alice,n_eva: Alice envia A a Bob
  n_alice->>n_bob: A
  Note over n_alice,n_eva: Bob envia B a Alice
  n_bob->>n_alice: B
```

*Figura 5.1.1 (sequência).* Acordo de chaves com Eva observando: 3 mensagens, entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Parâmetros públicos | Acordo sobre o grupo (p, g). |
| 2 | Alice escolhe o segredo a | Escolha de a em [2, p - 2]. |
| 3 | Bob escolhe o segredo b | Escolha de b em [2, p - 2]. |
| 4 | Alice calcula A | A = g^a mod p. |
| 5 | Bob calcula B | B = g^b mod p. |
| 6 | Alice envia A a Bob | Transmissão de A pelo canal público. |
| 7 | Bob envia B a Alice | Transmissão de B pelo canal público. |
| 8 | Alice calcula o segredo compartilhado K_A | K_A = B^a mod p. |
| 9 | Bob calcula o segredo compartilhado K_B | K_B = A^b mod p. |
| 10 | Comparação dos segredos | Verificação de K_A = K_B. |
| 11 | Aplicação do segredo | chave = HKDF-SHA-256(K, sal, contexto). |

**Veredito do cenário:** Segredo compartilhado estabelecido com sucesso.

#### 5.1.2 Homem do meio

**Entradas usadas:** p = 23, g = 5, a = 6, b = 15, expoente de Eva = 13.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: Parâmetros públicos
  n_alice->>n_bob: (p, g)
  Note over n_alice,n_eva: Eva intercepta A e entrega E a Bob
  n_alice->>n_eva: A
  n_eva->>n_bob: [adulterada] A' = E
  Note over n_alice,n_eva: Eva intercepta B e entrega E a Alice
  n_bob->>n_eva: B
  n_eva->>n_alice: [adulterada] B' = E
```

*Figura 5.1.2 (sequência).* Homem do meio: 5 mensagens (2 adulteradas), entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Parâmetros públicos | Acordo sobre o grupo (p, g). |
| 2 | Alice escolhe o segredo a | Escolha de a. |
| 3 | Bob escolhe o segredo b | Escolha de b. |
| 4 | Eva escolhe o segredo e | Escolha de e. |
| 5 | Alice calcula A | A = g^a mod p. |
| 6 | Bob calcula B | B = g^b mod p. |
| 7 | Eva calcula E | E = g^e mod p. |
| 8 | Eva intercepta A e entrega E a Bob | Substituição de A por E no canal. |
| 9 | Eva intercepta B e entrega E a Alice | Substituição de B por E no canal. |
| 10 | Alice calcula K_A sem suspeitar | K_A = (B')^a mod p, com B' = E. |
| 11 | Bob calcula K_B sem suspeitar | K_B = (A')^b mod p, com A' = E. |
| 12 | Eva calcula K_AE, o segredo que divide com Alice | K_AE = A^e mod p. |
| 13 | Eva calcula K_EB, o segredo que divide com Bob | K_EB = B^e mod p. |
| 14 | Resultado do ataque | Comparação: K_A = K_AE? K_B = K_EB? K_A = K_B? |
| 15 | Mitigação: acordo de chaves não é autenticação | Nenhum cálculo: discussão da contramedida. |

**Veredito do cenário:** Ataque bem-sucedido: Alice e Bob estabeleceram segredos distintos, ambos conhecidos por Eva.

## 6. Perguntas de fixação

1. Com p = 23, g = 5, a = 6 e b = 15, quais são A, B e o segredo compartilhado K?

   **Resposta.** A = 5^6 mod 23 = 8; B = 5^15 mod 23 = 19; K = 19^6 mod 23 = 8^15 mod 23 = 2.

2. Por que Eva, conhecendo p, g, A e B, não consegue calcular K com facilidade em um grupo grande?

   **Resposta.** Ela precisaria obter a a partir de A = g^a mod p (ou b a partir de B), isto é, resolver o problema do logaritmo discreto. Em grupos adequados de 2048 bits ou mais, não se conhece algoritmo eficiente. Computar K diretamente a partir de (g, A, B) é o problema Diffie-Hellman computacional, que na prática é considerado tão difícil quanto o logaritmo discreto.

3. O Diffie-Hellman cifra mensagens? O que o segredo K é, de fato?

   **Resposta.** Não. O protocolo apenas faz com que dois participantes, trocando valores públicos, obtenham o mesmo segredo. Esse segredo é então processado por uma função de derivação (como HKDF) para produzir chaves simétricas, que cifram os dados com algoritmos como AES-GCM.

4. Por que o DH sem autenticação é vulnerável ao homem do meio?

   **Resposta.** Nada na troca vincula A ou B a uma identidade. Eva pode substituir os valores por E = g^e mod p e estabelecer um segredo com cada lado. Alice e Bob acreditam compartilhar uma chave entre si, mas Eva a conhece e repassa/altera todo o tráfego. A contramedida é autenticar a troca (assinaturas e certificados, como no TLS 1.3).

5. Por que os parâmetros deste laboratório (p = 23, 467, 2027) não são seguros?

   **Resposta.** Com p tão pequeno, a busca exaustiva por a (no máximo p - 2 tentativas) é instantânea. O botão de força bruta de Eva demonstra isso. Na prática, usam-se grupos de pelo menos 2048 bits ([RFC 7919](https://www.rfc-editor.org/rfc/rfc7919)) ou curvas elípticas como X25519.

## 7. Limitações e cuidados

- Os grupos são pequenos, por finalidade didática: não há grupo de 2048 bits no laboratório e nenhum valor aqui oferece segurança.
- A extensão HKDF e AES-GCM usa a Web Crypto (operação real).
- Uso exclusivamente didático: os laboratórios não devem proteger dados reais.

## 8. Glossário

Significado e finalidade das siglas usadas neste documento.

| Sigla | Significado | Para que serve |
| --- | --- | --- |
| **AES-GCM** | AES no modo Galois/Counter | cifra autenticada de uso corrente no TLS e em armazenamento: cifra e detecta alteração com a mesma chave |
| **DH** | Diffie-Hellman | troca de chaves em que as duas partes chegam ao mesmo segredo sem enviá-lo pela rede |
| **DOI** | Digital Object Identifier, identificador de objeto digital | identificador permanente de uma publicação, que leva ao artigo pelo endereço doi.org |
| **FIPS** | Federal Information Processing Standards, padrões federais de processamento de informação | padrões do NIST de uso obrigatório nos órgãos americanos, como o [FIPS 197](https://csrc.nist.gov/pubs/fips/197/final) (AES) e o [FIPS 203](https://csrc.nist.gov/pubs/fips/203/final) (ML-KEM) |
| **HKDF** | HMAC-based Key Derivation Function, função de derivação de chaves baseada em HMAC | extrai e expande um segredo em várias chaves independentes ([RFC 5869](https://www.rfc-editor.org/rfc/rfc5869)) |
| **IEEE** | Institute of Electrical and Electronics Engineers | entidade profissional que publica padrões e periódicos, como o IEEE Transactions on Information Theory |
| **MITM** | Man-in-the-Middle, homem do meio | ataque em que Eva se interpõe entre Alice e Bob e retransmite ou altera as mensagens |
| **NIST** | National Institute of Standards and Technology, Instituto Nacional de Padrões e Tecnologia (EUA) | publica os padrões criptográficos federais americanos, como os FIPS e as SP 800 |
| **PDF** | Portable Document Format, formato de documento portátil | formato de arquivo das cópias dos artigos citados |
| **SHA-256** | Secure Hash Algorithm, saída de 256 bits | hash da família SHA-2 de uso mais comum |
| **SP** | Special Publication, publicação especial | série de recomendações do NIST, como a [SP 800-38A](https://csrc.nist.gov/pubs/sp/800/38/a/final) (modos de operação) e a [SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final) (modo GCM) |
| **TLS** | Transport Layer Security, segurança da camada de transporte | protocolo que cifra e autentica a comunicação entre cliente e servidor; sucessor do SSL |


---

*CryptoNet é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
