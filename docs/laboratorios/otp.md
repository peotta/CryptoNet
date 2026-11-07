# One-time pad

Sigilo perfeito de Shannon, a maleabilidade e a destruição do sigilo quando a chave é reutilizada, com o arrasto de texto provável de Eva.

- **Categoria:** Criptografia Clássica
- **Abrir o laboratório:** <https://peotta.github.io/CryptoNet/#/lab/otp>
- **Motor:** didático (soma módulo 26)
- **Código-fonte:** `src/labs/otp/` (interface e fluxos) e `src/crypto/otp.ts` (operações)
- **Padrões e referências:** Shannon, *Communication Theory of Secrecy Systems* (1949): sigilo perfeito; Vernam (1917) e Mauborgne.

## 1. Objetivos de aprendizagem

- Cifrar e decifrar com o one-time pad por soma e subtração módulo 26, e relacioná-lo ao XOR dos bits.
- Enunciar as quatro condições do sigilo perfeito: chave aleatória, tão longa quanto a mensagem, de uso único e secreta.
- Demonstrar o sigilo perfeito: para qualquer texto de mesmo tamanho existe uma chave que leva a cifra a ele.
- Mostrar por que reutilizar a chave a destrói: a diferença das duas cifras elimina a chave.
- Executar o arrasto de texto provável (crib dragging) e entender por que um único trecho acertado vaza a chave.
- Reconhecer que o one-time pad não protege a integridade (é maleável) e o custo prático de distribuir chaves tão longas.

## 2. Fundamentação

O one-time pad soma a mensagem a uma chave verdadeiramente aleatória, do tamanho da mensagem e usada uma única vez. Nessas condições o sigilo é perfeito: o texto cifrado não revela nada além do tamanho. A cifra é maleável (Eva altera o claro sem conhecer a chave) e, se a chave for reutilizada, a soma das duas cifras elimina a chave e expõe a soma dos claros, que Eva explora com o arrasto de texto provável (como no projeto Venona).

**Artigos originais.**

