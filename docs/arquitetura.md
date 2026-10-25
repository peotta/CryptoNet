# Arquitetura do CryptoNet Lab

## 1. Camadas

O código separa quatro naturezas de conteúdo, cada uma em seu diretório:

| Camada | Diretório | Natureza |
| --- | --- | --- |
| Simulação matemática educacional | `src/crypto/` (`bigmath.ts`, `rsaDidactic.ts`, `diffieHellman.ts`, `ecc.ts`, `keccak.ts`, `mlkem.ts`, `lwe.ts`, `classical.ts`, `enigma.ts`, `bombe.ts`, `aes.ts`, `chacha20.ts` e demais cifras clássicas) | BigInt e aritmética própria, sem padding, parâmetros pequenos. Inseguro por construção. |
| Operações criptográficas reais | `src/crypto/rsaWebCrypto.ts`, `kdf.ts`, `hash.ts`, `tls13.ts` e as assinaturas reais de `ecc.ts` | Web Crypto API: RSA-OAEP, RSA-PSS, HKDF-SHA-256, SHA-2, HMAC, AES-GCM, ECDH e ECDSA P-256 e Ed25519. |
| Contratos e motores locais | `src/crypto/engines.ts` e `src/crypto/local/` | Interfaces assíncronas e as implementações locais, uma por família. |
| Visualização conceitual | `src/simulation/`, `src/animations/`, `src/labs/`, `src/components/`, `src/pages/` | Modelo de protocolo, animações e interface. Não calcula criptografia. |

## 2. Estrutura de pastas

```text
src/
  crypto/            núcleo criptográfico (funções puras, testadas com vetores oficiais)
    engines.ts       contratos dos motores (interfaces) e o conjunto completo, usado nos testes e na documentação
    local/           implementações locais dos motores, uma família por arquivo
  simulation/        modelo de protocolo (tipos, linha do tempo, reprodução)
  animations/        componentes visuais reutilizáveis (canal, participantes, fórmulas, gráficos)
  components/        componentes de interface (cartões, seções, campos, perguntas de revisão)
  hooks/             useStepPlayer, useDebounced, useTheme, useDocumentTitle
  labs/              um diretório por laboratório e o registro (registry.ts)
  docs/              página de documentação: leitor de Markdown (DocView), diagramas (Mermaid) e âncoras
  pages/, layouts/   páginas e layout (HashRouter)
tests/               testes (Vitest, React Testing Library e axe-core)
scripts/             gerador da documentação e da wiki (gerar-wiki.mjs)
docs/                esta documentação e os documentos de cada laboratório (docs/laboratorios/)
public/              favicon, imagem de compartilhamento, robots.txt e sitemap.xml
.github/workflows/   testes e publicação no GitHub Pages
```

## 3. Contratos dos motores

`src/crypto/engines.ts` define as interfaces dos motores: `RsaDidacticEngine`, `RsaRealEngine`, `DiffieHellmanEngine`, `HashEngine`, `AesEngine`, `ClassicalEngine` (todas as cifras clássicas, a Enigma, a Bombe e o one-time pad), `ChaChaEngine`, `TlsEngine` e `EccEngine`. Todos os métodos retornam `Promise`.

As implementações locais ficam em `src/crypto/local/<familia>.ts`; cada arquivo exporta `engines`, um objeto parcial do tipo `EngineSet`. Os componentes de cada laboratório importam apenas a família de que precisam (por exemplo, `import { engines } from '../../crypto/local/classical'`), de modo que o navegador carrega só o código criptográfico daquele laboratório. O conjunto completo (`engines`, em `engines.ts`) é usado nos testes e na geração da documentação.

Para integrar uma API Python/FastAPI no futuro:

1. Criar um cliente (REST ou WebSocket) que implemente a mesma interface, por exemplo `RemoteDiffieHellmanEngine`, serializando `bigint` como texto decimal.
2. Substituir (ou compor) o valor correspondente no módulo de `src/crypto/local/`.
3. Nenhum fluxo, componente de interface ou teste de interface precisa mudar.

