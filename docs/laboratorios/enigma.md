# Máquina Enigma

Enigma I: rotores, refletor, anéis e plugues, o caminho do sinal tecla a tecla e a criptoanálise de Eva por texto provável.

- **Categoria:** Criptografia Clássica
- **Abrir o laboratório:** <https://peotta.github.io/CryptoNet/#/lab/enigma>
- **Motor:** didático (Enigma I)
- **Código-fonte:** `src/labs/enigma/` (interface e fluxos) e `src/crypto/enigma.ts` (operações)
- **Padrões e referências:** Enigma I do Exército alemão (Wehrmacht), rotores I a V e refletores B e C; Rejewski, Turing e Welchman: criptoanálise por texto provável.

## 1. Objetivos de aprendizagem

- Descrever os componentes da Enigma I: teclado, painel de plugues, três rotores, refletor e lâmpadas.
- Acompanhar o caminho do sinal por uma tecla: ida pelos rotores, reflexão e volta.
- Explicar o avanço dos rotores, inclusive o passo duplo do rotor do meio, e por que a cifra é polialfabética.
- Explicar por que a Enigma é recíproca e por que nenhuma letra é cifrada em si mesma.
- Calcular o tamanho do espaço de chaves e relacioná-lo à segurança que se imaginava.
- Usar um texto provável (crib) e a fraqueza do refletor para descartar hipóteses, como fizeram os criptoanalistas aliados.

## 2. Fundamentação

A Enigma I cifra tecla a tecla: o sinal atravessa o painel de plugues, três rotores, o refletor e volta. O refletor torna a máquina recíproca (decifrar é cifrar de novo), mas impede que uma letra seja cifrada nela mesma, e essa fraqueza permite a Eva descartar alinhamentos de um texto provável (crib). Com 3 rotores escolhidos entre 5, 17.576 posições iniciais e 10 pares de plugues, há cerca de 1,6 × 10²⁰ configurações.

**Artigos originais e documento histórico.**