- Shannon, C. E. *Communication theory of secrecy systems*. Bell System Technical Journal, v. 28, n. 4, p. 656-715, out. 1949. [Acessar o artigo (Internet Archive)](https://archive.org/details/bstj28-4-656); [PDF hospedado pela Universidade de Virgínia](https://www.cs.virginia.edu/~evans/greatworks/shannon1949.pdf).
- Vernam, G. S. *Secret signaling system*. Patente US 1.310.719, 1919, origem da cifra com chave de uso único. [Acessar a patente (Google Patents)](https://patents.google.com/patent/US1310719A/en).

### 2.1 Diagramas do one-time pad e do seu uso incorreto

Os diagramas abaixo mostram o one-time pad antes dos cenários executados da seção 5. Alice cifra, Bob decifra e Eva observa o canal e, quando indicado, altera a cifra ou explora a reutilização da chave. **K** é a chave aleatória do tamanho da mensagem, **P** o texto claro e **C** a cifra. O último diagrama é um fluxograma do ciclo de vida da chave.

#### 2.1.1 Sigilo perfeito e a maleabilidade da cifra (uso correto)

Alice e Bob possuem a mesma chave K, verdadeiramente aleatória, do tamanho da mensagem. Alice soma K ao claro letra a letra (módulo 26) e Bob subtrai K da cifra para recuperar a mensagem. Eva vê apenas C: como qualquer texto de mesmo tamanho é compatível com alguma chave, a cifra não revela nada além do tamanho, e esta é a propriedade que Shannon chamou de sigilo perfeito. Mesmo assim a cifra é maleável: se Eva soma 1 a uma letra da cifra, Bob obtém o claro com aquela letra somada de 1, sem que a chave seja conhecida por Eva.

```mermaid
sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: K aleatória, do tamanho<br/>da mensagem, combinada antes
    A->>A: Ci = (Pi + Ki) mod 26
    A->>E: C pelo canal público
    Note over E: Qualquer claro de mesmo<br/>tamanho é compatível<br/>com alguma chave
    E->>B: C' com uma letra somada de 1
    B->>B: Pi' = (C'i - Ki) mod 26
    Note over B: A letra alterada sai<br/>somada de 1 no claro
```

*Figura 2.1.1 (sequência).* Sigilo perfeito e a maleabilidade da cifra.

#### 2.1.2 Reutilização da chave (two-time pad) (a mesma K em duas mensagens)

Alice usa a mesma chave K em duas mensagens P1 e P2. Eva captura C1 e C2 e subtrai uma da outra: a chave se cancela e sobra P1 - P2 (módulo 26), a diferença dos dois claros. Eva arrasta um texto provável sobre essa diferença e, onde o palpite acerta, aparece o trecho correspondente da outra mensagem. Foi assim que o projeto Venona decifrou parte do tráfego soviético, produzido com blocos de chaves repetidos. Bob decifra normalmente e não detecta nada. A chave de uso único só é segura se for usada uma vez.

```mermaid
sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: A mesma K<br/>nas duas mensagens
    A->>A: C1 = P1 + K, mod 26
    A->>A: C2 = P2 + K, mod 26
    A->>E: C1
    A->>E: C2
    E->>E: C1 - C2 = P1 - P2
    Note over E: A chave K<br/>se cancelou
    E->>E: Arrasta um texto provável<br/>sobre P1 - P2
    Note over E: Onde o palpite acerta,<br/>surge texto legível<br/>da outra mensagem
    E->>B: C1 e C2 seguem a Bob
    B->>B: Decifra normalmente
```

*Figura 2.1.2 (sequência).* Reutilização da chave (two-time pad).

#### 2.1.3 Ciclo de vida da chave de uso único (fluxograma)

A segurança do one-time pad está inteira no tratamento da chave. Ela deve vir de uma fonte verdadeiramente aleatória, ter pelo menos o tamanho da mensagem, ser entregue a Alice e a Bob por um meio seguro antes da comunicação e ser destruída logo depois do uso. O fluxograma mostra o caminho correto e o desvio perigoso: reutilizar uma chave já gasta leva ao two-time pad do diagrama anterior.

```mermaid
flowchart TD
    G["Gera a chave com fonte verdadeiramente aleatória"] --> L["Tamanho da chave igual ou maior que o da mensagem"]
    L --> D["Entrega a Alice e a Bob por meio seguro"]
    D --> U{"A chave já foi usada?"}
    U -->|"não"| EN["Alice cifra: C = P + K, módulo 26"]
    EN --> DE["Bob decifra: P = C - K, módulo 26"]
    DE --> X["Destrói a chave nos dois lados"]
    U -->|"sim"| R["Reutilização: Eva obtém P1 - P2"]
    R --> F["Sigilo perfeito perdido"]
```

*Figura 2.1.3 (estrutura interna).* Ciclo de vida da chave de uso único.

> **Aviso:** a partir deste ponto são apresentados os cenários para simulação em laboratório, com Alice, Bob e Eva como participantes.

## 3. Participantes

Alice e Bob são os participantes legítimos; Eva é a atacante (observadora passiva ou, quando há adulteração, ativa). As tabelas abaixo listam o que cada um mantém em cada cenário.

| Participante | Papel | Dados que pode guardar (tipo) |
| --- | --- | --- |
| Alice | Remetente | Chave (pad) K (segredo); Mensagem m (texto claro); Cifra C (texto cifrado); Mensagem 1 (texto claro); Mensagem 2 (texto claro); Cifra 1 (com K) (texto cifrado); Cifra 2 (com a MESMA K) (texto cifrado) |
| Bob | Destinatário | Chave (pad) K (segredo); Cifra recebida (texto cifrado); Mensagem recuperada (texto claro); Cifra 1 recebida (texto cifrado); Cifra 2 recebida (texto cifrado); Mensagem 1 recuperada (texto claro); Mensagem 2 recuperada (texto claro) |
| Eva | Criptoanalista (observa e, se puder, altera o canal) | Cifra observada ou capturada (texto cifrado); Texto candidato testado (hipótese) (texto claro); Chave que levaria a esse candidato (parâmetro público); Cifra alterada C' (enviada a Bob) (texto cifrado); Cifra 1 observada (texto cifrado); Cifra 2 observada (texto cifrado); Diferença D = C2 − C1 (parâmetro público); Fragmento da outra mensagem (texto claro); Fragmento da chave (segredo) |

## 4. Como ler os diagramas

Cada figura é um diagrama de sequência gerado a partir da mesma definição de protocolo que anima o laboratório: as colunas são os participantes, o tempo corre de cima para baixo e cada faixa horizontal é o início de uma etapa. Os valores numéricos e as chaves não aparecem aqui (são aleatórios ou dependem das entradas); eles são mostrados nas fórmulas do próprio laboratório.

- Seta cheia: mensagem enviada pelo canal, com o rótulo do que trafega.
- Número no início do rótulo: ordem da interação no diagrama, de cima para baixo.
- Botão Ampliar diagrama (no site): abre o diagrama em tela cheia, com zoom.
- `[adulterada]` no início do rótulo: a mensagem foi alterada em trânsito por Eva.
- Faixa com texto: título da etapa que começa naquele ponto.

**Lista de figuras**

- [Figura 5.1.1](#511-sigilo-perfeito): Sigilo perfeito
- [Figura 5.2.1](#521-two-time-pad-e-arrasto-de-texto-provável): Two-time pad e arrasto de texto provável

## 5. Cenários

### 5.1 Uso correto

#### 5.1.1 Sigilo perfeito

**Entradas usadas:** chave aleatória do tamanho da mensagem.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: A cifra atravessa o canal
  n_alice->>n_bob: Cifra C
```

*Figura 5.1.1 (sequência).* Sigilo perfeito: 1 mensagem, entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice e Bob possuem a mesma chave aleatória | Nenhum cálculo: a chave já é conhecida por Alice e por Bob. |
| 2 | Alice escreve a mensagem | Normalização do texto em letras de A a Z. |
| 3 | Alice soma a chave à mensagem, letra a letra | Soma módulo 26 de 39 letras. |
| 4 | A cifra atravessa o canal | Transmissão da cifra pelo canal público. |
| 5 | Eva testa um texto candidato e descobre que nada o descarta | Cálculo da chave K′ = C − T para o texto candidato T. |
| 6 | Bob recebe a cifra | Recepção da mensagem cifrada. |
| 7 | Bob subtrai a chave da cifra | Subtração módulo 26. |
| 8 | Eva não aprende nada sobre o conteúdo | Avaliação do resultado. |

**Veredito do cenário:** Eva não aprendeu nada além do tamanho da mensagem (39 letras): para o candidato que ela testou existe a chave HXUQFLDEJMTPSD…, tão aleatória quanto a verdadeira, e o mesmo vale para qualquer outro dos ≈ 1,52 × 10^55 textos possíveis. É o sigilo perfeito de Shannon. Ele depende de a chave ser aleatória, do tamanho da mensagem, usada uma única vez e secreta, e não protege a integridade.

### 5.2 Reutilização da chave

#### 5.2.1 Two-time pad e arrasto de texto provável

**Entradas usadas:** duas mensagens com a mesma chave, texto provável AMANHECER.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: A cifra 1 atravessa o canal
  n_alice->>n_bob: Cifra 1
  Note over n_alice,n_eva: A cifra 2 atravessa o canal
  n_alice->>n_bob: Cifra 2
```

*Figura 5.2.1 (sequência).* Two-time pad e arrasto de texto provável: 2 mensagens, entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice e Bob possuem a mesma chave aleatória | Nenhum cálculo: a chave já é conhecida por Alice e por Bob. |
| 2 | Alice escreve duas mensagens | Normalização dos dois textos. |
| 3 | Alice cifra a mensagem 1 com a chave K | C1 = P1 + K (mod 26). |
| 4 | Alice cifra a mensagem 2 com a MESMA chave K | C2 = P2 + K (mod 26), com o mesmo K. |
| 5 | A cifra 1 atravessa o canal | Transmissão da cifra 1. |
| 6 | A cifra 2 atravessa o canal | Transmissão da cifra 2. |
| 7 | Eva subtrai as duas cifras: a chave desaparece | Diferença módulo 26 das duas cifras (região comum de 97 letras). |
| 8 | Eva arrasta o texto provável "AMANHECER" | Arrasto do texto provável em 89 posições, ordenadas pela legibilidade do trecho. |
| 9 | Bob recebe as duas cifras | Recepção das mensagens cifradas. |
| 10 | Bob decifra a mensagem 1 | P1 = C1 − K (mod 26). |
| 11 | Bob decifra a mensagem 2 | P2 = C2 − K (mod 26). |
| 12 | O sigilo perfeito foi destruído pela reutilização | Avaliação do resultado. |

**Veredito do cenário:** Reutilizar a chave destruiu o sigilo: D = C2 − C1 = P2 − P1 não contém a chave. Eva arrastou o texto provável "AMANHECER" e, na posição 26, obteve o fragmento "ROFESSORE" da mensagem 2 e o fragmento "PZZQZIPMT" da chave. Com o fragmento da chave, ela lê as duas mensagens nesse trecho e continua estendendo, adivinhando palavras vizinhas. Foi assim que o projeto Venona decifrou mensagens soviéticas.

## 6. Perguntas de fixação

1. Cifre "HELLO" com a chave "XMCKL" por soma módulo 26. Qual é a cifra?

   **Resposta.** H+X = 7+23 = 30 ≡ 4 (E); E+M = 4+12 = 16 (Q); L+C = 11+2 = 13 (N); L+K = 11+10 = 21 (V); O+L = 14+11 = 25 (Z). A cifra é "EQNVZ". Para decifrar, subtrai-se a chave.

2. O que é o sigilo perfeito e por que o one-time pad o possui?

   **Resposta.** Sigilo perfeito (Shannon, 1949) significa que a cifra não revela informação alguma sobre o texto claro: P(M = m | C = c) = P(M = m). No one-time pad, com chave uniforme, para qualquer texto de mesmo tamanho existe exatamente uma chave que leva a cifra a ele, e todas são igualmente prováveis. Eva só aprende o tamanho da mensagem.

3. Por que a chave precisa ser tão longa quanto a mensagem?

   **Resposta.** Se a chave for menor e for repetida, o texto cifrado passa a ter periodicidade, e Eva usa Kasiski e frequência por coluna, como na Vigenère. Com uma chave curta, não há mais uma chave para cada texto possível, e o sigilo perfeito se perde. A prova de Shannon exige que o número de chaves seja pelo menos igual ao número de mensagens.

4. O que acontece quando a mesma chave cifra duas mensagens, e como Eva se aproveita?

   **Resposta.** A diferença das cifras elimina a chave: C2 − C1 = P2 − P1. Eva passa a trabalhar com uma relação entre dois textos em português. Ela desliza um texto provável pelas posições (arrasto de texto provável): onde acerta, o trecho correspondente da outra mensagem aparece legível, e o fragmento de chave (C − P) vaza. Estendendo o trecho, ela lê as duas mensagens. O projeto Venona decifrou parte do tráfego soviético porque pads foram reutilizados.

5. O one-time pad garante integridade? Dê um exemplo de ataque.

   **Resposta.** Não. A cifra é maleável: somar d a uma letra da cifra soma d à mesma letra do texto claro, sem que Eva conheça a chave. Se Eva sabe que a mensagem diz "PAGAR 100" na posição X, ela pode trocar o 1 por 9 e Bob decifrará "PAGAR 900" sem qualquer erro. Por isso o sigilo precisa ser combinado com autenticação (como um HMAC ou o GCM).

6. Se o one-time pad é perfeitamente seguro, por que quase não é usado?

   **Resposta.** Porque o custo prático é enorme: a chave deve ser sorteada por uma fonte realmente aleatória, ser tão longa quanto todo o tráfego, distribuída previamente por um canal seguro e nunca reutilizada (o que exige descartar cada trecho usado). A criptografia moderna substitui isso por chaves curtas e cifras de fluxo, como o AES-CTR, cujo fluxo de chaves é pseudoaleatório: a segurança passa a ser computacional, e não perfeita.

## 7. Limitações e cuidados

- O laboratório usa o alfabeto de 26 letras; o one-time pad real opera sobre bits e exige distribuição segura de chaves tão longas quanto os dados.
- Uso exclusivamente didático: os laboratórios não devem proteger dados reais.

## 8. Glossário

Significado e finalidade das siglas usadas neste documento.

| Sigla | Significado | Para que serve |
| --- | --- | --- |
| **AES-CTR** | AES no modo contador | cifra de fluxo construída com o AES; não autentica a mensagem |
| **GCM** | Galois/Counter Mode, modo de Galois com contador | modo de operação que cifra em modo contador e autentica com um hash universal; é um modo AEAD ([SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final)) |
| **HMAC** | Keyed-Hash Message Authentication Code, código de autenticação de mensagem com chave | autentica uma mensagem com uma chave secreta e uma função de hash ([RFC 2104](https://www.rfc-editor.org/rfc/rfc2104)) |
| **PDF** | Portable Document Format, formato de documento portátil | formato de arquivo das cópias dos artigos citados |
| **XOR** | Exclusive OR, ou exclusivo | operação bit a bit que combina o texto claro com o fluxo de chave e é a sua própria inversa |


---

*CryptoNet é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
