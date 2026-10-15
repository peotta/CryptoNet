# CryptoNet

Projeto voltado para criptografia, redes e segurança da informação.

## 📌 Visão Geral

O **CryptoNet** é um projeto desenvolvido para experimentação, implementação e análise de algoritmos criptográficos e protocolos de rede seguros.

## 🚀 Começando

### Pré-requisitos

- Python 3.10+
- `pip` e `virtualenv` (recomendado)

### Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/peotta/CryptoNet.git
   cd CryptoNet
   ```

2. Crie e ative um ambiente virtual:
   ```bash
   python -m venv .venv
   # No Windows (PowerShell):
   .venv\Scripts\Activate.ps1
   # No Linux/macOS:
   source .venv/bin/activate
   ```

3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

## 🧪 CryptoNet Lab: Laboratório Virtual de Criptografia e Protocolos Seguros

Aplicação web (React, TypeScript, Vite, Tailwind CSS e Motion) que anima operações criptográficas passo a passo. Funciona inteiramente no navegador, sem backend.

**Categorias:** Criptografia Clássica, Criptografia Simétrica e Criptografia Assimétrica e Acordo de Chaves.

**Laboratórios disponíveis:** cifras de César e afim (disco de cifra, aritmética modular e criptoanálise de Eva por força bruta e frequência das letras), substituição simples e análise de frequência (índice de coincidência e refinamento por bigramas), Vigenère (tabela de Vigenère, teste de Kasiski, IC por tamanho de chave e frequência por coluna), Playfair e Hill (grade 5 × 5, matrizes módulo 26 e ataque de texto claro conhecido), máquina Enigma (rotores, refletor, plugues, caminho do sinal e criptoanálise por texto provável), Enigma fase 2 (a Bombe de Turing e Welchman: menu do texto provável, propagação de hipóteses de plugue, contradição e paradas falsas), one-time pad (sigilo perfeito, maleabilidade e a reutilização da chave com arrasto de texto provável), transposição e cifra produto (cerca de trilhos, transposição colunar, anagramação de Eva e confusão e difusão), RSA (modo didático com BigInt e modo real com RSA-OAEP e RSA-PSS via Web Crypto), Diffie-Hellman (troca de chaves, visão de Eva, cenário de homem do meio e extensão HKDF + AES-GCM), funções hash e HMAC (efeito avalanche e HMAC passo a passo) AES e modos de operação (rodadas do AES operação por operação e comparação de ECB, CBC, CTR e GCM diante de Eva) ChaCha20 (quarter round e bloco conferidos com a RFC 8439, nonce reutilizado e maleabilidade) e o handshake do TLS 1.3 (ECDHE, cronograma de chaves conferido com a RFC 8448, certificado, CertificateVerify, Finished e o homem do meio). ECDH, ECDSA e Ed25519 (aritmética de curvas elípticas passo a passo, ataque ao nonce reutilizado e assinaturas reais).

**Atores:** em todos os laboratórios, Alice e Bob são os participantes legítimos e Eva é a atacante (observadora passiva ou, quando há adulteração, ativa).

> Os modos didáticos usam parâmetros pequenos e não oferecem segurança real. Não utilize o projeto para proteger dados.

### Instalação e desenvolvimento

Requer Node.js 20 ou superior.

```bash
npm install          # instala as dependências
npm run dev          # servidor de desenvolvimento (http://localhost:5173)
```

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

O caminho base é definido pela variável `VITE_BASE` (padrão `/`). Exemplo para o GitHub Pages: `VITE_BASE=/cryptonet-lab/ npm run build`. O roteamento usa `HashRouter`, de modo que recarregar qualquer página funciona em hospedagem estática.

### Publicação no GitHub Pages

1. No repositório, abra *Settings > Pages* e selecione *Source: GitHub Actions*.
2. Envie o código para a branch `main`. O fluxo [.github/workflows/deploy.yml](.github/workflows/deploy.yml) executa os testes, gera o build com `VITE_BASE=/<nome-do-repositório>/` e publica em `https://usuario.github.io/<nome-do-repositório>/`.

### Documentação

A arquitetura (camadas, contratos dos motores para futura API Python/FastAPI e como adicionar laboratórios) está em [docs/arquitetura.md](docs/arquitetura.md).

## 📄 Licença

Este projeto está sob a licença MIT. Consulte o arquivo LICENSE para mais detalhes.
