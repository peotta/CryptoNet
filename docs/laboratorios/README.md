# Documentação dos laboratórios

Lista dos laboratórios do CryptoNet Lab por categoria. A fonte única é `src/labs/registry.ts`.

## Criptografia Clássica

Cifras de substituição e de transposição anteriores aos computadores, e a criptoanálise que as quebra: força bruta, análise de frequência e máquinas.

| Laboratório | Resumo | Motor | Padrões e referências |
| --- | --- | --- | --- |
| [Cifras de César e afim](cesar-afim.md) | Disco de cifra, aritmética modular e a criptoanálise de Eva por força bruta e frequência das letras. | didático (aritmética modular) | Livro de referência: Stallings, *Cryptography and Network Security*, cap. 3 (cifras clássicas) |
| [Substituição simples e análise de frequência](substituicao-frequencia.md) | Chave de 26 letras (26! chaves) e a quebra por frequência, índice de coincidência e bigramas, com Eva como criptoanalista. | didático (permutação de 26 letras) | Índice de coincidência: Friedman (1922); Livro de referência: Stallings, *Cryptography and Network Security*, cap. 3 |
| [Vigenère, Kasiski e índice de coincidência](vigenere.md) | Cifra polialfabética, tabela de Vigenère e como Eva descobre o tamanho e as letras da chave por Kasiski, IC e frequência por coluna. | didático (cifra polialfabética) | Teste de Kasiski (1863) e índice de coincidência de Friedman; Livro de referência: Stallings, *Cryptography and Network Security*, cap. 3 |
| [Playfair e Hill](playfair-hill.md) | Cifras poligráficas: digrafos em uma grade 5 × 5 e multiplicação por matriz módulo 26, com o ataque de texto claro conhecido contra o Hill. | didático (digrafos e matrizes módulo 26) | Playfair (Wheatstone, 1854) e Hill (1929); Livro de referência: Stallings, *Cryptography and Network Security*, cap. 3 |
| [Transposição e cifra produto](transposicao.md) | Cerca de trilhos, transposição colunar e a combinação com substituição (confusão e difusão), com a anagramação de Eva. | didático (transposição e cifra produto) | Shannon, *Communication Theory of Secrecy Systems* (1949): confusão e difusão; Livro de referência: Stallings, *Cryptography and Network Security*, cap. 3 |
| [Máquina Enigma](enigma.md) | Enigma I: rotores, refletor, anéis e plugues, o caminho do sinal tecla a tecla e a criptoanálise de Eva por texto provável. | didático (Enigma I) | Enigma I do Exército alemão (Wehrmacht), rotores I a V e refletores B e C; Rejewski, Turing e Welchman: criptoanálise por texto provável |
| [Enigma, fase 2: a Bombe](enigma-bombe.md) | O ataque de Turing e Welchman: menu do texto provável, hipótese de plugue, propagação, contradição e paradas falsas, com Alice, Bob e Eva. | didático (Bombe de Turing e Welchman) | Turing e Welchman (Bletchley Park): a Bombe e o painel diagonal; Enigma I: rotores I a V, refletor B |
| [One-time pad](otp.md) | Sigilo perfeito de Shannon, a maleabilidade e a destruição do sigilo quando a chave é reutilizada, com o arrasto de texto provável de Eva. | didático (soma módulo 26) | Shannon, *Communication Theory of Secrecy Systems* (1949): sigilo perfeito; Vernam (1917) e Mauborgne |

## Criptografia Simétrica

Uma única chave compartilhada cifra e decifra. Base da proteção de dados em trânsito e em repouso.

