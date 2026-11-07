# AES e modos de operação

As rodadas do AES operação por operação e a comparação de ECB, CBC, CTR e GCM diante de Eva, que observa e altera a cifra.

- **Categoria:** Criptografia Simétrica
- **Abrir o laboratório:** <https://peotta.github.io/CryptoNet/#/lab/aes>
- **Motor:** didático (ECB, CBC e CTR) e real (GCM, pela Web Crypto)
- **Código-fonte:** `src/labs/aes/` (interface e fluxos) e `src/crypto/aes.ts` (operações)
- **Padrões e referências:** [FIPS 197](https://csrc.nist.gov/pubs/fips/197/final) (AES); NIST [SP 800-38A](https://csrc.nist.gov/pubs/sp/800/38/a/final) (ECB, CBC e CTR) e [SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final) (GCM).

## 1. Objetivos de aprendizagem

- Descrever a estrutura do AES: bloco de 128 bits, chaves de 128, 192 e 256 bits, e as operações SubBytes, ShiftRows, MixColumns e AddRoundKey.
- Explicar confusão e difusão e identificar qual operação do AES contribui para cada propriedade.
- Diferenciar cifra de bloco de modo de operação, e justificar por que o modo importa tanto quanto o algoritmo.
- Observar o vazamento de padrões do ECB e a ausência dele em CBC, CTR e GCM.
- Mostrar o que um atacante (Eva) consegue fazer ao alterar bits da cifra em cada modo, sem conhecer a chave.
- Reconhecer o AES-GCM como criptografia autenticada (AEAD) e o papel do nonce.

## 2. Fundamentação

O AES opera em blocos de 16 bytes e repete rodadas de SubBytes, ShiftRows, MixColumns e AddRoundKey (10 rodadas com chave de 128 bits). O modo de operação define como os blocos se combinam: o ECB vaza padrões (blocos iguais geram cifras iguais), o CBC e o CTR os ocultam, mas só o GCM, um modo autenticado, detecta a adulteração por Eva.

**Artigos originais.**

- Daemen, J.; Rijmen, V. *AES Proposal: Rijndael*. Documento enviado ao NIST no concurso do AES, versão revista, 1999. [Acessar o documento (PDF, NIST)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/aes-development/rijndael-ammended.pdf).
- McGrew, D. A.; Viega, J. *The Security and Performance of the Galois/Counter Mode (GCM) of Operation*. In: INDOCRYPT 2004, Lecture Notes in Computer Science, v. 3348, p. 343-355. Springer, 2004. [Acessar o artigo (ePrint IACR 2004/193)](https://eprint.iacr.org/2004/193).

### 2.1 Diagramas da cifragem de um bloco e dos modos de operação

Os diagramas abaixo mostram o AES em uso, antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal e, quando indicado, altera a cifra. **K** é a chave secreta compartilhada, **P_i** é o bloco i do texto claro (16 bytes), **C_i** o bloco i da cifra, **E** a cifragem de um bloco com o AES e **D** a decifragem. A chave K foi combinada antes por um canal seguro.

#### 2.1.1 Cifragem de um bloco com as rodadas do AES (AES-128, 10 rodadas)

A chave é expandida em chaves de rodada. O bloco de 16 bytes entra em uma matriz de estado e recebe o AddRoundKey inicial. As rodadas 1 a 9 aplicam, em ordem, SubBytes (substituição não linear byte a byte pela caixa S), ShiftRows (deslocamento das linhas), MixColumns (mistura linear das colunas) e AddRoundKey (XOR com a chave da rodada). A rodada 10 é igual, mas sem MixColumns. Bob, que tem a mesma chave, aplica as operações inversas em ordem inversa e recupera o bloco. Uma única cifragem de bloco, sozinha, não define como cifrar uma mensagem longa: isso é papel do modo de operação.

```mermaid
sequenceDiagram
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
    B->>B: Recupera o bloco original
```

*Figura 2.1.1 (sequência).* Cifragem de um bloco com as rodadas do AES.

#### 2.1.2 Modo ECB: blocos iguais geram cifras iguais (o modo que vaza padrões)

No ECB, cada bloco é cifrado de forma independente, com a mesma chave: C_i = E(K, P_i). Dois blocos de texto claro iguais produzem dois blocos cifrados iguais, de modo que Eva enxerga a estrutura da mensagem mesmo sem decifrar (o exemplo clássico é a imagem cifrada em ECB cujo contorno continua visível). Como os blocos são independentes, Eva também pode trocar, repetir ou remover blocos, e Bob decifra tudo sem perceber. O ECB não deve ser usado para mensagens com mais de um bloco.

```mermaid
sequenceDiagram
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
    Note over B: Bob aceita o texto<br/>reordenado, sem erro algum
```

*Figura 2.1.2 (sequência).* Modo ECB: blocos iguais geram cifras iguais.

#### 2.1.3 Modo CBC: encadeamento com vetor de inicialização (cada bloco depende do anterior)

No CBC, Alice sorteia um vetor de inicialização (IV) imprevisível e cifra cada bloco após um XOR com a cifra anterior: C_i = E(K, P_i ⊕ C_(i-1)), com C_0 = IV. Blocos iguais deixam de gerar cifras iguais. Bob decifra cada bloco e aplica o XOR com a cifra anterior. Se Eva inverte um bit de C_i, o bloco P_i sai totalmente embaralhado e o bloco seguinte, P_(i+1), sofre a inversão do mesmo bit. O CBC oculta padrões, mas não autentica: a alteração passa sem que Bob receba um aviso.

```mermaid
sequenceDiagram
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
    Note over B: Nenhum erro é sinalizado:<br/>Eva alterou P2 de modo<br/>previsível
```

*Figura 2.1.3 (sequência).* Modo CBC: encadeamento com vetor de inicialização.

#### 2.1.4 Modo CTR: fluxo de chaves gerado pelo contador (cifra de fluxo construída com o AES)

No CTR, o AES não cifra o texto: cifra um contador, produzindo um fluxo de chaves que é combinado com o texto por XOR. Alice usa um nonce único por mensagem e um contador que cresce a cada bloco: C_i = P_i ⊕ E(K, nonce ‖ i). Bob gera o mesmo fluxo e repete o XOR. Não há preenchimento e os blocos podem ser calculados em paralelo. Mas, como a cifragem é um XOR, inverter um bit de C_i inverte o mesmo bit de P_i, e Eva faz mudanças previsíveis sem conhecer K. O nonce nunca pode se repetir com a mesma chave, pois a repetição revela P_1 ⊕ P_2.

```mermaid
sequenceDiagram
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
    Note over B: O bit j de P1' está<br/>invertido, sem aviso: o CTR<br/>é maleável
```

*Figura 2.1.4 (sequência).* Modo CTR: fluxo de chaves gerado pelo contador.

#### 2.1.5 Modo GCM: cifragem autenticada (a etiqueta detecta a adulteração)

O GCM combina o CTR, para a confidencialidade, com uma função de autenticação sobre o corpo finito GF(2^128) (GHASH), que produz uma etiqueta de autenticação. Alice usa um nonce único, cifra e calcula a etiqueta sobre a cifra e sobre os dados associados (cabeçalhos em claro, quando houver). Bob recalcula a etiqueta antes de liberar qualquer texto claro. Se Eva alterou um bit da cifra, do nonce ou dos dados associados, as etiquetas diferem e Bob rejeita a mensagem. O GCM é o modo recomendado quando se quer sigilo e integridade juntos, com o mesmo cuidado de nunca repetir o nonce com a mesma chave.

```mermaid
sequenceDiagram
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
    end
```

*Figura 2.1.5 (sequência).* Modo GCM: cifragem autenticada.

> **Aviso:** a partir deste ponto são apresentados os cenários para simulação em laboratório, com Alice, Bob e Eva como participantes.

## 3. Participantes

Alice e Bob são os participantes legítimos; Eva é a atacante (observadora passiva ou, quando há adulteração, ativa). As tabelas abaixo listam o que cada um mantém em cada cenário.

| Participante | Papel | Dados que pode guardar (tipo) |
| --- | --- | --- |
| Alice | Remetente | Chave K (segredo); Mensagem m (texto claro); IV ou nonce (parâmetro público); Cifra C (texto cifrado) |
| Bob | Destinatário | Chave K (segredo); Cifra recebida (texto cifrado); Resultado da decifragem (texto claro) |
| Eva | Atacante (observa e, se puder, altera o canal) | Cifra observada ou capturada (texto cifrado); Padrões nos blocos cifrados (parâmetro público); Cifra alterada C' (enviada a Bob) (texto cifrado); Chave K: desconhecida para Eva (segredo) |

## 4. Como ler os diagramas

Cada figura é um diagrama de sequência gerado a partir da mesma definição de protocolo que anima o laboratório: as colunas são os participantes, o tempo corre de cima para baixo e cada faixa horizontal é o início de uma etapa. Os valores numéricos e as chaves não aparecem aqui (são aleatórios ou dependem das entradas); eles são mostrados nas fórmulas do próprio laboratório.

- Seta cheia: mensagem enviada pelo canal, com o rótulo do que trafega.
- Número no início do rótulo: ordem da interação no diagrama, de cima para baixo.
- Botão Ampliar diagrama (no site): abre o diagrama em tela cheia, com zoom.
- `[adulterada]` no início do rótulo: a mensagem foi alterada em trânsito por Eva.
- Faixa com texto: título da etapa que começa naquele ponto.

**Lista de figuras**

- [Figura 5.1.1](#511-ecb-com-eva-alterando-um-bloco): ECB com Eva alterando um bloco
- [Figura 5.1.2](#512-cbc-com-eva-alterando-um-bloco): CBC com Eva alterando um bloco
- [Figura 5.1.3](#513-ctr-com-eva-alterando-um-bloco): CTR com Eva alterando um bloco
- [Figura 5.1.4](#514-gcm-com-eva-alterando-um-bloco): GCM com Eva alterando um bloco

## 5. Cenários

### 5.1 Modos de operação

#### 5.1.1 ECB com Eva alterando um bloco

**Entradas usadas:** modo ECB, chave de 128 bits aleatória.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: Eva intercepta a cifra
  n_alice->>n_eva: C
  Note over n_alice,n_eva: Eva inverte 1 bit do bloco 2 e reenvia a Bob
  n_eva->>n_bob: [adulterada] C'
```

*Figura 5.1.1 (sequência).* ECB com Eva alterando um bloco: 2 mensagens (1 adulterada), entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice e Bob compartilham a chave K | Nenhum cálculo: K já é conhecida por Alice e por Bob e nunca trafega. |
| 2 | Alice escreve a mensagem | Divisão da mensagem em blocos de 16 bytes. |
| 3 | Alice cifra com AES-128 no modo ECB | Cifragem AES-128-ECB. |
| 4 | Eva intercepta a cifra | Interceptação da cifra. |
| 5 | Eva inverte 1 bit do bloco 2 e reenvia a Bob | Inversão de 1 bit no bloco cifrado 2 e reenvio. |
| 6 | Bob recebe a cifra | Recepção da mensagem cifrada. |
| 7 | Bob decifra com a chave K | Decifragem AES-128-ECB. |
| 8 | A mensagem chega alterada, sem que Bob perceba | Comparação entre a mensagem enviada e a recuperada. |

**Veredito do cenário:** O bloco 2 foi decifrado como lixo e os demais permanecem íntegros. Bob não tem como perceber a adulteração: o ECB não autentica.

#### 5.1.2 CBC com Eva alterando um bloco

**Entradas usadas:** modo CBC, chave de 128 bits aleatória.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: Eva intercepta a cifra
  n_alice->>n_eva: (IV, C)
  Note over n_alice,n_eva: Eva inverte 1 bit do bloco 2 e reenvia a Bob
  n_eva->>n_bob: [adulterada] (IV, C')
```

*Figura 5.1.2 (sequência).* CBC com Eva alterando um bloco: 2 mensagens (1 adulterada), entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice e Bob compartilham a chave K | Nenhum cálculo: K já é conhecida por Alice e por Bob e nunca trafega. |
| 2 | Alice escreve a mensagem | Divisão da mensagem em blocos de 16 bytes. |
| 3 | Alice gera um IV aleatório | Sorteio do IV com gerador criptograficamente seguro. |
| 4 | Alice cifra com AES-128 no modo CBC | Cifragem AES-128-CBC. |
| 5 | Eva intercepta a cifra | Interceptação da cifra. |
| 6 | Eva inverte 1 bit do bloco 2 e reenvia a Bob | Inversão de 1 bit no bloco cifrado 2 e reenvio. |
| 7 | Bob recebe a cifra | Recepção da mensagem cifrada. |
| 8 | Bob decifra com a chave K | Decifragem AES-128-CBC. |
| 9 | A mensagem chega alterada, sem que Bob perceba | Comparação entre a mensagem enviada e a recuperada. |

**Veredito do cenário:** O bloco 2 virou lixo e o MESMO bit foi invertido no bloco 3: Eva controla a alteração do bloco seguinte (manipulação de bits). Bob não percebe, pois o CBC não autentica.

#### 5.1.3 CTR com Eva alterando um bloco

**Entradas usadas:** modo CTR, chave de 128 bits aleatória.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: Eva intercepta a cifra
  n_alice->>n_eva: (IV, C)
  Note over n_alice,n_eva: Eva inverte 1 bit do bloco 2 e reenvia a Bob
  n_eva->>n_bob: [adulterada] (IV, C')
```

*Figura 5.1.3 (sequência).* CTR com Eva alterando um bloco: 2 mensagens (1 adulterada), entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice e Bob compartilham a chave K | Nenhum cálculo: K já é conhecida por Alice e por Bob e nunca trafega. |
| 2 | Alice escreve a mensagem | Divisão da mensagem em blocos de 16 bytes. |
| 3 | Alice gera um nonce aleatório | Sorteio do nonce com gerador criptograficamente seguro. |
| 4 | Alice cifra com AES-128 no modo CTR | Cifragem AES-128-CTR. |
| 5 | Eva intercepta a cifra | Interceptação da cifra. |
| 6 | Eva inverte 1 bit do bloco 2 e reenvia a Bob | Inversão de 1 bit no bloco cifrado 2 e reenvio. |
| 7 | Bob recebe a cifra | Recepção da mensagem cifrada. |
| 8 | Bob decifra com a chave K | Decifragem AES-128-CTR. |
| 9 | A mensagem chega alterada, sem que Bob perceba | Comparação entre a mensagem enviada e a recuperada. |

**Veredito do cenário:** Exatamente o bit invertido por Eva mudou no texto claro: o CTR é maleável, e Eva altera a mensagem de forma controlada sem conhecer a chave. Bob não percebe.

#### 5.1.4 GCM com Eva alterando um bloco

**Entradas usadas:** modo GCM, chave de 128 bits aleatória.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: Eva intercepta a cifra
  n_alice->>n_eva: (nonce, C, tag)
  Note over n_alice,n_eva: Eva inverte 1 bit do bloco 2 e reenvia a Bob
  n_eva->>n_bob: [adulterada] (nonce, C', tag)
```

*Figura 5.1.4 (sequência).* GCM com Eva alterando um bloco: 2 mensagens (1 adulterada), entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice e Bob compartilham a chave K | Nenhum cálculo: K já é conhecida por Alice e por Bob e nunca trafega. |
| 2 | Alice escreve a mensagem | Divisão da mensagem em blocos de 16 bytes. |
| 3 | Alice gera um nonce aleatório | Sorteio do nonce com gerador criptograficamente seguro. |
| 4 | Alice cifra com AES-128 no modo GCM | Cifragem AES-128-GCM. |
| 5 | Eva intercepta a cifra | Interceptação da cifra. |
| 6 | Eva inverte 1 bit do bloco 2 e reenvia a Bob | Inversão de 1 bit no bloco cifrado 2 e reenvio. |
| 7 | Bob recebe a cifra | Recepção da mensagem cifrada. |
| 8 | Bob verifica a etiqueta e decifra | Verificação da etiqueta e decifragem AES-GCM. |
| 9 | A mensagem é rejeitada | Comparação entre a mensagem enviada e a recuperada. |

**Veredito do cenário:** Etiqueta de autenticação inválida: Bob rejeita a mensagem inteira. O GCM detecta qualquer adulteração da cifra.

## 6. Perguntas de fixação

1. Por que o AES, sozinho, não define como cifrar uma mensagem maior que 16 bytes?

   **Resposta.** O AES é uma cifra de bloco: transforma um bloco de 128 bits em outro, sob uma chave. Para mensagens maiores é preciso um modo de operação (ECB, CBC, CTR, GCM...) que defina como os blocos são encadeados, e essa escolha determina propriedades como vazamento de padrões e proteção de integridade.

2. Por que o ECB é considerado inseguro mesmo com o AES-256?

   **Resposta.** Porque cifra cada bloco de forma independente e determinística: blocos iguais geram cifras iguais. Quem observa a cifra vê a estrutura do texto claro (como o contorno de uma imagem), sem precisar da chave. A fraqueza está no modo, não no AES.

3. Eva inverte um bit do bloco 2 da cifra em CBC. O que acontece com os blocos 2 e 3 de texto claro?

   **Resposta.** O bloco 2 é decifrado como um valor aleatório (corrompido), e o mesmo bit é invertido no bloco 3, porque o texto claro do bloco 3 é o XOR da saída do AES com o bloco cifrado 2. Eva controla a alteração do bloco 3, e Bob não percebe, pois o CBC não autentica.

4. Por que reutilizar o nonce no CTR ou no GCM com a mesma chave é uma falha grave?

   **Resposta.** O fluxo de chaves seria idêntico nas duas mensagens: o XOR das duas cifras é igual ao XOR dos dois textos claros, o que permite análises e, com texto conhecido, a recuperação de uma das mensagens. No GCM, a repetição do nonce também compromete a chave de autenticação (GHASH).

5. O que o GCM oferece além da confidencialidade, e como Bob percebe uma adulteração?

   **Resposta.** Integridade e autenticidade (criptografia autenticada com dados associados, AEAD). A cifra vem acompanhada de uma etiqueta de 128 bits calculada com a chave; Bob a recalcula e, se não conferir, a operação falha e nenhuma mensagem é entregue. Eva não consegue produzir uma etiqueta válida sem a chave.

6. O IV do CBC precisa ser secreto? E precisa ser imprevisível?

   **Resposta.** Não precisa ser secreto (trafega junto com a cifra), mas deve ser imprevisível e aleatório a cada mensagem. IVs previsíveis permitem ataques, como o BEAST contra o TLS 1.0. Já o nonce de CTR e GCM precisa apenas ser único para cada chave.

## 7. Limitações e cuidados

- A implementação didática (ECB, CBC e CTR) não é resistente a ataques de canal lateral nem deve ser usada em produção.
- Não há preenchimento: a mensagem é completada com espaços até múltiplo de 16 bytes.
- Uso exclusivamente didático: os laboratórios não devem proteger dados reais.

---

*CryptoNet é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