- Rejewski, M. *An application of the theory of permutations in breaking the Enigma cipher*. Applicationes Mathematicae, v. 16, n. 4, p. 543-559, 1980. [Acessar o artigo (PDF digitalizado, Crypto Cellar)](https://cryptocellar.org/enigma/files/rew80.pdf); [DOI 10.4064/am-16-4-543-559](https://doi.org/10.4064/am-16-4-543-559).
- Turing, A. M. *Mathematical theory of ENIGMA machine* (o "Prof's Book", ou *Treatise on the Enigma*), c. 1939-1942. The National Archives, Reino Unido, HW 25/3. [Registro no catálogo do National Archives](https://beta.nationalarchives.gov.uk/catalogue/id/C6136633).

### 2.1 Diagramas da Enigma e do ataque por texto provável

Os diagramas abaixo mostram a Enigma I antes dos cenários executados da seção 5. Alice cifra, Bob decifra com uma máquina na mesma configuração e Eva observa o canal. A **configuração** reúne a ordem dos três rotores, a posição inicial de cada um e as ligações do painel de plugues. O último diagrama é um fluxograma do caminho do sinal elétrico.

#### 2.1.1 Cifragem tecla a tecla e reciprocidade (a máquina é recíproca)

Alice e Bob ajustam suas máquinas com a mesma configuração. A cada tecla pressionada o rotor da direita avança antes de o sinal passar, de modo que a substituição muda a cada letra. Por causa do refletor, que devolve o sinal por outro caminho, a máquina é recíproca: se com uma posição o sinal A vira L, nessa mesma posição L vira A. Assim, Bob decifra digitando a cifra em sua máquina, ajustada igual. Uma consequência do refletor é que nenhuma letra é cifrada nela mesma.

```mermaid
sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    Note over A,B: Mesma configuração:<br/>rotores, posições e plugues
    A->>A: Cada tecla avança os rotores<br/>e acende a letra cifrada
    A->>E: Mensagem cifrada pelo rádio
    Note over E: Eva intercepta<br/>a mensagem cifrada
    E->>B: Mensagem cifrada segue a Bob
    B->>B: Digita a cifra na máquina<br/>ajustada igual
    Note over B: A reciprocidade devolve<br/>o texto claro
```

*Figura 2.1.1 (sequência).* Cifragem tecla a tecla e reciprocidade.

#### 2.1.2 Eva usa um texto provável para descartar posições (a letra nunca vira ela mesma)

Eva supõe que a mensagem contém um trecho conhecido (um texto provável, ou *crib*, como um cabeçalho padronizado) e o alinha com a cifra em cada posição possível. Se, em algum alinhamento, uma letra do trecho coincidir com a letra cifrada na mesma posição, esse alinhamento é impossível, pois a Enigma nunca cifra uma letra nela mesma. Os alinhamentos que sobram são os candidatos, e a posição correta do texto provável serve de entrada para o ataque da Bombe.

```mermaid
sequenceDiagram
    autonumber
    participant A as Alice
    participant B as Bob
    participant E as Eva
    A->>E: Mensagem cifrada pelo rádio
    Note over E: Eva supõe um trecho<br/>conhecido (crib)
    loop Para cada alinhamento do crib
        E->>E: Alguma letra coincide<br/>com a cifra?
        E->>E: Se sim, descarta<br/>o alinhamento
    end
    Note over E: Os alinhamentos restantes<br/>são os candidatos
    E->>B: Mensagem cifrada segue a Bob
```

*Figura 2.1.2 (sequência).* Eva usa um texto provável para descartar posições.

#### 2.1.3 Estrutura interna: caminho do sinal na Enigma I (fluxograma)

Ao pressionar uma tecla, o rotor da direita avança (e, em posições determinadas, também o do meio e o da esquerda) e o circuito se fecha. O sinal atravessa o painel de plugues, os três rotores da direita para a esquerda, chega ao refletor, volta pelos três rotores da esquerda para a direita, passa de novo pelo painel de plugues e acende a lâmpada da letra cifrada. O refletor liga as letras em pares, o que torna a máquina recíproca.

```mermaid
flowchart TD
    TK["Tecla pressionada"] --> AV["Os rotores avançam antes de o circuito fechar"]
    AV --> PL1["Painel de plugues"]
    PL1 --> RD["Rotor da direita"]
    RD --> RM["Rotor do meio"]
    RM --> RE["Rotor da esquerda"]
    RE --> REF["Refletor: liga as letras em pares"]
    REF --> RE2["Rotor da esquerda, em sentido inverso"]
    RE2 --> RM2["Rotor do meio, em sentido inverso"]
    RM2 --> RD2["Rotor da direita, em sentido inverso"]
    RD2 --> PL2["Painel de plugues"]
    PL2 --> LM["Lâmpada da letra cifrada"]
```

*Figura 2.1.3 (estrutura interna).* Estrutura interna: caminho do sinal na Enigma I.

> **Aviso:** a partir deste ponto são apresentados os cenários para simulação em laboratório, com Alice, Bob e Eva como participantes.

## 3. Participantes

Alice e Bob são os participantes legítimos; Eva é a atacante (observadora passiva ou, quando há adulteração, ativa). As tabelas abaixo listam o que cada um mantém em cada cenário.

| Participante | Papel | Dados que pode guardar (tipo) |
| --- | --- | --- |
| Alice | Operadora (transmissora) | Configuração do dia (segredo); Mensagem m (texto claro); Cifra C (texto cifrado) |
| Bob | Operador (receptor) | Configuração do dia (segredo); Cifra recebida (texto cifrado); Mensagem recuperada (texto claro) |
| Eva | Criptoanalista (observa e, se puder, altera o canal) | Cifra observada ou capturada (texto cifrado); Alinhamentos do texto provável (parâmetro público); Cifra alterada C' (enviada a Bob) (texto cifrado) |

## 4. Como ler os diagramas

Cada figura é um diagrama de sequência gerado a partir da mesma definição de protocolo que anima o laboratório: as colunas são os participantes, o tempo corre de cima para baixo e cada faixa horizontal é o início de uma etapa. Os valores numéricos e as chaves não aparecem aqui (são aleatórios ou dependem das entradas); eles são mostrados nas fórmulas do próprio laboratório.

- Seta cheia: mensagem enviada pelo canal, com o rótulo do que trafega.
- Número no início do rótulo: ordem da interação no diagrama, de cima para baixo.
- Botão Ampliar diagrama (no site): abre o diagrama em tela cheia, com zoom.
- `[adulterada]` no início do rótulo: a mensagem foi alterada em trânsito por Eva.
- Faixa com texto: título da etapa que começa naquele ponto.

**Lista de figuras**

- [Figura 5.1.1](#511-cifragem-reciprocidade-e-texto-provável): Cifragem, reciprocidade e texto provável

## 5. Cenários

### 5.1 Alice, Bob e Eva

#### 5.1.1 Cifragem, reciprocidade e texto provável

**Entradas usadas:** rotores I II III, refletor B, posições KLM, 10 plugues, texto provável RELATORIO.

```mermaid
sequenceDiagram
  autonumber
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: A cifra atravessa o canal
  n_alice->>n_bob: Cifra C
```

*Figura 5.1.1 (sequência).* Cifragem, reciprocidade e texto provável: 1 mensagem, entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice e Bob ajustam a configuração do dia | Nenhum cálculo: a configuração já é conhecida por Alice e por Bob. |
| 2 | Alice escreve a mensagem | Normalização do texto em letras de A a Z. |
| 3 | Alice digita a mensagem na Enigma | Cifragem de 184 teclas, uma a uma, com rotores em movimento. |
| 4 | A cifra atravessa o canal | Transmissão da cifra pelo canal público. |
| 5 | Eva testa um texto provável e usa a fraqueza do refletor | Alinhamento do texto provável em 176 posições e descarte dos impossíveis. |
| 6 | Bob recebe a cifra | Recepção da mensagem cifrada. |
| 7 | Bob digita a cifra na Enigma | Cifragem da cifra com a mesma configuração: P = E(C). |
| 8 | Eva reduz as hipóteses, mas não lê a mensagem | Avaliação do resultado. |

**Veredito do cenário:** Eva alinhou o texto provável "RELATORIO" em 176 posições e descartou 50 por conterem uma letra igual à cifrada (a Enigma nunca cifra uma letra em si mesma). Restam 126 posições, e ela ainda não conhece a configuração: o espaço de chaves é cerca de 158.962.555.217.826.360.000 (com 10 pares de plugues, sem contar os anéis). Historicamente, a quebra da Enigma combinou essa propriedade com textos prováveis e com as Bombes de Turing; esta fase não inclui a Bombe, que está no laboratório "Enigma, fase 2".

## 6. Perguntas de fixação

1. Cifre "AAAAA" com os rotores I-II-III, refletor B, posições AAA e sem plugues. Qual é a cifra?

   **Resposta.** BDZGO. A mesma letra A vira cinco letras diferentes, porque o rotor da direita avança a cada tecla e muda a ligação elétrica. Observe também que nenhum A vira A.

2. Por que a Enigma é recíproca, isto é, cifrar e decifrar são a mesma operação?

   **Resposta.** O refletor é uma involução sem ponto fixo: liga as letras em pares (se A vai a E, então E vai a A), e o sinal percorre o mesmo circuito nos dois sentidos. Se, com uma certa posição dos rotores, P é cifrada em C, então C é cifrada em P na mesma posição. Basta partir da mesma configuração e das mesmas posições iniciais.

3. Por que nenhuma letra pode ser cifrada em si mesma, e por que isso é uma fraqueza?

   **Resposta.** O refletor nunca liga uma letra a ela mesma, e o sinal volta pelo mesmo caminho, então a saída nunca é igual à entrada. Isso permite descartar qualquer alinhamento de um texto provável (crib) em que uma letra do texto coincida com a da cifra na mesma posição, reduzindo muito as hipóteses.

4. O que é o passo duplo (double stepping) do rotor do meio?

   **Resposta.** O rotor do meio avança quando o rotor da direita passa pelo seu entalhe, mas também quando ele próprio está no entalhe, e, nesse caso, arrasta o rotor da esquerda. Por isso o rotor do meio pode avançar em duas teclas seguidas (por exemplo, ADU, ADV, AEW, BFX, BFY: o rotor do meio vai de D para E e de E para F).

5. Quantas configurações a Enigma I admite? Isso a tornava segura?

   **Resposta.** Com 3 rotores escolhidos entre 5 (60 ordens), 26³ = 17.576 posições iniciais e 10 pares de plugues (150.738.274.937.250 combinações), são cerca de 1,6 × 10²⁰ configurações, sem contar os anéis. Era um espaço enorme para a época, mas os ataques não testaram todas as chaves: exploraram textos prováveis, a fraqueza do refletor e erros dos operadores, com máquinas (as Bombes) para eliminar hipóteses.

6. Por que a Enigma não protege a integridade da mensagem?

   **Resposta.** Cada letra é cifrada de forma independente do restante: se Eva altera uma letra da cifra, apenas a letra correspondente sai errada na decifragem, e Bob não tem como perceber (só pelo contexto). Não há etiqueta de autenticação, como o GCM tem.

## 7. Limitações e cuidados

- Cifra histórica: não oferece segurança.
- O modelo cobre a Enigma I (três rotores, anéis e plugues); não simula variantes navais com quatro rotores.
- Uso exclusivamente didático: os laboratórios não devem proteger dados reais.

---

*CryptoNet é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
