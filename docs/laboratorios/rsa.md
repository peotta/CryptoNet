# RSA

Geração de chaves, cifragem, decifragem e assinatura digital, em versão didática (BigInt) e real (RSA-OAEP e RSA-PSS).

- **Categoria:** Criptografia Assimétrica e Acordo de Chaves
- **Abrir o laboratório:** <https://peotta.github.io/CryptoNet/#/lab/rsa>
- **Motor:** didático (BigInt, sem padding) e real (Web Crypto)
- **Código-fonte:** `src/labs/rsa/` (interface e fluxos) e `src/crypto/rsaDidactic.ts e src/crypto/rsaWebCrypto.ts` (operações)
- **Padrões e referências:** [RFC 8017](https://www.rfc-editor.org/rfc/rfc8017) (PKCS #1 v2.2: RSAES-OAEP e RSASSA-PSS); [FIPS 186-5](https://csrc.nist.gov/pubs/fips/186-5/final) (assinaturas RSA, incluindo o RSASSA-PSS); [FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/final) (SHA-2, usado no OAEP e no PSS); NIST [SP 800-56B Rev. 2](https://csrc.nist.gov/pubs/sp/800/56/b/r2/final) (estabelecimento de chaves com RSA); NIST [SP 800-57 Parte 1 Rev. 5](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final) (tamanhos de chave).

## 1. Objetivos de aprendizagem

- Calcular um par de chaves RSA a partir de dois primos (n, φ(n), e, d) e interpretar cada parâmetro.
- Cifrar e decifrar com exponenciação modular e explicar por que m^(e·d) ≡ m (mod n).
- Diferenciar RSA de livro-texto (sem padding) de RSA-OAEP e RSA-PSS, e justificar por que só os últimos são aceitáveis na prática.
- Distinguir cifragem (confidencialidade, chave pública cifra) de assinatura digital (autenticidade e integridade, chave privada assina).
- Observar o efeito da adulteração de uma cifra ou de uma mensagem assinada.

## 2. Fundamentação

No RSA, n = p·q, e é coprimo de φ(n) e d é o inverso de e módulo φ(n). Cifrar é c = mᵉ mod n e decifrar é m = cᵈ mod n; assinar usa a chave privada e verificar usa a pública. O modo didático usa primos pequenos e nenhum padding (inseguro); o modo real usa RSA-OAEP (cifragem) e RSA-PSS (assinatura) pela Web Crypto, com chaves de 2048 a 4096 bits.

## 3. Participantes

Alice e Bob são os participantes legítimos; Eva é a atacante (observadora passiva ou, quando há adulteração, ativa). As tabelas abaixo listam o que cada um mantém em cada cenário.

| Participante | Papel | Dados que pode guardar (tipo) |
| --- | --- | --- |
| Alice | Remetente | Chave pública (valor público); Mensagem m (texto claro); Cifra c (texto cifrado); Assinatura s (assinatura ou etiqueta); Chave privada (chave privada) |
| Bob | Destinatário | Chave pública de Alice (valor público); Cifra recebida c (texto cifrado); Mensagem recuperada m' (texto claro); Chave privada (chave privada); Mensagem recebida (texto claro); Assinatura recebida (assinatura ou etiqueta); Resultado da verificação (assinatura ou etiqueta) |
| Eva | Atacante (observa e, se puder, altera o canal) | Chave pública de Alice (observada) (valor público); Cifra observada ou capturada (texto cifrado); Mensagem alterada m' (enviada a Bob) (texto claro); Mensagem observada ou capturada (texto claro); Assinatura observada ou capturada (assinatura ou etiqueta) |

## 4. Como ler os diagramas

Cada figura é um diagrama de sequência gerado a partir da mesma definição de protocolo que anima o laboratório: as colunas são os participantes, o tempo corre de cima para baixo e cada faixa horizontal é o início de uma etapa. Os valores numéricos e as chaves não aparecem aqui (são aleatórios ou dependem das entradas); eles são mostrados nas fórmulas do próprio laboratório.

- Seta cheia: mensagem enviada pelo canal, com o rótulo do que trafega.
- `[adulterada]` no início do rótulo: a mensagem foi alterada em trânsito por Eva.
- Faixa com texto: título da etapa que começa naquele ponto.

**Lista de figuras**

- [Figura 5.1.1](#511-cifragem): Cifragem
- [Figura 5.1.2](#512-assinatura-digital-com-eva-adulterando): Assinatura digital com Eva adulterando
- [Figura 5.2.1](#521-rsa-oaep): RSA-OAEP
- [Figura 5.2.2](#522-rsa-pss-com-eva-adulterando): RSA-PSS com Eva adulterando

## 5. Cenários

### 5.1 RSA didático

#### 5.1.1 Cifragem

**Entradas usadas:** p = 61, q = 53, e = 17, m = 65.

```mermaid
sequenceDiagram
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: A chave pública fica disponível para Alice
  n_bob->>n_alice: Chave pública
  Note over n_alice,n_eva: A cifra atravessa o canal
  n_alice->>n_bob: Cifra c
```

*Figura 5.1.1 (sequência).* Cifragem: 2 mensagens, entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Bob gera o par de chaves | Geração do par de chaves RSA. |
| 2 | A chave pública fica disponível para Alice | Distribuição da chave pública de Bob. |
| 3 | A chave privada permanece com Bob | Nenhum cálculo: apenas a política de guarda da chave privada. |
| 4 | Alice escreve a mensagem | Codificação da mensagem. |
| 5 | Alice cifra com a chave pública de Bob | Cifragem RSA sem padding. |
| 6 | A cifra atravessa o canal | Transmissão da cifra pelo canal público. |
| 7 | Bob recebe a cifra | Recepção da mensagem cifrada. |
| 8 | Bob decifra com a chave privada | Decifragem RSA sem padding. |
| 9 | A mensagem original é recuperada | Comparação entre a mensagem enviada e a recuperada. |

**Veredito do cenário:** Mensagem original recuperada: m = 65.

#### 5.1.2 Assinatura digital com Eva adulterando

**Entradas usadas:** p = 61, q = 53, e = 17, m = 65; Eva altera a mensagem.

```mermaid
sequenceDiagram
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: A chave pública é entregue a Bob
  n_alice->>n_bob: Chave pública
  Note over n_alice,n_eva: Eva intercepta a mensagem e a assinatura
  n_alice->>n_eva: (m, s)
  Note over n_alice,n_eva: Eva altera a mensagem e reenvia a Bob
  n_eva->>n_bob: [adulterada] (m', s)
```

*Figura 5.1.2 (sequência).* Assinatura digital com Eva adulterando: 3 mensagens (1 adulterada), entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice gera o par de chaves de assinatura | Geração do par de chaves RSA. |
| 2 | A chave pública é entregue a Bob | Distribuição da chave pública de Alice. |
| 3 | Alice escreve a mensagem | Definição da mensagem a assinar. |
| 4 | Alice assina com a chave privada | Assinatura RSA sem hash e sem padding. |
| 5 | Eva intercepta a mensagem e a assinatura | Interceptação do par (m, s). |
| 6 | Eva altera a mensagem e reenvia a Bob | Reenvio de (m', s). |
| 7 | Bob recebe a mensagem e a assinatura | Recepção do par (m, s). |
| 8 | Bob verifica com a chave pública de Alice | Verificação RSA sem padding. |
| 9 | A assinatura é inválida | Conclusão da verificação. |

**Veredito do cenário:** Assinatura inválida: s^e mod n = 65, mas a mensagem recebida é 66. A mensagem ou a assinatura foi alterada.

### 5.2 RSA real (OAEP e PSS)

#### 5.2.1 RSA-OAEP

**Entradas usadas:** chave de 2048 bits gerada na hora.

```mermaid
sequenceDiagram
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: A chave pública fica disponível para Alice
  n_bob->>n_alice: Chave pública
  Note over n_alice,n_eva: A cifra atravessa o canal
  n_alice->>n_bob: Cifra c
```

*Figura 5.2.1 (sequência).* RSA-OAEP: 2 mensagens, entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Bob gera o par de chaves | Geração do par de chaves RSA. |
| 2 | A chave pública fica disponível para Alice | Distribuição da chave pública de Bob. |
| 3 | A chave privada permanece com Bob | Nenhum cálculo: apenas a política de guarda da chave privada. |
| 4 | Alice escreve a mensagem | Codificação da mensagem. |
| 5 | Alice cifra com a chave pública de Bob | Cifragem RSA-OAEP. |
| 6 | A cifra atravessa o canal | Transmissão da cifra pelo canal público. |
| 7 | Bob recebe a cifra | Recepção da mensagem cifrada. |
| 8 | Bob decifra com a chave privada | Decifragem RSA-OAEP. |
| 9 | A mensagem original é recuperada | Comparação entre a mensagem enviada e a recuperada. |

**Veredito do cenário:** Mensagem original recuperada: "Olá, Bob! Esta mensagem é confidencial.".

#### 5.2.2 RSA-PSS com Eva adulterando

**Entradas usadas:** chave de 2048 bits gerada na hora.

```mermaid
sequenceDiagram
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: A chave pública é entregue a Bob
  n_alice->>n_bob: Chave pública
  Note over n_alice,n_eva: Eva intercepta a mensagem e a assinatura
  n_alice->>n_eva: (m, s)
  Note over n_alice,n_eva: Eva altera a mensagem e reenvia a Bob
  n_eva->>n_bob: [adulterada] (m', s)
```

*Figura 5.2.2 (sequência).* RSA-PSS com Eva adulterando: 3 mensagens (1 adulterada), entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice gera o par de chaves de assinatura | Geração do par de chaves RSA. |
| 2 | A chave pública é entregue a Bob | Distribuição da chave pública de Alice. |
| 3 | Alice escreve a mensagem | Definição da mensagem a assinar. |
| 4 | Alice assina com a chave privada | Assinatura RSA-PSS (SHA-256). |
| 5 | Eva intercepta a mensagem e a assinatura | Interceptação do par (m, s). |
| 6 | Eva altera a mensagem e reenvia a Bob | Reenvio de (m', s). |
| 7 | Bob recebe a mensagem e a assinatura | Recepção do par (m, s). |
| 8 | Bob verifica com a chave pública de Alice | Verificação RSA-PSS. |
| 9 | A assinatura é inválida | Conclusão da verificação. |

**Veredito do cenário:** Assinatura inválida: a mensagem recebida difere da assinada (basta um único bit). A verificação RSA-PSS rejeita a adulteração.

## 6. Perguntas de fixação

1. Por que a segurança do RSA depende da dificuldade de fatorar n, e não de manter n em segredo?

   **Resposta.** O módulo n é público. Quem fatora n = p × q calcula φ(n) = (p - 1)(q - 1) e, com isso, obtém d como inverso modular de e. A chave privada deixa de ser secreta. Por isso n precisa ser grande o bastante para tornar a fatoração inviável (2048 bits ou mais).

2. Com p = 61, q = 53 e e = 17, qual é o valor de d? Verifique que e·d ≡ 1 (mod φ(n)).

   **Resposta.** φ(n) = 60 × 52 = 3120 e d = 2753, pois 17 × 2753 = 46801 = 15 × 3120 + 1. Logo e·d ≡ 1 (mod 3120).

3. Por que o RSA sem padding é inseguro mesmo com chaves grandes?

   **Resposta.** Ele é determinístico (mesma mensagem, mesma cifra), permite ataques de dicionário, é maleável (c1 × c2 mod n cifra m1 × m2) e não detecta adulteração. Padrões como OAEP e PSS acrescentam aleatoriedade e verificações de integridade.

4. Qual a diferença entre cifrar com a chave pública e assinar com a chave privada?

   **Resposta.** Na cifragem, qualquer pessoa pode cifrar para o dono da chave e só ele decifra (confidencialidade). Na assinatura, só o dono da chave privada assina e qualquer pessoa verifica com a pública (autenticidade, integridade e não repúdio). A assinatura, por si só, não oculta a mensagem.

5. No modo real, por que a decifragem falha quando um único bit da cifra é alterado?

   **Resposta.** O RSA-OAEP embute um teste de integridade no bloco codificado: após a operação com a chave privada, o decodificador verifica a estrutura (hash do rótulo e separador). Uma cifra alterada produz um bloco sem essa estrutura e a operação é rejeitada.

## 7. Limitações e cuidados

- O modo didático não tem padding e usa números pequenos: é inseguro por construção.
- No modo real, as chaves são geradas no navegador e não são extraíveis; nada é armazenado.
- Uso exclusivamente didático: os laboratórios não devem proteger dados reais.

---

*CryptoNet é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
