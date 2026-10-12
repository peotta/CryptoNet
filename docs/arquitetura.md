# Arquitetura do CryptoNet Lab

## 1. Camadas

O código separa três naturezas de conteúdo, cada uma em seu diretório:

| Camada | Diretório | Natureza |
| --- | --- | --- |
| Simulação matemática educacional | `src/crypto/bigmath.ts`, `rsaDidactic.ts`, `diffieHellman.ts` | BigInt, sem padding, parâmetros pequenos. Inseguro por construção. |
| Operações criptográficas reais | `src/crypto/rsaWebCrypto.ts`, `kdf.ts` | Web Crypto API: RSA-OAEP, RSA-PSS, HKDF-SHA-256, AES-256-GCM. |
| Visualização conceitual | `src/simulation/`, `src/animations/`, `src/labs/` | Modelo de protocolo, animações e interface. Não calcula criptografia. |

## 2. Contratos dos motores

`src/crypto/engines.ts` define as interfaces `RsaDidacticEngine`, `RsaRealEngine` e `DiffieHellmanEngine`. Todos os métodos retornam `Promise`. Os componentes React importam apenas o objeto `engines`.

Para integrar uma API Python/FastAPI no futuro:

1. Criar um cliente (REST ou WebSocket) que implemente a mesma interface, por exemplo `RemoteDiffieHellmanEngine`, serializando `bigint` como texto decimal.
2. Substituir (ou compor) o valor correspondente em `engines`.
3. Nenhum componente, fluxo ou teste de interface precisa mudar.

Observação: `RsaRealEngine` usa `CryptoKeyPair` em `RealKeyPair.handle`. Um motor remoto deve fornecer uma referência opaca equivalente (identificador de chave) e ajustar esse tipo.

## 3. Motor de simulação de protocolos

`src/simulation/` descreve um protocolo como dados:

- `ProtocolDefinition`: participantes (`PartyDef`, com os campos exibidos) e etapas (`ProtocolStep`).
- `ProtocolStep`: identificador, título, descrição didática, operação executada, eventos visuais e informações adicionais.
- `SimulationEvent`: `set` (grava um valor), `compute` (operação matemática com fórmula, substituição e resultado), `send` (mensagem pelo canal) e `verdict`.

`ProtocolSimulationEngine.build` aplica os eventos em ordem e produz `states[0..n]`, em que `states[k]` é o estado após `k` etapas (estado anterior e posterior de cada etapa estão em `states[k-1]` e `states[k]`). Como a navegação apenas escolhe um índice, avançar, retroceder ou saltar sempre exibe um estado consistente. A reprodução (`player.ts`) é um *reducer* puro; o único temporizador do sistema está em `hooks/useStepPlayer.ts`, que agenda um avanço por vez.

## 4. Como adicionar um laboratório ou protocolo

1. Criar `src/labs/<nome>/` com um componente exportado por padrão.
2. Escrever uma função que converta os valores calculados em uma `ProtocolDefinition` (ver `labs/rsa/flows.ts` e `labs/diffie-hellman/flows.ts`).
3. Renderizar `<ProtocolPlayer definition={...} resetKey={...} />`.
4. Registrar uma entrada em `src/labs/registry.ts` (ela troca "Em breve" por "Disponível" ao receber o campo `component`).

Protocolos com mais participantes (TLS 1.3, SSH, IPsec) usam as mesmas peças: basta declarar os participantes e seus campos.

## 5. Segurança e acessibilidade

- Aleatoriedade somente por `crypto.getRandomValues` (`src/crypto/random.ts`); há teste que falha se `Math.random` for chamado.
- Chaves privadas do modo real são não extraíveis; nenhum segredo é registrado em `console` ou em armazenamento persistente (somente a preferência de tema usa `localStorage`).
- Preferência por movimento reduzido: `MotionConfig reducedMotion="user"`, `motionDuration` e regra CSS `prefers-reduced-motion`.
- Informação nunca depende só de cor: cada tipo de item tem ícone e rótulo próprios.
- Testes de acessibilidade com `axe-core` (sem a regra de contraste, que exige layout real).

## 6. Limitações conhecidas

- React Flow não foi adotado nesta fase: o canal e os participantes usam componentes próprios, mais leves. Ele pode ser introduzido em protocolos com topologias complexas.
- Os grupos de Diffie-Hellman são pequenos por finalidade didática; não há grupo de 2048 bits no laboratório.
