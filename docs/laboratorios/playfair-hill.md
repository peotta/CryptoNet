# Playfair e Hill

Cifras poligráficas: digrafos em uma grade 5 × 5 e multiplicação por matriz módulo 26, com o ataque de texto claro conhecido contra o Hill.

- **Categoria:** Criptografia Clássica
- **Abrir o laboratório:** <https://peotta.github.io/CryptoNet/#/lab/playfair-hill>
- **Motor:** didático (digrafos e matrizes módulo 26)
- **Código-fonte:** `src/labs/playfair-hill/` (interface e fluxos) e `src/crypto/playfair.ts e src/crypto/hill.ts` (operações)
- **Padrões e referências:** Playfair (Wheatstone, 1854) e Hill (1929); Livro de referência: Stallings, *Cryptography and Network Security*, cap. 3.

## 1. Objetivos de aprendizagem

- Montar a grade 5 × 5 do Playfair a partir de uma palavra-chave e aplicar as regras da linha, da coluna e do retângulo.
- Explicar por que cifrar pares de letras (digrafos) achata o histograma de letras e resiste à análise de frequência simples.
- Cifrar e decifrar com a cifra de Hill por multiplicação de matrizes módulo 26, e calcular a inversa da chave.
- Explicar por que o determinante da matriz-chave precisa ser coprimo com 26.
- Executar o ataque de texto claro conhecido contra o Hill (K = C · P⁻¹) e entender por que a linearidade o torna frágil.
- Reconhecer que nenhuma das duas cifras tem integridade e que ambas são cifras clássicas, sem segurança real.

## 2. Fundamentação

O Playfair cifra pares de letras (digrafos) sobre uma grade 5 × 5 montada com uma palavra-chave (I e J compartilham a célula). O Hill cifra blocos de n letras multiplicando-os por uma matriz n × n invertível módulo 26. O Hill é linear e, por isso, cai diante de um ataque de texto claro conhecido: com n pares independentes, Eva resolve a matriz.

**Artigos originais do Hill.** O Playfair, popularizado por Lord Playfair a partir de uma invenção de Charles Wheatstone (1854), não tem artigo original com cópia pública conferida.

