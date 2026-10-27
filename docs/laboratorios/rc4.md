# RC4 e o ataque ao WEP

Cifra de fluxo clássica: KSA e PRGA troca por troca, a maleabilidade e o ataque FMS, com que Eva recupera a chave do WEP por votação.

- **Categoria:** Criptografia Simétrica
- **Abrir o laboratório:** <https://peotta.github.io/CryptoNet/#/lab/rc4>
- **Motor:** didático (RC4 com rastro; conferido com vetores conhecidos e com a [RFC 6229](https://www.rfc-editor.org/rfc/rfc6229))
- **Código-fonte:** `src/labs/rc4/` (interface e fluxos) e `src/crypto/rc4.ts` (operações)
- **Padrões e referências:** [RFC 6229](https://www.rfc-editor.org/rfc/rfc6229) (vetores de teste do RC4, informativa); [RFC 7465](https://www.rfc-editor.org/rfc/rfc7465) (proíbe as suítes RC4 no TLS); [RFC 8758](https://www.rfc-editor.org/rfc/rfc8758) (descontinua o RC4 no SSH); O RC4 não é um algoritmo aprovado pelo NIST (não consta em nenhuma FIPS nem SP).

## 1. Objetivos de aprendizagem

- Executar a KSA (256 trocas que embaralham o estado com a chave) e a PRGA (uma troca por byte emitido) do RC4, conferidas com os vetores conhecidos e com a [RFC 6229](https://www.rfc-editor.org/rfc/rfc6229).
- Explicar que o RC4 é uma cifra de fluxo sem nonce: a mesma chave gera sempre o mesmo fluxo, o que obriga a acrescentar um IV à chave (como no WEP).
- Mostrar a maleabilidade: sem autenticação, Eva inverte bits do claro sem conhecer a chave.
- Reproduzir o ataque FMS contra o WEP: com o IV em claro e um primeiro byte de claro conhecido (0xAA), Eva recupera a chave raiz byte a byte por votação.
- Verificar o viés do segundo byte do fluxo (zero com probabilidade próxima de 2/256) e o efeito de descartar o início do fluxo.
- Situar o RC4 entre as cifras abandonadas ([RFC 7465](https://www.rfc-editor.org/rfc/rfc7465) e [RFC 8758](https://www.rfc-editor.org/rfc/rfc8758)) e compará-lo com o ChaCha20 e o AES-CTR.

## 2. Fundamentação

O RC4 mantém um estado de 256 bytes. A KSA o embaralha com a chave em 256 trocas e a PRGA emite um byte por troca; a mensagem é combinada com o fluxo por XOR. Não há nonce, o fluxo tem vieses (o segundo byte vale zero com probabilidade próxima de 2/256) e a cifra não autentica. No WEP, a chave de cada quadro é o IV de 3 bytes, em claro, seguido da chave raiz, e o ataque FMS recupera a chave raiz por votação a partir do primeiro byte de fluxo de quadros com IV fracos, sabendo que o claro começa por 0xAA.

## 3. Participantes

Alice e Bob são os participantes legítimos; Eva é a atacante (observadora passiva ou, quando há adulteração, ativa). As tabelas abaixo listam o que cada um mantém em cada cenário.

| Participante | Papel | Dados que pode guardar (tipo) |
| --- | --- | --- |
| Alice | Remetente | Chave raiz K (40 bits) (segredo); Estado S depois da KSA (segredo); Quadro em claro (texto claro); Fluxo de chaves (segredo); Quadro cifrado (texto cifrado); IV do quadro (24 bits, em claro) (parâmetro público) |
| Bob | Destinatário | Chave raiz K (40 bits) (segredo); Quadro recebido (texto cifrado); Fluxo de chaves (segredo); Quadro recuperado (texto claro) |
| Eva | Atacante (observa e, se puder, altera o canal) | Quadros colhidos (IV e 1º byte cifrado) (texto cifrado); Cifra alterada C' (enviada a Bob) (texto cifrado); Primeiro byte do fluxo (c0 ⊕ 0xAA) (parâmetro público); Chave raiz recuperada (segredo); Quadro lido por Eva (texto claro) |

## 4. Como ler os diagramas

Cada figura é um diagrama de sequência gerado a partir da mesma definição de protocolo que anima o laboratório: as colunas são os participantes, o tempo corre de cima para baixo e cada faixa horizontal é o início de uma etapa. Os valores numéricos e as chaves não aparecem aqui (são aleatórios ou dependem das entradas); eles são mostrados nas fórmulas do próprio laboratório.

- Seta cheia: mensagem enviada pelo canal, com o rótulo do que trafega.
- `[adulterada]` no início do rótulo: a mensagem foi alterada em trânsito por Eva.
- Faixa com texto: título da etapa que começa naquele ponto.

**Lista de figuras**

- [Figura 5.1.1](#511-eva-observa-e-altera-um-byte): Eva observa e altera um byte
- [Figura 5.2.1](#521-eva-recupera-a-chave-raiz-ataque-fms): Eva recupera a chave raiz (ataque FMS)

## 5. Cenários

### 5.1 Chave de sessão

#### 5.1.1 Eva observa e altera um byte

**Entradas usadas:** chave de 16 bytes, mensagem de 25 bytes.

```mermaid
sequenceDiagram
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: Eva intercepta a cifra
  n_alice->>n_eva: Cifra C
  Note over n_alice,n_eva: Eva inverte um bit e reenvia a Bob
  n_eva->>n_bob: [adulterada] Cifra C'
```

*Figura 5.1.1 (sequência).* Eva observa e altera um byte: 2 mensagens (1 adulterada), entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | Alice e Bob compartilham a chave | Nenhum cálculo: a chave já é conhecida por Alice e por Bob. |
| 2 | Alice embaralha o estado com a chave (KSA) | 256 trocas (KSA). |
| 3 | Alice escreve a mensagem | Codificação UTF-8 da mensagem. |
| 4 | Alice gera o fluxo de chaves (PRGA) | Geração de 25 bytes de fluxo de chaves. |
| 5 | Alice faz o XOR da mensagem com o fluxo | XOR byte a byte: C = m ⊕ KS. |
| 6 | Eva intercepta a cifra | Interceptação da cifra. |
| 7 | Eva inverte um bit e reenvia a Bob | XOR de 0x01 no byte 10 da cifra. |
| 8 | Bob recebe a cifra | Recepção da cifra. |
| 9 | Bob gera o mesmo fluxo de chaves | KSA e PRGA com a chave K. |
| 10 | Bob faz o XOR da cifra com o fluxo | XOR byte a byte: m = C ⊕ KS. |
| 11 | Bob aceita uma mensagem alterada | Avaliação do resultado. |

**Veredito do cenário:** Eva inverteu um bit do byte 10 da cifra, sem conhecer a chave, e Bob decifrou a mensagem com exatamente esse bit invertido (1 byte alterado), sem perceber. O RC4 só cifra: não autentica.

### 5.2 WEP

#### 5.2.1 Eva recupera a chave raiz (ataque FMS)

**Entradas usadas:** chave raiz de 40 bits, 1.280 quadros com IV fracos.

```mermaid
sequenceDiagram
  participant n_alice as Alice
  participant n_bob as Bob
  participant n_eva as Eva
  Note over n_alice,n_eva: O quadro vai pelo ar, com o IV em claro
  n_alice->>n_bob: IV, C
```

*Figura 5.2.1 (sequência).* Eva recupera a chave raiz (ataque FMS): 1 mensagem, entre Alice, Bob e Eva.

| Etapa | Título | Operação |
| --- | --- | --- |
| 1 | A estação e o ponto de acesso compartilham a chave raiz | Nenhum cálculo: a chave raiz já é conhecida por Alice e por Bob. |
| 2 | Alice cifra um quadro com IV mais chave raiz | Cifragem RC4 com a chave IV ‖ K. |
| 3 | O quadro vai pelo ar, com o IV em claro | Transmissão do IV e do quadro cifrado. |
| 4 | Bob decifra o quadro | Decifragem RC4 com a chave IV ‖ K. |
| 5 | Eva colhe quadros com IV fracos | Coleta de 1.280 quadros (IV e primeiro byte cifrado). |
| 6 | Eva obtém o primeiro byte do fluxo de cada quadro | XOR do primeiro byte cifrado com 0xAA. |
| 7 | Eva descobre o byte 1 da chave raiz | Votação para o byte 1 (254 votos). |
| 8 | Eva descobre o byte 2 da chave raiz | Votação para o byte 2 (252 votos). |
| 9 | Eva descobre o byte 3 da chave raiz | Votação para o byte 3 (250 votos). |
| 10 | Eva descobre o byte 4 da chave raiz | Votação para o byte 4 (248 votos). |
| 11 | Eva descobre o byte 5 da chave raiz | Votação para o byte 5 (247 votos). |
| 12 | Eva confere a chave e lê o quadro | Decifragem do quadro com a chave recuperada. |
| 13 | O WEP caiu: a chave raiz foi recuperada | Avaliação do resultado. |

**Veredito do cenário:** Eva recuperou a chave raiz de 40 bits com 1.280 quadros, sem testar as 2^40 chaves: o candidato mais votado de cada byte já servia. Com a chave, ela lê e forja quadros da rede. O defeito é do uso do RC4 no WEP (IV curto e em claro, chave por quadro = IV mais chave raiz), explorado pelo ataque FMS (2001); o WEP foi substituído pelo WPA e pelo WPA2.

## 6. Perguntas de fixação

1. Como o RC4 transforma uma chave curta em um fluxo de bytes?

   **Resposta.** O estado S começa como a permutação identidade de 0 a 255. A KSA percorre i de 0 a 255, calcula j = j + S[i] + K[i mod tamanho] e troca S[i] com S[j], o que embaralha S de modo dependente da chave. A PRGA, a cada byte, faz i = i + 1, j = j + S[i], troca S[i] com S[j] e emite S[(S[i] + S[j]) mod 256]. A mensagem é combinada com esse fluxo por XOR, e decifrar é a mesma operação.

2. Por que o RC4 precisa de um IV acrescentado à chave, e por que isso foi um problema no WEP?

   **Resposta.** O RC4 não tem nonce: com a mesma chave, o fluxo é sempre o mesmo, e reutilizá-lo permite a Eva obter C1 ⊕ C2 = m1 ⊕ m2. O WEP resolveu isso formando a chave de cada quadro como IV (24 bits) seguido da chave raiz. Mas o IV é curto (repete-se após cerca de 16 milhões de quadros), viaja em claro e fica justamente no início da chave, onde a KSA é mais fraca. Isso permite o ataque FMS.

3. Como funciona o ataque FMS em linhas gerais?

   **Resposta.** Para IVs da forma (B+3, 255, X), quando os três primeiros bytes são conhecidos e o byte B da chave raiz é o próximo, a KSA, depois de B+3 passos, deixa o estado em uma situação em que, com probabilidade de cerca de 5%, o primeiro byte do fluxo é determinado pelo byte desconhecido: K[B+3] = S⁻¹[z0] − j − S[B+3]. Eva obtém z0 pelo XOR do primeiro byte cifrado com 0xAA (cabeçalho SNAP conhecido). Cada quadro vota em um valor; o certo recebe mais votos que os outros. Repetindo para cada byte, ela recupera a chave sem testar as 2^40 possibilidades.

4. Por que o primeiro byte do claro ser conhecido facilita o ataque?

   **Resposta.** Porque a cifra de fluxo é C = m ⊕ fluxo: se Eva conhece m, obtém o fluxo diretamente, sem adivinhar nada. No 802.11, todo quadro IP começa pelo cabeçalho LLC/SNAP AA AA 03 00 00 00. É um caso de texto claro conhecido, comum em protocolos, com cabeçalhos fixos.

5. O que é o viés do segundo byte e como descartar o início do fluxo ajuda?

   **Resposta.** No RC4, o segundo byte do fluxo vale zero com probabilidade próxima de 2/256 (o dobro de um fluxo aleatório), por uma propriedade da PRGA quando S[2] = 0. Se uma mesma mensagem é cifrada com muitas chaves, o atacante vê um valor aparecer mais que os outros naquela posição e deduz o claro. Descartar os primeiros 256 bytes (RC4-drop[256]) elimina esse viés e outros do início do fluxo, mas vieses em posições posteriores continuam, e o RC4 acabou proibido no TLS ([RFC 7465](https://www.rfc-editor.org/rfc/rfc7465)).

6. Por que o ChaCha20 e o AES-CTR são preferíveis ao RC4?

   **Resposta.** Têm nonce (a mesma chave serve para muitas mensagens sem repetir o fluxo), não apresentam vieses estatísticos conhecidos, têm análise de segurança mais completa e, no caso do ChaCha20-Poly1305 e do AES-GCM, vêm em modos autenticados (AEAD), o que impede a maleabilidade. O RC4 só cifra, é enviesado e exige gambiarras como o IV do WEP.

## 7. Limitações e cuidados

- O ataque FMS é demonstrado no WEP de 40 bits com quadros de IV fracos (256 por byte da chave); ferramentas reais precisam de mais quadros e usam ataques posteriores (KoreK, PTW).
- A KSA e a PRGA são exibidas para a chave informada; a Parte C mede o viés por amostragem de chaves aleatórias, não por prova.
- A mensagem é limitada a 120 bytes.
- Uso exclusivamente didático: os laboratórios não devem proteger dados reais.

---

*CryptoNet é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