| Laboratório | Resumo | Motor | Padrões e referências |
| --- | --- | --- | --- |
| [DES e Triple DES](des.md) | A rede de Feistel de 16 rodadas operação por operação, a busca exaustiva de Eva contra a chave de 56 bits e o Triple DES, com Alice e Bob. | didático (DES e Triple DES sobre bits, com rastro; conferido com o OpenSSL) | [FIPS 46-3](https://csrc.nist.gov/pubs/fips/46-3/final) (Data Encryption Standard), retirada pelo NIST em 19 de maio de 2005; [SP 800-67 Rev. 2](https://csrc.nist.gov/pubs/sp/800/67/r2/final) (Triple DES), retirada pelo NIST em 1º de janeiro de 2024; [FIPS 197](https://csrc.nist.gov/pubs/fips/197/final) (AES), o padrão vigente de cifra de bloco |
| [AES e modos de operação](aes.md) | As rodadas do AES operação por operação e a comparação de ECB, CBC, CTR e GCM diante de Eva, que observa e altera a cifra. | didático (ECB, CBC e CTR) e real (GCM, pela Web Crypto) | [FIPS 197](https://csrc.nist.gov/pubs/fips/197/final) (AES); NIST [SP 800-38A](https://csrc.nist.gov/pubs/sp/800/38/a/final) (ECB, CBC e CTR) e [SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final) (GCM) |
| [ChaCha20](chacha20.md) | Cifra de fluxo ARX ([RFC 8439](https://www.rfc-editor.org/rfc/rfc8439)): quarter round e bloco operação por operação, nonce reutilizado e maleabilidade diante de Eva. | didático (ChaCha20 sem Poly1305) | [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439) (ChaCha20 e Poly1305 para protocolos IETF); O ChaCha20 não é um algoritmo aprovado pelo NIST (não consta em nenhuma FIPS nem SP): a referência normativa é a [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439) |
| [Primitivas: funções hash e HMAC](hash-hmac.md) | SHA-2 reais, efeito avalanche visualizado bit a bit e HMAC calculado passo a passo ([RFC 2104](https://www.rfc-editor.org/rfc/rfc2104)). | real (Web Crypto: SHA-1, SHA-256, SHA-384 e SHA-512) e HMAC passo a passo | [FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) (SHA-2); [RFC 2104](https://www.rfc-editor.org/rfc/rfc2104) e [FIPS 198-1](https://csrc.nist.gov/pubs/fips/198-1/final) (HMAC); A [FIPS 198-1](https://csrc.nist.gov/pubs/fips/198-1/final) está em processo de retirada: o NIST propôs mover o conteúdo para o [SP 800-224](https://csrc.nist.gov/pubs/sp/800/224/ipd) (rascunho de junho de 2024) e retirá-la quando o [SP 800-224](https://csrc.nist.gov/pubs/sp/800/224/ipd) final for publicado. Até lá, continua vigente; [RFC 4231](https://www.rfc-editor.org/rfc/rfc4231) (vetores de teste do HMAC-SHA-2) |

## Criptografia Assimétrica e Acordo de Chaves

Pares de chaves pública e privada, assinaturas digitais e estabelecimento de segredos por canais inseguros.

| Laboratório | Resumo | Motor | Padrões e referências |
| --- | --- | --- | --- |
| [RSA](rsa.md) | Geração de chaves, cifragem, decifragem e assinatura digital, em versão didática (BigInt) e real (RSA-OAEP e RSA-PSS). | didático (BigInt, sem padding) e real (Web Crypto) | [RFC 8017](https://www.rfc-editor.org/rfc/rfc8017) (PKCS #1 v2.2: RSAES-OAEP e RSASSA-PSS); [FIPS 186-5](https://csrc.nist.gov/pubs/fips/186-5/final) (assinaturas RSA, incluindo o RSASSA-PSS); [FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) (SHA-2, usado no OAEP e no PSS); NIST [SP 800-56B Rev. 2](https://csrc.nist.gov/pubs/sp/800/56/b/r2/final) (estabelecimento de chaves com RSA); NIST [SP 800-57 Parte 1 Rev. 5](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final) (tamanhos de chave) |
| [Diffie-Hellman](diffie-hellman.md) | Acordo de chaves por um canal público, visão de Eva, derivação de chave com HKDF e o ataque do homem do meio. | didático (BigInt) com HKDF e AES-GCM reais (Web Crypto) | [RFC 7919](https://www.rfc-editor.org/rfc/rfc7919) (grupos de Diffie-Hellman finitos negociados); NIST [SP 800-56A Rev. 3](https://csrc.nist.gov/pubs/sp/800/56/a/r3/final) (acordo de chaves por logaritmo discreto); [RFC 5869](https://www.rfc-editor.org/rfc/rfc5869) (HKDF) e NIST [SP 800-56C Rev. 2](https://csrc.nist.gov/pubs/sp/800/56/c/r2/final) (derivação de chaves); [FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) (SHA-256, usado no HKDF); NIST [SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final) (AES-GCM); [RFC 7748](https://www.rfc-editor.org/rfc/rfc7748) (X25519) |
| [ECDH, ECDSA e Ed25519](ecdh-assinaturas.md) | Aritmética de curvas elípticas passo a passo, ECDH e ECDSA em uma curva didática (com o ataque ao nonce reutilizado) e assinaturas reais ECDSA P-256 e Ed25519. | didático (curva minúscula, BigInt) e real (Web Crypto: ECDSA P-256 e Ed25519) | [RFC 6979](https://www.rfc-editor.org/rfc/rfc6979) (ECDSA determinístico); [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032) (Ed25519); [RFC 7748](https://www.rfc-editor.org/rfc/rfc7748) (X25519); [FIPS 186-5](https://csrc.nist.gov/pubs/fips/186-5/final) (ECDSA e EdDSA); NIST [SP 800-186](https://csrc.nist.gov/pubs/sp/800/186/final) (curvas elípticas recomendadas, como a P-256); NIST [SP 800-56A Rev. 3](https://csrc.nist.gov/pubs/sp/800/56/a/r3/final) (ECDH) |
| [Handshake do TLS 1.3](tls13.md) | ECDHE, cronograma de chaves com HKDF, certificado, CertificateVerify e Finished, com Eva observando e como homem do meio. | real (Web Crypto: ECDHE P-256, HKDF-SHA-256, ECDSA P-256, HMAC e AES-128-GCM) | [RFC 9846](https://www.rfc-editor.org/rfc/rfc9846) (TLS 1.3; substitui a [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446)); [RFC 8448](https://www.rfc-editor.org/rfc/rfc8448) (exemplos de handshakes do TLS 1.3, usados para conferir o cronograma de chaves); [RFC 5869](https://www.rfc-editor.org/rfc/rfc5869) (HKDF); NIST [SP 800-52 Rev. 2](https://csrc.nist.gov/pubs/sp/800/52/r2/final) (diretrizes do NIST para TLS); [FIPS 186-5](https://csrc.nist.gov/pubs/fips/186-5/final) (ECDSA); NIST [SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final) (AES-GCM) |

## Criptografia Pós-Quântica

Algoritmos que resistem a computadores quânticos, como o ML-KEM ([FIPS 203](https://csrc.nist.gov/pubs/fips/203/final)), baseado em reticulados, e a migração dos protocolos atuais.

| Laboratório | Resumo | Motor | Padrões e referências |
| --- | --- | --- | --- |
| [ML-KEM e reticulados (pós-quântica)](ml-kem.md) | O problema LWE em escala didática e o ML-KEM ([FIPS 203](https://csrc.nist.gov/pubs/fips/203/final)) passo a passo, com Eva observando e adulterando o texto cifrado, e a comparação de tamanhos com os algoritmos atuais. | didático (LWE com números minúsculos) e ML-KEM real (TypeScript, conferido contra o OpenSSL 3.5) | [FIPS 203](https://csrc.nist.gov/pubs/fips/203/final) (ML-KEM, antigo CRYSTALS-Kyber); [FIPS 202](https://csrc.nist.gov/pubs/fips/202/final) (SHA-3 e SHAKE, usados pelo ML-KEM); [FIPS 204](https://csrc.nist.gov/pubs/fips/204/final) (ML-DSA) e [FIPS 205](https://csrc.nist.gov/pubs/fips/205/final) (SLH-DSA): assinaturas pós-quânticas, citadas e não implementadas |


---

*CryptoNet é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).*