- Hill, L. S. *Cryptography in an algebraic alphabet*. The American Mathematical Monthly, v. 36, n. 6, p. 306-312, 1929. [DOI 10.1080/00029890.1929.11986963](https://doi.org/10.1080/00029890.1929.11986963).
- Hill, L. S. *Concerning certain linear transformation apparatus of cryptography*. The American Mathematical Monthly, v. 38, n. 3, p. 135-154, 1931. [DOI 10.1080/00029890.1931.11987161](https://doi.org/10.1080/00029890.1931.11987161).

### 2.1 Diagramas do Playfair e do Hill

Os diagramas abaixo mostram as cifras antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal e, quando indicado, ataca a cifra. O último diagrama é um fluxograma das regras de cifragem de um par de letras no Playfair.

#### 2.1.1 Playfair: grade 5 por 5 e cifragem de digrafos (cifragem de pares de letras)

Alice e Bob montam a mesma grade 5 × 5 a partir de uma palavra-chave (I e J compartilham a célula). Alice divide o texto em pares de letras, separando letras iguais com um preenchimento, e cifra cada par conforme a posição na grade. Bob usa as regras inversas. Como cifra pares, o Playfair oculta as frequências de letras isoladas, mas preserva as de digrafos, o que Eva explora com bem mais texto.

```mermaid
sequenceDiagram
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
    B->>B: Aplica as regras inversas<br/>a cada par
```

*Figura 2.1.1 (sequência).* Playfair: grade 5 por 5 e cifragem de digrafos.

#### 2.1.2 Hill: a linearidade e o ataque de texto claro conhecido (C = K·P mod 26)

No Hill, blocos de n letras viram vetores e são multiplicados por uma matriz-chave K, n por n, invertível módulo 26: C = K·P. Bob usa K⁻¹. Por ser linear, a cifra cai diante de um ataque de texto claro conhecido: se Eva conhece n blocos de texto claro com as cifras correspondentes, monta a matriz P dos claros e a matriz C das cifras, e resolve K = C·P⁻¹ módulo 26. Com a chave, lê todo o tráfego.

```mermaid
sequenceDiagram
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
    Note over E: Com K, Eva decifra<br/>todo o tráfego
```

*Figura 2.1.2 (sequência).* Hill: a linearidade e o ataque de texto claro conhecido.

#### 2.1.3 Estrutura interna: regras do Playfair para um par de letras (fluxograma)

Cada par é cifrado conforme as posições das duas letras na grade: na mesma linha, cada letra é substituída pela da direita; na mesma coluna, pela de baixo (com retorno ao início); nos demais casos, formam-se os vértices de um retângulo e cada letra é trocada pela da mesma linha e da coluna da outra. Para decifrar, os deslocamentos são para a esquerda e para cima.

```mermaid
flowchart TD
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
    RET --> O
```

*Figura 2.1.3 (estrutura interna).* Estrutura interna: regras do Playfair para um par de letras.

> **Aviso:** a partir deste ponto são apresentados os cenários para simulação em laboratório, com Alice, Bob e Eva como participantes.

## 3. Participantes

Alice e Bob são os participantes legítimos; Eva é a atacante (observadora passiva ou, quando há adulteração, ativa). As tabelas abaixo listam o que cada um mantém em cada cenário.

| Participante | Papel | Dados que pode guardar (tipo) |
| --- | --- | --- |
| Alice | Remetente | Chave K (matriz 2 × 2) (segredo); Mensagem m (texto claro); Cifra C (texto cifrado) |
| Bob | Destinatário | Chave K (matriz 2 × 2) (segredo); Cifra recebida (texto cifrado); Mensagem recuperada (texto claro) |
| Eva | Criptoanalista (observa e, se puder, altera o canal) | Cifra observada ou capturada (texto cifrado); Estatísticas observadas por Eva (parâmetro público); Cifra alterada C' (enviada a Bob) (texto cifrado); Texto claro conhecido por Eva (texto claro); Chave deduzida por Eva (segredo) |

## 4. Como ler os diagramas

Cada figura é um diagrama de sequência gerado a partir da mesma definição de protocolo que anima o laboratório: as colunas são os participantes, o tempo corre de cima para baixo e cada faixa horizontal é o início de uma etapa. Os valores numéricos e as chaves não aparecem aqui (são aleatórios ou dependem das entradas); eles são mostrados nas fórmulas do próprio laboratório.

- Seta cheia: mensagem enviada pelo canal, com o rótulo do que trafega.
- Número no início do rótulo: ordem da interação no diagrama, de cima para baixo.
- Botão Ampliar diagrama (no site): abre o diagrama em tela cheia, com zoom.
- `[adulterada]` no início do rótulo: a mensagem foi alterada em trânsito por Eva.
- Faixa com texto: título da etapa que começa naquele ponto.

**Lista de figuras**

- [Figura 5.1.1](#511-playfair-com-a-palavra-chave-monarquia): Playfair com a palavra-chave MONARQUIA
- [Figura 5.2.1](#521-hill-2--2-e-ataque-de-texto-claro-conhecido): Hill 2 × 2 e ataque de texto claro conhecido

## 5. Cenários

### 5.1 Playfair

#### 5.1.1 Playfair com a palavra-chave MONARQUIA

**Entradas usadas:** palavra-chave MONARQUIA.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: A cifra atravessa o canal
  n_alice->>n_bob: Cifra C
```

*Figura 5.1.1 (sequência).* Playfair com a palavra-chave MONARQUIA: 1 mensagem, entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice e Bob combinam a palavra-chave | Nenhum cálculo: a chave já é conhecida por Alice e por Bob. |
| 2 | Alice prepara a mensagem em digrafos | Divisão em 197 digrafos. |
| 3 | Alice cifra cada digrafo pela grade | Cifragem de 197 digrafos com a grade. |
| 4 | A cifra atravessa o canal | Transmissão da cifra pelo canal público. |
| 5 | Eva tenta a análise de frequência | Cálculo do IC e da frequência de digrafos da cifra. |
| 6 | Bob recebe a cifra | Recepção da mensagem cifrada. |
| 7 | Bob decifra pela regra inversa | Decifragem Playfair. |
| 8 | Eva não lê a mensagem só com a frequência de letras | Avaliação do resultado. |

**Veredito do cenário:** A frequência de letras isolada não revela a mensagem: o IC da cifra é 0,0567 (português: 0,0745) e o histograma é achatado. Eva precisaria de análise de digrafos com centenas de letras, de palavras prováveis ou de texto claro conhecido. O Playfair foi usado em campo por décadas, mas não é seguro: é quebrado por esses métodos, e por computador.

### 5.2 Hill

#### 5.2.1 Hill 2 × 2 e ataque de texto claro conhecido

**Entradas usadas:** matriz [3 3; 2 5], 24 letras conhecidas.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: A cifra atravessa o canal
  n_alice->>n_bob: Cifra C
```

*Figura 5.2.1 (sequência).* Hill 2 × 2 e ataque de texto claro conhecido: 1 mensagem, entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice e Bob combinam a matriz-chave | Nenhum cálculo: a chave já é conhecida por Alice e por Bob. |
| 2 | Alice prepara a mensagem em blocos | Divisão em 35 blocos de 2 letras. |
| 3 | Alice multiplica cada bloco pela matriz | C = K · P (mod 26), bloco a bloco. |
| 4 | A cifra atravessa o canal | Transmissão da cifra pelo canal público. |
| 5 | Eva resolve a chave com texto claro conhecido | Resolução de K = C · P⁻¹ com 2 blocos independentes. |
| 6 | Bob recebe a cifra | Recepção da mensagem cifrada. |
| 7 | Bob multiplica pela inversa da chave | Decifragem: P = K⁻¹ · C (mod 26). |
| 8 | A cifra foi quebrada por Eva | Avaliação do resultado. |

**Veredito do cenário:** Eva montou o sistema C = K · P com 2 blocos independentes e o resolveu: K = C · P⁻¹ (mod 26). Obteve a chave exata [3 3; 2 5] conhecendo apenas 24 letras do texto claro. A cifra de Hill é linear, e a linearidade é a sua fraqueza.

## 6. Perguntas de fixação

1. Cifre "HI" com o Playfair e a chave "PLAYFAIR EXAMPLE". Qual a regra aplicada?

   **Resposta.** A grade é PLAYF / IREXM / BCDGH / KNOQS / TUVWZ. H está na linha 3, coluna 5 e I na linha 2, coluna 1: linhas e colunas diferentes, regra do retângulo. H é trocada pela letra da sua linha na coluna de I (B) e I pela letra da sua linha na coluna de H (M). O resultado é "BM".

2. Por que o Playfair resiste à análise de frequência que quebra a substituição simples?

   **Resposta.** Porque cifra pares de letras: a mesma letra clara vira letras cifradas diferentes conforme a vizinha, e o histograma de letras fica achatado (o IC cai bastante, de cerca de 0,07 para cerca de 0,05). As estatísticas de digrafos existem, mas são cerca de 600 possíveis em vez de 26, e exigem muito mais texto cifrado para aparecer.

3. Por que o Playfair não é seguro, apesar disso?

   **Resposta.** Digrafos repetidos no texto claro geram digrafos repetidos na cifra, e a estrutura da língua (digrafos como "ES", "DE", "OS") sobrevive. Com algumas centenas de letras, análise de digrafos, palavras prováveis ou busca por computador recuperam a grade. Também vale o padrão inverso: se AB vira CD, então BA vira DC.

4. Por que o determinante da matriz do Hill precisa ser coprimo com 26?

   **Resposta.** Para a matriz ter inversa módulo 26: K⁻¹ = (det K)⁻¹ · adj(K), e o inverso de det K módulo 26 só existe se mdc(det K, 26) = 1. Sem inversa, Bob não consegue decifrar e blocos diferentes poderiam gerar a mesma cifra.

5. Como Eva quebra o Hill 2 × 2 conhecendo 4 letras do texto claro?

   **Resposta.** Dois blocos de texto claro P1 e P2 e as cifras C1 e C2 satisfazem C = K · P, em que as colunas de P e de C são os blocos. Se P é inversível módulo 26, então K = C · P⁻¹. Ela calcula P⁻¹ (inverso do determinante vezes a adjunta) e multiplica. A linearidade do Hill é a sua fraqueza.

6. Por que às vezes o ataque ao Hill precisa de mais texto claro conhecido do que o mínimo?

   **Resposta.** Porque os blocos conhecidos precisam formar uma matriz P inversível módulo 26. Dependendo das letras, o determinante pode ser par ou múltiplo de 13 e P não tem inversa (por exemplo, blocos repetidos). Com mais blocos, Eva escolhe outros que sejam independentes.

7. O Hill difunde cada letra por todo o bloco. Isso o protege contra adulteração?

   **Resposta.** Não. Se Eva altera uma letra da cifra, o bloco inteiro de n letras é decifrado errado (difusão), mas Bob não tem como perceber: não há verificação de integridade. Só cifras autenticadas, como o AES-GCM, detectam a alteração.

## 7. Limitações e cuidados

- Cifras históricas: não oferecem segurança.
- O Hill aceita matrizes 2 × 2 e 3 × 3; o ataque exige blocos independentes (determinante invertível módulo 26).
- Uso exclusivamente didático: os laboratórios não devem proteger dados reais.

## 8. Glossário

Significado e finalidade das siglas usadas neste documento.

| Sigla | Significado | Para que serve |
| --- | --- | --- |
| **AES-GCM** | AES no modo Galois/Counter | cifra autenticada de uso corrente no TLS e em armazenamento: cifra e detecta alteração com a mesma chave |
| **DOI** | Digital Object Identifier, identificador de objeto digital | identificador permanente de uma publicação, que leva ao artigo pelo endereço doi.org |
| **IC** | Índice de Coincidência (Index of Coincidence) | probabilidade de duas letras sorteadas do texto serem iguais; distingue um texto de substituição simples de um polialfabético |


---

*CryptoNet é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