Observação: `RsaRealEngine` usa `CryptoKeyPair` em `RealKeyPair.handle`. Um motor remoto deve fornecer uma referência opaca equivalente (identificador de chave) e ajustar esse tipo.

## 4. Motor de simulação de protocolos

`src/simulation/` descreve um protocolo como dados:

- `ProtocolDefinition`: participantes (`PartyDef`, com os campos exibidos) e etapas (`ProtocolStep`).
- `ProtocolStep`: identificador, título, descrição didática, operação executada, eventos visuais e informações adicionais.
- `SimulationEvent`: `set` (grava um valor), `compute` (operação matemática com fórmula, substituição e resultado), `send` (mensagem pelo canal) e `verdict`.

`ProtocolSimulationEngine.build` aplica os eventos em ordem e produz `states[0..n]`, em que `states[k]` é o estado após `k` etapas (estado anterior e posterior de cada etapa estão em `states[k-1]` e `states[k]`). Como a navegação apenas escolhe um índice, avançar, retroceder ou saltar sempre exibe um estado consistente. A reprodução (`player.ts`) é um *reducer* puro; o único temporizador do sistema está em `hooks/useStepPlayer.ts`, que agenda um avanço por vez. Nada avança sozinho nos laboratórios passo a passo: cada etapa executa uma única operação e espera a confirmação do aluno.

## 5. Registro de laboratórios

`src/labs/registry.ts` é a única fonte de verdade. A página inicial, as categorias, os links de navegação, os testes e o gerador da documentação leem dele. Cada entrada tem identificador (kebab-case, usado na rota `#/lab/<id>`), categoria (`classica`, `simetrica`, `assimetrica` ou `posquantica`), título, resumo, objetivos, situação (`available` ou `planned`) e, quando disponível, o componente carregado sob demanda (`lazy`). Hoje todos os laboratórios estão disponíveis; a seção "Laboratórios futuros" da página inicial só aparece quando há algum `planned`.

## 6. Padrão de cada laboratório

Todos seguem a mesma estrutura pedagógica: Objetivos de aprendizagem, Introdução conceitual, Parâmetros configuráveis, Visualização animada, Explicação matemática, Linha do tempo das mensagens, Painel de resultados e Perguntas de revisão. Os textos de objetivos e perguntas ficam em `content.ts`; o fluxo de Alice, Bob e Eva fica em `flows.ts` (ou `run.ts`), que converte os valores calculados em uma `ProtocolDefinition`. Em todos, Alice e Bob são os participantes legítimos e Eva é a atacante (observadora passiva ou, havendo adulteração, ativa); Eva só aparece quando Alice e Bob se comunicam.

## 7. Segurança e acessibilidade

- Aleatoriedade somente por `crypto.getRandomValues` (`src/crypto/random.ts`); há testes que falham se `Math.random` for chamado nos módulos `bigmath` e `otp`.
- Chaves privadas do modo real são não extraíveis; nenhum segredo é registrado em `console` ou em armazenamento persistente (somente a preferência de tema usa `localStorage`).
- Preferência por movimento reduzido: `MotionConfig reducedMotion="user"`, `motionDuration` e regra CSS `prefers-reduced-motion`.
- Informação nunca depende só de cor: cada tipo de item tem ícone e rótulo próprios.
- O título da aba muda a cada página (`useDocumentTitle`).
- Texto legível em projetor: nada abaixo de 12 unidades nos gráficos SVG, que são ampliados conforme a largura.
- Testes de acessibilidade com `axe-core` (sem a regra de contraste, que exige layout real).

## 8. Testes

`npm test` executa o Vitest. Os testes se dividem em:

- **Núcleo criptográfico:** vetores oficiais (FIPS 197, RFC 8439, RFC 8448, RFC 4231, entre outros) e, no ML-KEM e no SHA-3, a comparação byte a byte com o OpenSSL 3.5 do Node (quando disponível) e vetores de regressão fixos e propriedades (inverso modular, reciprocidade da Enigma, nonce reutilizado, etc.).
- **Fluxos (`*-flow.test.ts`):** ordem das etapas, o que Eva sabe em cada etapa, segredos que nunca atravessam o canal e consistência do `replay` em todas as etapas.
- **Interface (`*-ui.test.tsx`):** cada laboratório é aberto pelas rotas, percorrido passo a passo e verificado com o `axe-core`.
- **Página de documentação (`doc-ui.test.tsx`):** leitura dos documentos, índice lateral, âncoras, links entre documentos, diagramas (o Mermaid é simulado no jsdom), página 404 e `axe-core`.
- **Documentação (`docs.test.ts`):** todo laboratório disponível tem o seu documento em `docs/laboratorios/`, sem travessões e com as RFCs em link.

`tests/setup.ts` amplia o tempo de espera das consultas assíncronas da biblioteca de testes (cargas altas em paralelo), e `vite.config.ts` repete até duas vezes os testes que falharem no GitHub Actions (variável `CI`).

## 9. Publicação

O fluxo `.github/workflows/deploy.yml` roda `npm ci`, `npm test`, `npm run build` com `VITE_BASE=/<repositório>/` e publica `dist/` no GitHub Pages. Endereço: `https://peotta.github.io/CryptoNet/`. O roteamento usa `HashRouter`, de modo que recarregar qualquer página funciona em hospedagem estática.

## 10. Como adicionar um laboratório

1. **Levante as fontes antes de escrever.** Liste as RFCs e os padrões vigentes em https://www.rfc-editor.org e confira se algum foi substituído (por exemplo, a RFC 8446 foi substituída pela RFC 9846). Anote o que o laboratório vai simplificar.
2. **Núcleo.** Escreva as operações em `src/crypto/<nome>.ts`, com testes contra vetores oficiais, e uma interface de motor em `engines.ts` com a implementação em `src/crypto/local/<familia>.ts`.
3. **Fluxo.** Crie `src/labs/<nome>/` com `content.ts` (objetivos e perguntas), `flows.ts` (a `ProtocolDefinition` de Alice, Bob e Eva) e o componente exportado por padrão. Renderize `<ProtocolPlayer definition={...} resetKey={...} />`.
4. **Registro.** Acrescente a entrada em `src/labs/registry.ts` (componente com `lazy`, status `available`).
5. **Testes.** Núcleo, fluxo e interface (com `axe-core`), seguindo os testes dos laboratórios existentes.
6. **Documentação.** Acrescente a especificação do laboratório (resumo, padrões, limitações e cenários com as entradas fixas) em `SPECS`, no arquivo `scripts/gerar-wiki.mjs`, e rode `npm run docs:labs`. Isso gera `docs/laboratorios/<id>.md` e atualiza o índice. Confira o arquivo (travessões, diagramas, textos) e versione-o junto com o laboratório. O gerador transforma toda citação de RFC em link para o rfc-editor.org; o teste `docs.test.ts` falha se o documento não existir.
7. **Wiki.** Rode `npm run wiki -- <pasta>`, clone `CryptoNet.wiki.git`, copie os `.md` gerados, faça o commit e o push. Como a wiki é pública, a publicação só é feita com autorização expressa do autor.
8. **README e mapa do site.** Atualize a lista de laboratórios do `README.md`.

## 11. Limitações

- React Flow não foi adotado: o canal e os participantes usam componentes próprios, mais leves. Ele pode ser introduzido em protocolos com topologias complexas.
- Os grupos de Diffie-Hellman e a curva elíptica didática são pequenos por finalidade didática; não há grupo de 2048 bits no laboratório de Diffie-Hellman.
- O handshake do TLS 1.3 tem uma única suíte e um único grupo e não inclui HelloRetryRequest, retomada (PSK) nem 0-RTT.
- Nenhum modo didático oferece segurança real: não use o projeto para proteger dados.
