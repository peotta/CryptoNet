# CryptoNet Lab

[![Publicação no GitHub Pages](https://github.com/peotta/CryptoNet/actions/workflows/deploy.yml/badge.svg)](https://github.com/peotta/CryptoNet/actions/workflows/deploy.yml)
[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg)](LICENSE)

**Aplicação:** <https://peotta.github.io/CryptoNet/> | **Wiki:** <https://github.com/peotta/CryptoNet/wiki> | **Documentação:** [docs/laboratorios](docs/laboratorios/README.md)

Laboratório Virtual de Criptografia e Protocolos Seguros, da Universidade de Brasília (UnB). Cada laboratório anima, passo a passo, uma operação criptográfica ou um protocolo, com fórmulas com os valores substituídos, linha do tempo das mensagens e a visão de quem observa a rede. Tudo roda no navegador, sem servidor.

Projeto acadêmico do curso de Engenharia de Redes de Comunicação, sob responsabilidade do Prof. Dr. Laerte Peotta de Melo. Projeto irmão: [Simul-Net](https://peotta.github.io/Simul-Net/), simuladores visuais de redes e protocolos seguros.

Destaques: nada avança sozinho (cada etapa executa uma única operação e espera a confirmação do aluno); modos didáticos com BigInt ao lado de operações reais pela Web Crypto; resultados conferidos com vetores oficiais (FIPS 197, RFC 8439, RFC 8448, RFC 4231); acessibilidade verificada por testes automáticos (axe-core).

**Atores:** em todos os laboratórios, Alice e Bob são os participantes legítimos e Eva é a atacante (observadora passiva ou, quando há adulteração, ativa).

## Laboratórios

| Categoria | Laboratório |
| --- | --- |
| Criptografia Clássica | [Cifras de César e afim](docs/laboratorios/cesar-afim.md) (disco de cifra, aritmética modular e criptoanálise por força bruta e frequência), [Substituição simples e análise de frequência](docs/laboratorios/substituicao-frequencia.md) (índice de coincidência e bigramas), [Vigenère](docs/laboratorios/vigenere.md) (Kasiski, IC e frequência por coluna), [Playfair e Hill](docs/laboratorios/playfair-hill.md) (grade 5 × 5, matrizes módulo 26 e texto claro conhecido), [Transposição e cifra produto](docs/laboratorios/transposicao.md) (trilhos, colunar, anagramação, confusão e difusão), [Máquina Enigma](docs/laboratorios/enigma.md) (rotores, refletor, plugues e texto provável), [Enigma, fase 2: a Bombe](docs/laboratorios/enigma-bombe.md) (menu, propagação de hipóteses e paradas falsas), [One-time pad](docs/laboratorios/otp.md) (sigilo perfeito, maleabilidade e reutilização da chave) |
| Criptografia Simétrica | [AES e modos de operação](docs/laboratorios/aes.md) (rodadas operação por operação e ECB, CBC, CTR e GCM diante de Eva), [ChaCha20](docs/laboratorios/chacha20.md) (quarter round e bloco conferidos com a RFC 8439, nonce reutilizado e maleabilidade), [Funções hash e HMAC](docs/laboratorios/hash-hmac.md) (efeito avalanche e HMAC passo a passo) |
| Criptografia Assimétrica e Acordo de Chaves | [RSA](docs/laboratorios/rsa.md) (didático com BigInt e real com RSA-OAEP e RSA-PSS), [Diffie-Hellman](docs/laboratorios/diffie-hellman.md) (visão de Eva, homem do meio e HKDF + AES-GCM), [ECDH, ECDSA e Ed25519](docs/laboratorios/ecdh-assinaturas.md) (curvas elípticas passo a passo, nonce reutilizado e assinaturas reais), [Handshake do TLS 1.3](docs/laboratorios/tls13.md) (ECDHE, cronograma de chaves conferido com a RFC 8448, CertificateVerify, Finished e homem do meio) |

> Os modos didáticos usam parâmetros pequenos e não oferecem segurança real. Não utilize o projeto para proteger dados.

## Desenvolvimento

Requer Node.js 20 ou superior (o fluxo de publicação usa o Node 22). Pilha: React 19, TypeScript, Vite 7, Tailwind CSS 4, Motion e Vitest.

```bash
git clone https://github.com/peotta/CryptoNet.git
cd CryptoNet
npm install          # instala as dependências
npm run dev          # servidor de desenvolvimento (http://localhost:5173)
```

### Estrutura de pastas

| Pasta | Conteúdo |
| --- | --- |
| `src/crypto/` | núcleo criptográfico (funções puras), contratos dos motores (`engines.ts`) e implementações locais (`local/`) |
| `src/simulation/` | modelo de protocolo: participantes, etapas, eventos e linha do tempo |
| `src/animations/`, `src/components/` | componentes visuais e de interface reutilizáveis |
| `src/labs/` | um diretório por laboratório e o registro `registry.ts`, fonte única dos laboratórios |
| `src/pages/`, `src/layouts/`, `src/hooks/` | páginas, layout e ganchos |
| `docs/` | arquitetura e documentos de cada laboratório (`docs/laboratorios/`) |
| `scripts/` | gerador da documentação e da wiki (`gerar-wiki.mjs`) |
| `tests/` | testes unitários, de fluxo e de interface (Vitest, Testing Library e axe-core) |

### Testes

```bash
npm test             # executa os testes (Vitest) uma vez
npm run test:watch   # modo contínuo
npm run typecheck    # verificação de tipos
```

### Build de produção

```bash
npm run build        # gera a pasta dist/
npm run preview      # serve dist/ localmente
```

O caminho base é definido pela variável `VITE_BASE` (padrão `/`). Exemplo para o GitHub Pages: `VITE_BASE=/CryptoNet/ npm run build`. O roteamento usa `HashRouter`, de modo que recarregar qualquer página funciona em hospedagem estática.

### Publicação no GitHub Pages

1. No repositório, abra *Settings > Pages* e selecione *Source: GitHub Actions*.
2. Envie o código para a branch `main`. O fluxo [.github/workflows/deploy.yml](.github/workflows/deploy.yml) executa os testes, gera o build com `VITE_BASE=/<nome-do-repositório>/` e publica em `https://usuario.github.io/<nome-do-repositório>/`.

## Documentação

A arquitetura (camadas, contratos dos motores para uma futura API Python/FastAPI, motor de simulação e como adicionar laboratórios) está em [docs/arquitetura.md](docs/arquitetura.md). Cada laboratório tem o seu documento em [docs/laboratorios](docs/laboratorios/README.md), com objetivos, participantes, diagramas de sequência de Alice, Bob e Eva, etapas, perguntas de fixação, padrões (com link para o [rfc-editor.org](https://www.rfc-editor.org)) e limitações. Os documentos são gerados pelo código:

```bash
npm run docs:labs   # gera ou atualiza docs/laboratorios/
```

O teste `docs.test.ts` falha se faltar o documento de algum laboratório disponível. Versione o documento junto com o laboratório.

### Wiki

A [wiki do projeto](https://github.com/peotta/CryptoNet/wiki) reúne a mesma documentação em formato de páginas navegáveis: página inicial, arquitetura, índice de laboratórios, guia para contribuir e uma página por laboratório. Também é gerada pelo código:

```bash
npm run wiki -- <pasta-de-saida>   # gera as páginas .md da wiki
```

Para publicar, clone `CryptoNet.wiki.git`, copie os `.md` gerados, faça o commit e o push. Como a wiki é pública, a publicação só ocorre com autorização expressa do autor.

## Como contribuir

Para criar ou alterar um laboratório, siga o passo a passo da seção 10 de [docs/arquitetura.md](docs/arquitetura.md). Convenções do projeto:

- Idioma: português do Brasil, em tom acadêmico, direto e impessoal. Termos técnicos consagrados em inglês podem ser mantidos, com o significado esclarecido na primeira ocorrência.
- Pontuação: não usar travessão longo nem meia-risca (use hífen, dois-pontos, barra ou parênteses).
- Rigor técnico: levantar as RFCs e os padrões vigentes no [rfc-editor.org](https://www.rfc-editor.org), conferir versões substituídas (por exemplo, a RFC 8446 foi substituída pela RFC 9846), citar a RFC e a seção e registrar as simplificações do laboratório.
- Segurança: os modos didáticos devem ser identificados como inseguros na interface; ataques ficam no nível didático, dentro do navegador.
- Todo laboratório novo entra em `src/labs/registry.ts`, com documento em `docs/laboratorios/<id>.md` gerado por `npm run docs:labs`.
- Antes de enviar: `npm run typecheck` e `npm test`.
- Commits em português, com verbo na terceira pessoa do presente e sem prefixo (por exemplo, "Adiciona o laboratório de ChaCha20").

## Como citar

Os metadados de citação estão em [CITATION.cff](CITATION.cff), e o GitHub oferece o botão "Cite this repository". Exemplo:

> MELO, Laerte Peotta de. *CryptoNet Lab: laboratório virtual de criptografia e protocolos seguros*. Brasília: Universidade de Brasília, Departamento de Engenharia Elétrica, 2026. Disponível em: https://github.com/peotta/CryptoNet.

## Uso de Inteligência Artificial

Base: Política de Integridade Acadêmica e Uso Responsável da Inteligência Artificial da FT/UnB.

**Declaração docente.** CryptoNet é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).

**Diretrizes para os estudantes.** Ferramentas de IA podem apoiar o estudo, mas não substituem a compreensão dos conceitos nem a autoria do trabalho. Ao usar este material: confira as afirmações técnicas nas fontes (RFCs, padrões e literatura de referência); declare no trabalho o uso de IA, conforme a política da FT/UnB; e responda pessoalmente pelo que entregar.

## Licença

Este projeto está sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE).
