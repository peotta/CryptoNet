// Gera a documentação dos laboratórios do CryptoNet Lab a partir do registro (src/labs/registry.ts),
// dos textos de cada laboratório (content.ts) e dos fluxos de Alice, Bob e Eva (flows.ts).
//
// Uso:
//   npm run docs:labs                    gera docs/laboratorios/ (um documento por laboratório e o índice)
//   npm run wiki -- <pasta-de-saida>     gera as páginas da wiki (Markdown); a pasta de saída não é versionada aqui
//
// Os fluxos são executados de verdade, com entradas fixas, e convertidos em diagramas de sequência Mermaid.
// Os valores aleatórios (chaves, nonces) não aparecem no texto: só títulos, rótulos e papéis.
// Edições manuais nas páginas geradas são sobrescritas na próxima geração.
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = process.argv.includes('--docs');
const outArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!outArg) {
  console.error('Uso: npm run docs:labs   |   npm run wiki -- <pasta-de-saida>');
  process.exit(1);
}
const out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });

// Aleatoriedade com semente fixa: chaves, nonces e sorteios do texto gerado ficam iguais a cada execução
// (assim o git só mostra mudanças reais na documentação). Só afeta esta execução do gerador, não a aplicação.
let seed = 0x43727970;
const prng = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
Object.defineProperty(globalThis.crypto, 'getRandomValues', {
  configurable: true,
  value: (arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(prng() * 256);
    return arr;
  },
});

const server = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  define: { 'import.meta.env.BASE_URL': JSON.stringify('/') },
});
const load = (p) => server.ssrLoadModule(p);

const SITE = 'https://peotta.github.io/CryptoNet/';
const REPO = 'https://github.com/peotta/CryptoNet';
const CRED =
  'CryptoNet é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).';
// Na wiki, o crédito vem do _Footer.md; nos documentos, cada arquivo leva o seu.
const footer = DOCS ? `\n\n---\n\n*${CRED}*\n` : '\n';
const pageName = (id) => (DOCS ? id : `laboratorio-${id}`);
const pageRef = (id) => (DOCS ? `${id}.md` : pageName(id));

// ---------------------------------------------------------------------------------------------
// Valores fixos de entrada. As chaves e os nonces são aleatórios e não entram no texto gerado.
// ---------------------------------------------------------------------------------------------
const TEXTO =
  'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol, atravessar o vale em silêncio e esperar o sinal do comandante junto à ponte velha. Quem for visto pelos moradores deverá voltar imediatamente ao acampamento e aguardar novas ordens. Ninguém deve acender fogueiras durante a noite, porque a fumaça denunciaria a posição de todo o grupo ao inimigo que vigia a estrada principal.';
const TEXTO_ENIGMA =
  'Relatório do tempo sem novidades. Nada a reportar nesta madrugada. Mantenha a posição até nova ordem. Aguardamos a confirmação do comando no horário combinado e seguiremos as instruções recebidas ontem à noite pelo rádio';
const CONFIG_ENIGMA = { rotors: ['I', 'II', 'III'], reflector: 'B', positions: 'KLM', rings: 'AAA', plugs: 'AV BS CG DL FU HZ IN KM OW RX' };
const CONFIG_BOMBE = { ...CONFIG_ENIGMA, positions: 'QDV' };
const SUBKEY = 'QWERTYUIOPASDFGHJKLZXCVBNM';
const enc = new TextEncoder();
const rnd = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const hexOf = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Cada laboratório: onde está o código, os padrões, o resumo conceitual, as limitações e os cenários (com as
 * entradas fixas que os produzem). Os textos aqui são autorais; objetivos, perguntas e títulos vêm do código.
 */
const SPECS = {
  'cesar-afim': {
    dir: 'classica',
    motor: 'didático (aritmética modular)',
    engine: 'src/crypto/classical.ts',
    content: ['CLASSICAL_OBJECTIVES', 'CLASSICAL_QUESTIONS'],
    padroes: ['Livro de referência: Stallings, *Cryptography and Network Security*, cap. 3 (cifras clássicas).'],
    resumo:
      'As cifras de César e afim substituem cada letra por outra por meio de uma função módulo 26 (C = a·P + b mod 26; no César, a = 1). O espaço de chaves é minúsculo (26 chaves no César, 312 no afim), e a distribuição das letras do português continua visível no texto cifrado. Eva quebra a cifra por força bruta e confirma a chave pela frequência das letras (teste χ²).',
    limites: ['Cifras históricas: não oferecem segurança alguma.', 'O alfabeto é o de 26 letras sem acentos; o texto é normalizado (maiúsculas, sem acentos nem pontuação).'],
    partes: [
      {
        titulo: 'Alice, Bob e Eva',
        cenarios: [
          { titulo: 'César sem adulteração', entradas: 'cifra César, deslocamento 3', build: async (c) => c.mod.classica.build((await c.mod.classica.run(c.E.classical, { cipher: 'cesar', key: { a: 1, b: 3 }, text: TEXTO, tamper: false })).flow) },
          { titulo: 'Afim com Eva alterando o texto cifrado', entradas: 'cifra afim, a = 5 e b = 8; Eva troca uma letra', build: async (c) => c.mod.classica.build((await c.mod.classica.run(c.E.classical, { cipher: 'afim', key: { a: 5, b: 8 }, text: TEXTO, tamper: true })).flow) },
        ],
      },
    ],
  },
  'substituicao-frequencia': {
    dir: 'substituicao',
    motor: 'didático (permutação de 26 letras)',
    engine: 'src/crypto/substitution.ts',
    content: ['SUBSTITUTION_OBJECTIVES', 'SUBSTITUTION_QUESTIONS'],
    padroes: ['Índice de coincidência: Friedman (1922).', 'Livro de referência: Stallings, *Cryptography and Network Security*, cap. 3.'],
    resumo:
      'Na substituição simples a chave é uma permutação das 26 letras (26! ≈ 4,0 × 10²⁶ chaves), grande demais para a força bruta. Mesmo assim, cada letra clara sempre vira a mesma letra cifrada, e a distribuição de frequências, o índice de coincidência e os pares de letras (bigramas) do português permitem a Eva reconstruir a chave.',
    limites: ['Cifra histórica: não oferece segurança.', 'O refinamento usa estatísticas de um corpus pequeno em português; textos muito curtos podem não ser quebrados.'],
    partes: [
      {
        titulo: 'Alice, Bob e Eva',
        cenarios: [{ titulo: 'Substituição simples e criptoanálise de Eva', entradas: 'chave QWERTY…, texto de cerca de 500 letras', build: async (c) => c.mod.substituicao.build((await c.mod.substituicao.run(c.E.classical, { key: SUBKEY, text: TEXTO, tamper: false })).flow) }],
      },
    ],
  },
  vigenere: {
    dir: 'vigenere',
    motor: 'didático (cifra polialfabética)',
    engine: 'src/crypto/vigenere.ts',
    content: ['VIGENERE_OBJECTIVES', 'VIGENERE_QUESTIONS'],
    padroes: ['Teste de Kasiski (1863) e índice de coincidência de Friedman.', 'Livro de referência: Stallings, *Cryptography and Network Security*, cap. 3.'],
    resumo:
      'A cifra de Vigenère usa uma palavra como chave e aplica um César diferente a cada posição, o que achata as frequências. Eva descobre o tamanho da chave pela repetição de trechos (Kasiski) e pelo índice de coincidência por tamanho candidato, e então resolve cada coluna como um César.',
    limites: ['Cifra histórica: não oferece segurança.', 'A chave tem de 1 a 20 letras; textos curtos tornam o ataque estatístico pouco confiável.'],
    partes: [
      {
        titulo: 'Alice, Bob e Eva',
        cenarios: [{ titulo: 'Vigenère e criptoanálise de Eva', entradas: 'chave SEGREDO', build: async (c) => c.mod.vigenere.build((await c.mod.vigenere.run(c.E.classical, { key: 'SEGREDO', text: TEXTO, tamper: false })).flow) }],
      },
    ],
  },
  'playfair-hill': {
    dir: 'playfair-hill',
    motor: 'didático (digrafos e matrizes módulo 26)',
    engine: 'src/crypto/playfair.ts e src/crypto/hill.ts',
    content: ['POLY_OBJECTIVES', 'POLY_QUESTIONS'],
    padroes: ['Playfair (Wheatstone, 1854) e Hill (1929).', 'Livro de referência: Stallings, *Cryptography and Network Security*, cap. 3.'],
    resumo:
      'O Playfair cifra pares de letras (digrafos) sobre uma grade 5 × 5 montada com uma palavra-chave (I e J compartilham a célula). O Hill cifra blocos de n letras multiplicando-os por uma matriz n × n invertível módulo 26. O Hill é linear e, por isso, cai diante de um ataque de texto claro conhecido: com n pares independentes, Eva resolve a matriz.',
    limites: ['Cifras históricas: não oferecem segurança.', 'O Hill aceita matrizes 2 × 2 e 3 × 3; o ataque exige blocos independentes (determinante invertível módulo 26).'],
    partes: [
      {
        titulo: 'Playfair',
        cenarios: [{ titulo: 'Playfair com a palavra-chave MONARQUIA', entradas: 'palavra-chave MONARQUIA', build: async (c) => c.mod.playfair.build((await c.mod.playfair.run(c.E.classical, { keyword: 'MONARQUIA', text: TEXTO, tamper: false })).flow) }],
      },
      {
        titulo: 'Hill',
        cenarios: [{ titulo: 'Hill 2 × 2 e ataque de texto claro conhecido', entradas: 'matriz [3 3; 2 5], 24 letras conhecidas', build: async (c) => c.mod.hill.build((await c.mod.hill.run(c.E.classical, { key: [[3, 3], [2, 5]], text: 'Atacar a ponte ao amanhecer sem avisar ninguém pois a surpresa é a nossa melhor arma', knownLetters: 24, tamper: false })).flow) }],
      },
    ],
  },
  transposicao: {
    dir: 'transposicao',
    motor: 'didático (transposição e cifra produto)',
    engine: 'src/crypto/transposition.ts',
    content: ['TRANSPOSICAO_OBJECTIVES', 'TRANSPOSICAO_QUESTIONS'],
    padroes: ['Shannon, *Communication Theory of Secrecy Systems* (1949): confusão e difusão.', 'Livro de referência: Stallings, *Cryptography and Network Security*, cap. 3.'],
    resumo:
      'Na transposição as letras não mudam, apenas de lugar (cerca de trilhos e transposição colunar com palavra-chave). Como a frequência das letras permanece a do português, Eva reconhece a cifra e a quebra por anagramação, escolhendo a ordem que produz o texto mais legível. Combinar substituição (confusão) com transposição (difusão) resulta na cifra produto, a ideia por trás das cifras modernas.',
    limites: ['Cifras históricas: não oferecem segurança.', 'A anagramação cobre de 2 a 8 colunas e a legibilidade é medida por bigramas do português.'],
    partes: [
      {
        titulo: 'Alice, Bob e Eva',
        cenarios: [
          { titulo: 'Cerca de trilhos', entradas: '4 trilhos', build: async (c) => c.mod.transposicao.build((await c.mod.transposicao.run(c.E.classical, { mode: 'trilhos', text: TEXTO, rails: 4, keyword: 'CHAVE', subKey: SUBKEY, tamper: false })).flow) },
          { titulo: 'Transposição colunar', entradas: 'palavra-chave CHAVE', build: async (c) => c.mod.transposicao.build((await c.mod.transposicao.run(c.E.classical, { mode: 'colunar', text: TEXTO, rails: 4, keyword: 'CHAVE', subKey: SUBKEY, tamper: false })).flow) },
          { titulo: 'Cifra produto (substituição e transposição)', entradas: 'chave QWERTY… e palavra-chave CHAVE', build: async (c) => c.mod.transposicao.build((await c.mod.transposicao.run(c.E.classical, { mode: 'produto', text: TEXTO, rails: 4, keyword: 'CHAVE', subKey: SUBKEY, tamper: false })).flow) },
        ],
      },
    ],
  },
  enigma: {
    dir: 'enigma',
    motor: 'didático (Enigma I)',
    engine: 'src/crypto/enigma.ts',
    content: ['ENIGMA_OBJECTIVES', 'ENIGMA_QUESTIONS'],
    padroes: ['Enigma I do Exército alemão (Wehrmacht), rotores I a V e refletores B e C.', 'Rejewski, Turing e Welchman: criptoanálise por texto provável.'],
    resumo:
      'A Enigma I cifra tecla a tecla: o sinal atravessa o painel de plugues, três rotores, o refletor e volta. O refletor torna a máquina recíproca (decifrar é cifrar de novo), mas impede que uma letra seja cifrada nela mesma, e essa fraqueza permite a Eva descartar alinhamentos de um texto provável (crib). Com 3 rotores escolhidos entre 5, 17.576 posições iniciais e 10 pares de plugues, há cerca de 1,6 × 10²⁰ configurações.',
    limites: ['Cifra histórica: não oferece segurança.', 'O modelo cobre a Enigma I (três rotores, anéis e plugues); não simula variantes navais com quatro rotores.'],
    partes: [
      {
        titulo: 'Alice, Bob e Eva',
        cenarios: [{ titulo: 'Cifragem, reciprocidade e texto provável', entradas: 'rotores I II III, refletor B, posições KLM, 10 plugues, texto provável RELATORIO', build: async (c) => c.mod.enigma.build((await c.mod.enigma.run(c.E.classical, { config: CONFIG_ENIGMA, text: TEXTO_ENIGMA, crib: 'RELATORIO', tamper: false })).flow) }],
      },
    ],
  },
  'enigma-bombe': {
    dir: 'enigma-bombe',
    motor: 'didático (Bombe de Turing e Welchman)',
    engine: 'src/crypto/bombe.ts',
    content: ['BOMBE_OBJECTIVES', 'BOMBE_QUESTIONS'],
    padroes: ['Turing e Welchman (Bletchley Park): a Bombe e o painel diagonal.', 'Enigma I: rotores I a V, refletor B.'],
    resumo:
      'A Bombe testa as 17.576 posições iniciais dos rotores contra um texto provável. O menu liga as letras do texto claro às da cifra; uma hipótese de plugue para a letra de teste se propaga pelos laços do menu, e uma contradição elimina a posição. As posições que sobrevivem (paradas) são verificadas, e as paradas falsas são descartadas pelos laços.',
    limites: ['Cifra histórica: não oferece segurança.', 'O laboratório supõe que Eva conhece ou supõe a ordem dos rotores, o refletor e o texto provável, e simula a lógica da Bombe, não a máquina eletromecânica.'],
    partes: [
      {
        titulo: 'Alice, Bob e Eva',
        cenarios: [{ titulo: 'Menu, propagação e paradas', entradas: 'rotores I II III, refletor B, posições iniciais QDV, texto provável RELATORIODOTEMPO', build: async (c) => c.mod.bombe.build((await c.mod.bombe.run(c.E.classical, { config: CONFIG_BOMBE, text: TEXTO_ENIGMA, crib: 'RELATORIODOTEMPO', cribPosition: 1 })).flow) }],
      },
    ],
  },
  otp: {
    dir: 'otp',
    motor: 'didático (soma módulo 26)',
    engine: 'src/crypto/otp.ts',
    content: ['OTP_OBJECTIVES', 'OTP_QUESTIONS'],
    padroes: ['Shannon, *Communication Theory of Secrecy Systems* (1949): sigilo perfeito.', 'Vernam (1917) e Mauborgne.'],
    resumo:
      'O one-time pad soma a mensagem a uma chave verdadeiramente aleatória, do tamanho da mensagem e usada uma única vez. Nessas condições o sigilo é perfeito: o texto cifrado não revela nada além do tamanho. A cifra é maleável (Eva altera o claro sem conhecer a chave) e, se a chave for reutilizada, a soma das duas cifras elimina a chave e expõe a soma dos claros, que Eva explora com o arrasto de texto provável (como no projeto Venona).',
    limites: ['O laboratório usa o alfabeto de 26 letras; o one-time pad real opera sobre bits e exige distribuição segura de chaves tão longas quanto os dados.'],
    partes: [
      {
        titulo: 'Uso correto',
        cenarios: [{ titulo: 'Sigilo perfeito', entradas: 'chave aleatória do tamanho da mensagem', build: async (c) => c.mod.otp.build((await c.mod.otp.run(c.E.classical, { text: 'Atacar a ponte ao amanhecer sem avisar ninguém', key: c.rndLetters(300), tamper: false, decoy: null })).flow) }],
      },
      {
        titulo: 'Reutilização da chave',
        cenarios: [{ titulo: 'Two-time pad e arrasto de texto provável', entradas: 'duas mensagens com a mesma chave, texto provável AMANHECER', build: async (c) => c.mod.otp.buildReuse((await c.mod.otp.runReuse(c.E.classical, { text1: TEXTO.slice(0, 120), text2: 'O diretor da escola reuniu os professores na sala principal para discutir o calendário das provas do próximo semestre com todos', key: c.rndLetters(300), crib: 'AMANHECER', cribIn: 1 })).flow) }],
      },
    ],
  },
  rsa: {
    dir: 'rsa',
    motor: 'didático (BigInt, sem padding) e real (Web Crypto)',
    engine: 'src/crypto/rsaDidactic.ts e src/crypto/rsaWebCrypto.ts',
    content: ['RSA_OBJECTIVES', 'RSA_QUESTIONS'],
    padroes: ['[RFC 8017](https://www.rfc-editor.org/rfc/rfc8017) (PKCS #1 v2.2: RSAES-OAEP e RSASSA-PSS).', 'NIST SP 800-57 (tamanhos de chave).'],
    resumo:
      'No RSA, n = p·q, e é coprimo de φ(n) e d é o inverso de e módulo φ(n). Cifrar é c = mᵉ mod n e decifrar é m = cᵈ mod n; assinar usa a chave privada e verificar usa a pública. O modo didático usa primos pequenos e nenhum padding (inseguro); o modo real usa RSA-OAEP (cifragem) e RSA-PSS (assinatura) pela Web Crypto, com chaves de 2048 a 4096 bits.',
    limites: ['O modo didático não tem padding e usa números pequenos: é inseguro por construção.', 'No modo real, as chaves são geradas no navegador e não são extraíveis; nada é armazenado.'],
    partes: [
      {
        titulo: 'RSA didático',
        cenarios: [
          { titulo: 'Cifragem', entradas: 'p = 61, q = 53, e = 17, m = 65', build: async (c) => c.mod.rsa.build((await c.mod.rsa.runDidactic(c.E.rsaDidactic, { p: 61n, q: 53n, e: 17n, m: 65n, scenario: 'cifragem', tamper: false })).flow) },
          { titulo: 'Assinatura digital com Eva adulterando', entradas: 'p = 61, q = 53, e = 17, m = 65; Eva altera a mensagem', build: async (c) => c.mod.rsa.build((await c.mod.rsa.runDidactic(c.E.rsaDidactic, { p: 61n, q: 53n, e: 17n, m: 65n, scenario: 'assinatura', tamper: true })).flow) },
        ],
      },
      {
        titulo: 'RSA real (OAEP e PSS)',
        cenarios: [
          { titulo: 'RSA-OAEP', entradas: 'chave de 2048 bits gerada na hora', build: async (c) => { const k = await c.E.rsaReal.generateEncryptionKeys(2048); return c.mod.rsa.build((await c.mod.rsa.runReal(c.E.rsaReal, k, { text: 'Olá, Bob! Esta mensagem é confidencial.', scenario: 'cifragem', tamper: false })).flow); } },
          { titulo: 'RSA-PSS com Eva adulterando', entradas: 'chave de 2048 bits gerada na hora', build: async (c) => { const k = await c.E.rsaReal.generateSigningKeys(2048); return c.mod.rsa.build((await c.mod.rsa.runReal(c.E.rsaReal, k, { text: 'Olá, Bob! Esta mensagem é confidencial.', scenario: 'assinatura', tamper: true })).flow); } },
        ],
      },
    ],
  },
  'diffie-hellman': {
    dir: 'diffie-hellman',
    motor: 'didático (BigInt) com HKDF e AES-GCM reais (Web Crypto)',
    engine: 'src/crypto/diffieHellman.ts e src/crypto/kdf.ts',
    content: ['DH_OBJECTIVES', 'DH_QUESTIONS'],
    padroes: ['[RFC 7919](https://www.rfc-editor.org/rfc/rfc7919) (grupos DH finitos negociados).', '[RFC 5869](https://www.rfc-editor.org/rfc/rfc5869) (HKDF).', '[RFC 7748](https://www.rfc-editor.org/rfc/rfc7748) (X25519).'],
    resumo:
      'No Diffie-Hellman, Alice e Bob escolhem expoentes privados a e b e trocam A = gᵃ mod p e B = gᵇ mod p; ambos obtêm K = gᵃᵇ mod p. Eva vê p, g, A e B, mas recuperar a ou b é o problema do logaritmo discreto. O protocolo não autentica ninguém, por isso um homem do meio (Eva ativa) estabelece um segredo com cada lado. Na prática, K passa por uma função de derivação (HKDF) e alimenta um algoritmo simétrico como o AES-GCM.',
    limites: ['Os grupos são pequenos, por finalidade didática: não há grupo de 2048 bits no laboratório e nenhum valor aqui oferece segurança.', 'A extensão HKDF e AES-GCM usa a Web Crypto (operação real).'],
    partes: [
      {
        titulo: 'Troca de chaves',
        cenarios: [
          { titulo: 'Acordo de chaves com Eva observando', entradas: 'p = 23, g = 5, a = 6, b = 15', build: async (c) => c.mod.dh.build(await c.E.diffieHellman.runSession(23n, 5n, 6n, 15n)) },
          { titulo: 'Homem do meio', entradas: 'p = 23, g = 5, a = 6, b = 15, expoente de Eva = 13', build: async (c) => c.mod.dh.buildMitm(await c.E.diffieHellman.runMitm(23n, 5n, 6n, 15n, 13n)) },
        ],
      },
    ],
  },
  'ecdh-assinaturas': {
    dir: 'ecc',
    motor: 'didático (curva minúscula, BigInt) e real (Web Crypto: ECDSA P-256 e Ed25519)',
    engine: 'src/crypto/ecc.ts',
    content: ['ECC_OBJECTIVES', 'ECC_QUESTIONS'],
    padroes: ['[RFC 6979](https://www.rfc-editor.org/rfc/rfc6979) (ECDSA determinístico).', '[RFC 8032](https://www.rfc-editor.org/rfc/rfc8032) (Ed25519).', '[RFC 7748](https://www.rfc-editor.org/rfc/rfc7748) (X25519).', 'FIPS 186-5 (ECDSA e curvas P-256).'],
    resumo:
      'Numa curva elíptica sobre um corpo finito, somar pontos e multiplicar por um escalar (dobrar e somar) são operações fáceis, mas descobrir k a partir de k·G é o logaritmo discreto elíptico. O ECDH acorda um segredo; o ECDSA assina com um nonce k que não pode se repetir (repetir k revela a chave privada, como no caso do PlayStation 3). O Ed25519 deriva o nonce da chave e da mensagem, sem sorteio.',
    limites: ['A curva didática tem 19 pontos: qualquer chave cai por tentativa e nada ali oferece segurança.', 'As assinaturas reais (ECDSA P-256 e Ed25519) dependem do suporte do navegador à Web Crypto; o Ed25519 pode não estar disponível em versões antigas.'],
    partes: [
      {
        titulo: 'ECDH na curva didática',
        cenarios: [{ titulo: 'ECDH e logaritmo discreto por força bruta', entradas: 'a = 11, b = 7', build: async (c) => c.mod.ecc.buildEcdhProtocol(await c.mod.ecc.runEcdh(c.E.ecc, { a: 11n, b: 7n })) }],
      },
      {
        titulo: 'ECDSA na curva didática',
        cenarios: [
          { titulo: 'Uso correto, com Eva alterando a mensagem', entradas: 'd = 7, k = 9', build: async (c) => c.mod.ecc.buildEcdsaProtocol(await c.mod.ecc.runEcdsa(c.E.ecc, { d: 7n, k: 9n, m1: 'PAGAR R$ 100 A BOB', m2: 'PAGAR R$ 900 A BOB', reuse: false, tamper: true })) },
          { titulo: 'Nonce reutilizado', entradas: 'd = 7, k = 9 nas duas assinaturas', build: async (c) => c.mod.ecc.buildEcdsaProtocol(await c.mod.ecc.runEcdsa(c.E.ecc, { d: 7n, k: 9n, m1: 'PAGAR R$ 100 A BOB', m2: 'PAGAR R$ 900 A BOB', reuse: true, tamper: false })) },
        ],
      },
      {
        titulo: 'Assinaturas reais',
        cenarios: [
          { titulo: 'ECDSA P-256 com Eva alterando a mensagem', entradas: 'mensagem "Transferir R$ 100"', build: async (c) => c.mod.ecc.buildRealProtocol(await c.mod.ecc.runRealSignature(c.E.ecc, { algo: 'ECDSA-P256', message: 'Transferir R$ 100', tamper: true })) },
        ],
      },
    ],
  },
  tls13: {
    dir: 'tls13',
    motor: 'real (Web Crypto: ECDHE P-256, HKDF-SHA-256, ECDSA P-256, HMAC e AES-128-GCM)',
    engine: 'src/crypto/tls13.ts',
    content: ['TLS_OBJECTIVES', 'TLS_QUESTIONS'],
    padroes: ['[RFC 9846](https://www.rfc-editor.org/rfc/rfc9846) (TLS 1.3; substitui a RFC 8446).', '[RFC 8448](https://www.rfc-editor.org/rfc/rfc8448) (exemplos de handshakes do TLS 1.3, usados para conferir o cronograma de chaves).', '[RFC 5869](https://www.rfc-editor.org/rfc/rfc5869) (HKDF).'],
    resumo:
      'O handshake de 1-RTT do TLS 1.3 acorda a chave com ECDHE, deriva os segredos pelo cronograma de chaves (HKDF-Extract e HKDF-Expand-Label), autentica o servidor com certificado e CertificateVerify e confirma tudo com o Finished. Eva vê o ClientHello e o ServerHello, mas não as mensagens cifradas. Como homem do meio, ela só passa se o cliente deixar de validar o certificado.',
    limites: ['Suíte única (TLS_AES_128_GCM_SHA256) e grupo único (P-256); não há negociação, HelloRetryRequest, retomada de sessão (PSK) nem 0-RTT.', 'O certificado é gerado no laboratório e não é validado por uma cadeia de uma autoridade certificadora real.'],
    partes: [
      {
        titulo: 'Handshake',
        cenarios: [
          { titulo: 'Handshake normal, com Eva observando', entradas: 'servidor banco.exemplo', build: async (c) => c.mod.tls.build((await c.mod.tls.run(c.E.tls, { serverName: 'banco.exemplo', message: 'GET /saldo', scenario: 'normal', clientVerifies: true })).hs) },
          { titulo: 'Eva como homem do meio, com o cliente validando', entradas: 'cliente valida o certificado', build: async (c) => c.mod.tls.build((await c.mod.tls.run(c.E.tls, { serverName: 'banco.exemplo', message: 'GET /saldo', scenario: 'mitm', clientVerifies: true })).hs) },
        ],
      },
    ],
  },
  aes: {
    dir: 'aes',
    motor: 'didático (ECB, CBC e CTR) e real (GCM, pela Web Crypto)',
    engine: 'src/crypto/aes.ts',
    content: ['AES_OBJECTIVES', 'AES_QUESTIONS'],
    padroes: ['FIPS 197 (AES).', 'NIST SP 800-38A (ECB, CBC e CTR) e SP 800-38D (GCM).'],
    resumo:
      'O AES opera em blocos de 16 bytes e repete rodadas de SubBytes, ShiftRows, MixColumns e AddRoundKey (10 rodadas com chave de 128 bits). O modo de operação define como os blocos se combinam: o ECB vaza padrões (blocos iguais geram cifras iguais), o CBC e o CTR os ocultam, mas só o GCM, um modo autenticado, detecta a adulteração por Eva.',
    limites: ['A implementação didática (ECB, CBC e CTR) não é resistente a ataques de canal lateral nem deve ser usada em produção.', 'Não há preenchimento: a mensagem é completada com espaços até múltiplo de 16 bytes.'],
    partes: [
      {
        titulo: 'Modos de operação',
        cenarios: ['ECB', 'CBC', 'CTR', 'GCM'].map((mode) => ({
          titulo: `${mode} com Eva alterando um bloco`,
          entradas: `modo ${mode}, chave de 128 bits aleatória`,
          build: async (c) => {
            const iv = mode === 'ECB' ? null : mode === 'CBC' ? rnd(16) : rnd(12);
            return c.mod.aes.build((await c.mod.aes.run(c.E.aes, { mode, key: rnd(16), iv, text: 'PAGAR R$ 1000,00PAGAR R$ 1000,00CONFIRMADO POR B', tamper: true, tamperBlock: 2 })).flow);
          },
        })),
      },
    ],
  },
  chacha20: {
    dir: 'chacha20',
    motor: 'didático (ChaCha20 sem Poly1305)',
    engine: 'src/crypto/chacha20.ts',
    content: ['CHACHA_OBJECTIVES', 'CHACHA_QUESTIONS'],
    padroes: ['[RFC 8439](https://www.rfc-editor.org/rfc/rfc8439) (ChaCha20 e Poly1305 para protocolos IETF).'],
    resumo:
      'O ChaCha20 é uma cifra de fluxo ARX (soma módulo 2³², rotação e XOR): o bloco de 64 bytes é calculado em 20 rodadas sobre um estado com constantes, chave de 256 bits, contador e nonce de 96 bits, e o fluxo de chaves é combinado com a mensagem por XOR. Repetir o par (chave, nonce) permite a Eva obter m1 ⊕ m2, e sem autenticação ela inverte bits do claro sem conhecer a chave.',
    limites: ['O laboratório usa só o ChaCha20, sem o Poly1305: por isso a cifra não autentica (o ChaCha20-Poly1305 é o AEAD usado no TLS 1.3).', 'A mensagem é limitada a 120 bytes.'],
    partes: [
      {
        titulo: 'Uso correto',
        cenarios: [{ titulo: 'Eva observa e altera um byte', entradas: 'chave e nonce aleatórios', build: async (c) => c.mod.chacha.build((await c.mod.chacha.run(c.E.chacha, { key: rnd(32), nonce: rnd(12), text: 'PAGAR R$ 1000,00 PARA BOB', tamper: true, tamperByte: 10 })).flow) }],
      },
      {
        titulo: 'Nonce reutilizado',
        cenarios: [{ titulo: 'Arrasto de texto provável', entradas: 'mesma chave e mesmo nonce, texto provável AMANHECER', build: async (c) => c.mod.chacha.buildReuse((await c.mod.chacha.runReuse(c.E.chacha, { key: rnd(32), nonce: rnd(12), text1: 'ATAQUE A PONTE AO AMANHECER SEM AVISAR', text2: 'RECUAR PARA A FLORESTA AO ANOITECER AGORA', crib: 'AMANHECER', cribIn: 1 })).flow) }],
      },
    ],
  },
  'hash-hmac': {
    dir: 'hash-hmac',
    motor: 'real (Web Crypto: SHA-1, SHA-256, SHA-384 e SHA-512) e HMAC passo a passo',
    engine: 'src/crypto/hash.ts',
    content: ['HASH_OBJECTIVES', 'HASH_QUESTIONS'],
    padroes: ['FIPS 180-4 (SHA-2).', '[RFC 2104](https://www.rfc-editor.org/rfc/rfc2104) e FIPS 198-1 (HMAC).', '[RFC 4231](https://www.rfc-editor.org/rfc/rfc4231) (vetores de teste do HMAC-SHA-2).'],
    resumo:
      'Uma função hash produz um resumo de tamanho fixo e tem o efeito avalanche: trocar um bit da entrada altera cerca de metade dos bits da saída. Hash não é cifragem nem autentica quem enviou. O HMAC combina o hash com uma chave secreta em duas passagens (ipad e opad), e só quem tem a chave calcula a etiqueta correta, o que impede Eva de alterar a mensagem sem ser notada.',
    limites: ['O SHA-1 está disponível apenas para comparação: é considerado legado.', 'O avalanche é medido por amostragem de entradas aleatórias, não por prova.'],
    partes: [
      {
        titulo: 'HMAC',
        cenarios: [
          { titulo: 'HMAC-SHA-256 com Eva alterando a mensagem', entradas: 'chave "segredo", mensagem "Transferir R$ 100"', build: async (c) => c.mod.hmac.build(await hmacFlow(c, 'Transferir R$ 100', true)) },
        ],
      },
    ],
  },
};

async function hmacFlow(c, message, tamper) {
  const { toHex, utf8Encode } = c.mod.encoding;
  const { constantTimeEqual } = c.mod.hash;
  const key = 'segredo';
  const k = utf8Encode(key);
  const received = tamper ? `${message}!` : message;
  const sent = await c.E.hash.hmac('SHA-256', k, utf8Encode(message));
  const again = await c.E.hash.hmac('SHA-256', k, utf8Encode(received));
  return {
    algo: 'SHA-256',
    keyText: key,
    keyBytes: k.length,
    blockBytes: sent.trace.block,
    keyWasHashed: sent.trace.keyWasHashed,
    message,
    receivedMessage: received,
    innerHex: toHex(sent.trace.inner),
    tagHex: toHex(sent.trace.tag),
    recomputedHex: toHex(again.trace.tag),
    tampered: tamper,
    ok: constantTimeEqual(sent.trace.tag, again.trace.tag),
  };
}

// ---------------------------------------------------------------------------------------------
// Carga dos módulos do projeto (pelo Vite, que entende o TypeScript)
// ---------------------------------------------------------------------------------------------
const { LABS, CATEGORIES } = await load('/src/labs/registry.ts');
const { engines: E } = await load('/src/crypto/engines.ts');
const { ProtocolSimulationEngine } = await load('/src/simulation/timeline.ts');
const encoding = await load('/src/crypto/encoding.ts');
const hashMod = await load('/src/crypto/hash.ts');
const L = {
  classica: { build: (await load('/src/labs/classica/flows.ts')).buildClassicalProtocol, run: (await load('/src/labs/classica/run.ts')).runClassical },
  substituicao: { build: (await load('/src/labs/substituicao/flows.ts')).buildSubstitutionProtocol, run: (await load('/src/labs/substituicao/run.ts')).runSubstitution },
  vigenere: { build: (await load('/src/labs/vigenere/flows.ts')).buildVigenereProtocol, run: (await load('/src/labs/vigenere/run.ts')).runVigenere },
  playfair: { build: (await load('/src/labs/playfair-hill/playfairFlows.ts')).buildPlayfairProtocol, run: (await load('/src/labs/playfair-hill/playfairFlows.ts')).runPlayfair },
  hill: { build: (await load('/src/labs/playfair-hill/hillFlows.ts')).buildHillProtocol, run: (await load('/src/labs/playfair-hill/hillFlows.ts')).runHill },
  transposicao: { build: (await load('/src/labs/transposicao/flows.ts')).buildTransProtocol, run: (await load('/src/labs/transposicao/flows.ts')).runTransposition },
  enigma: { build: (await load('/src/labs/enigma/flows.ts')).buildEnigmaProtocol, run: (await load('/src/labs/enigma/flows.ts')).runEnigmaFlow },
  bombe: { build: (await load('/src/labs/enigma-bombe/flows.ts')).buildBombeProtocol, run: (await load('/src/labs/enigma-bombe/flows.ts')).runBombeLab },
  otp: {
    build: (await load('/src/labs/otp/flows.ts')).buildOtpProtocol,
    run: (await load('/src/labs/otp/flows.ts')).runOtp,
    buildReuse: (await load('/src/labs/otp/flows.ts')).buildReuseProtocol,
    runReuse: (await load('/src/labs/otp/flows.ts')).runReuse,
  },
  rsa: { build: (await load('/src/labs/rsa/flows.ts')).buildRsaProtocol, runDidactic: (await load('/src/labs/rsa/run.ts')).runDidactic, runReal: (await load('/src/labs/rsa/run.ts')).runReal },
  dh: { build: (await load('/src/labs/diffie-hellman/flows.ts')).buildDhProtocol, buildMitm: (await load('/src/labs/diffie-hellman/flows.ts')).buildMitmProtocol },
  ecc: await load('/src/labs/ecc/flows.ts'),
  tls: { build: (await load('/src/labs/tls13/flows.ts')).buildTlsProtocol, run: (await load('/src/labs/tls13/flows.ts')).runTls },
  aes: { build: (await load('/src/labs/aes/flows.ts')).buildAesProtocol, run: (await load('/src/labs/aes/run.ts')).runAes },
  chacha: {
    build: (await load('/src/labs/chacha20/flows.ts')).buildChaChaProtocol,
    run: (await load('/src/labs/chacha20/flows.ts')).runChaCha,
    buildReuse: (await load('/src/labs/chacha20/flows.ts')).buildReuseProtocol,
    runReuse: (await load('/src/labs/chacha20/flows.ts')).runReuse,
  },
  hmac: { build: (await load('/src/labs/hash-hmac/flows.ts')).buildHmacProtocol },
};
const rndLetters = (n) => Array.from(rnd(n), (b) => String.fromCharCode(65 + (b % 26))).join('');
const ctx = { E, mod: { ...L, encoding, hash: hashMod }, rndLetters };

// ---------------------------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------------------------
const slug = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
const pl = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const mmId = (k) => 'n_' + String(k).replace(/[^A-Za-z0-9_]/g, '_');
const mmMsg = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/;/g, ',').replace(/#/g, 'nº ').replace(/\s+/g, ' ').trim().slice(0, 90);
/** Rótulos com marcação x_{i} e x^{n} viram texto simples. */
const plainLabel = (s) => String(s).replace(/_\{([^}]*)\}/g, '_$1').replace(/\^\{([^}]*)\}/g, '^$1');
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');

/** RFCs viram link para o rfc-editor.org quando ainda não são link. */
function linkRfcs(text) {
  return text
    .replace(/\[RFC (\d+)\]\([^)]*\)/g, '[RFC $1](https://www.rfc-editor.org/rfc/rfc$1)')
    .replace(/(?<!\[)\bRFC (\d{3,5})\b(?!\]\()/g, '[RFC $1](https://www.rfc-editor.org/rfc/rfc$1)');
}

/** Diagrama de sequência Mermaid de um protocolo (mesma fonte da animação do laboratório). */
function sequenceDiagram(def) {
  const L2 = ['sequenceDiagram'];
  for (const p of def.parties) L2.push(`  participant ${mmId(p.id)} as ${mmMsg(p.name)}`);
  const ids = def.parties.map((p) => mmId(p.id));
  let msgs = 0;
  let tampered = 0;
  let observed = 0;
  const first = ids[0];
  const last = ids[ids.length - 1];
  for (const step of def.steps) {
    // Só as etapas que enviam mensagem entram no diagrama (as demais ficam na tabela de etapas).
    if (step.events.some((ev) => ev.type === 'send')) L2.push(`  Note over ${first},${last}: ${mmMsg(step.title)}`);
    for (const ev of step.events) {
      if (ev.type !== 'send') continue;
      const m = ev.message;
      msgs++;
      if (m.tampered) tampered++;
      if ((m.observers ?? []).length) observed++;
      L2.push(`  ${mmId(m.from)}->>${mmId(m.to)}: ${m.tampered ? '[adulterada] ' : ''}${mmMsg(m.label) || 'mensagem'}`);
    }
  }
  return { block: '```mermaid\n' + L2.join('\n') + '\n```', msgs, tampered, observed, parties: def.parties.map((p) => mmMsg(p.name)) };
}

const KIND_PT = { param: 'parâmetro público', private: 'chave privada', public: 'valor público', secret: 'segredo', plain: 'texto claro', cipher: 'texto cifrado', signature: 'assinatura ou etiqueta' };

// ---------------------------------------------------------------------------------------------
// Documento de um laboratório
// ---------------------------------------------------------------------------------------------
const catTitle = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.title]));
const labs = LABS.filter((l) => l.status === 'available');
const docs = {};
const files = {};

async function labDocument(lab) {
  const spec = SPECS[lab.id];
  if (!spec) throw new Error(`Falta a especificação do laboratório "${lab.id}" em scripts/gerar-wiki.mjs`);
  const content = await load(`/src/labs/${spec.dir}/content.ts`);
  const objectives = content[spec.content[0]] ?? lab.objectives;
  const questions = content[spec.content[1]] ?? [];
  const base = `${SITE}#/lab/${lab.id}`;
  const O = [];
  O.push(`# ${lab.title}`, '', lab.summary, '');
  O.push(`- **Categoria:** ${catTitle[lab.category]}`);
  O.push(`- **Abrir o laboratório:** <${base}>`);
  O.push(`- **Motor:** ${spec.motor}`);
  O.push(`- **Código-fonte:** \`src/labs/${spec.dir}/\` (interface e fluxos) e \`${spec.engine}\` (operações)`);
  O.push(`- **Padrões e referências:** ${spec.padroes.map((x) => x.replace(/\.$/, '')).join('; ')}.`);
  O.push('');

  let sec = 1;
  O.push(`## ${sec}. Objetivos de aprendizagem`, '');
  for (const o of objectives) O.push(`- ${o}`);
  O.push('');
  sec++;

  O.push(`## ${sec}. Fundamentação`, '', spec.resumo, '');
  sec++;

  // Cenários executados
  const figs = [];
  const scenarioBlocks = [];
  let defForParties = null;
  let figNo = 0;
  for (let pi = 0; pi < spec.partes.length; pi++) {
    const parte = spec.partes[pi];
    for (let ci = 0; ci < parte.cenarios.length; ci++) {
      const sc = parte.cenarios[ci];
      let def;
      try {
        def = await sc.build(ctx);
      } catch (err) {
        throw new Error(`Cenário "${sc.titulo}" de ${lab.id}: ${err?.message ?? err}`);
      }
      defForParties ??= def;
      figNo++;
      const num = `${sec + 2}.${pi + 1}.${ci + 1}`;
      const diag = sequenceDiagram(def);
      const timeline = ProtocolSimulationEngine.build(def);
      const final = timeline.states[def.steps.length];
      figs.push({ num, titulo: sc.titulo, parte: parte.titulo });
      scenarioBlocks.push({ pi, ci, parte, sc, def, diag, final, num, figNo });
    }
  }

  // Participantes (do primeiro cenário)
  O.push(`## ${sec}. Participantes`, '');
  O.push('Alice e Bob são os participantes legítimos; Eva é a atacante (observadora passiva ou, quando há adulteração, ativa). As tabelas abaixo listam o que cada um mantém em cada cenário.', '');
  const partyRows = new Map();
  for (const b of scenarioBlocks) {
    for (const p of b.def.parties) {
      const prev = partyRows.get(p.id) ?? { name: p.name, role: p.role, slots: new Map() };
      for (const s of p.slots) prev.slots.set(s.key, s);
      partyRows.set(p.id, prev);
    }
  }
  O.push('| Participante | Papel | Dados que pode guardar (tipo) |', '| --- | --- | --- |');
  for (const [, p] of partyRows) {
    const slots = [...p.slots.values()].map((s) => `${plainLabel(s.label)} (${KIND_PT[s.kind] ?? s.kind})`).join('; ');
    O.push(`| ${cell(p.name)} | ${cell(p.role)} | ${cell(slots || '-')} |`);
  }
  O.push('');
  sec++;

  O.push(`## ${sec}. Como ler os diagramas`, '');
  O.push('Cada figura é um diagrama de sequência gerado a partir da mesma definição de protocolo que anima o laboratório: as colunas são os participantes, o tempo corre de cima para baixo e cada faixa horizontal é o início de uma etapa. Os valores numéricos e as chaves não aparecem aqui (são aleatórios ou dependem das entradas); eles são mostrados nas fórmulas do próprio laboratório.', '');
  O.push('- Seta cheia: mensagem enviada pelo canal, com o rótulo do que trafega.');
  O.push('- `[adulterada]` no início do rótulo: a mensagem foi alterada em trânsito por Eva.');
  O.push('- Faixa com texto: título da etapa que começa naquele ponto.');
  O.push('');
  O.push('**Lista de figuras**', '');
  for (const f of figs) O.push(`- [Figura ${f.num}](#${slug(`${f.num} ${f.titulo}`)}): ${f.titulo}`);
  O.push('');
  sec++;

  O.push(`## ${sec}. Cenários`, '');
  let lastPi = -1;
  for (const b of scenarioBlocks) {
    if (b.pi !== lastPi) {
      O.push(`### ${sec}.${b.pi + 1} ${b.parte.titulo}`, '');
      lastPi = b.pi;
    }
    O.push(`#### ${sec}.${b.pi + 1}.${b.ci + 1} ${b.sc.titulo}`, '');
    O.push(`**Entradas usadas:** ${b.sc.entradas}.`, '');
    O.push(b.diag.block, '');
    const extra = [b.diag.tampered ? pl(b.diag.tampered, 'adulterada', 'adulteradas') : ''].filter(Boolean);
    O.push(`*Figura ${sec}.${b.pi + 1}.${b.ci + 1} (sequência).* ${b.sc.titulo}: ${pl(b.diag.msgs, 'mensagem', 'mensagens')}${extra.length ? ` (${extra.join('; ')})` : ''}, entre ${b.diag.parties.length > 1 ? b.diag.parties.slice(0, -1).join(', ') + ' e ' + b.diag.parties.at(-1) : b.diag.parties[0]}.`, '');
    O.push('| Etapa | Título | Operação |', '| --- | --- | --- |');
    b.def.steps.forEach((s, i) => O.push(`| ${i + 1} | ${cell(s.title)} | ${cell(s.operation)} |`));
    O.push('');
    if (b.final.verdict) O.push(`**Veredito do cenário:** ${b.final.verdict.text}`, '');
  }
  // reajuste das âncoras das figuras (numeração segue o cabeçalho da seção)
  sec++;

  O.push(`## ${sec}. Perguntas de fixação`, '');
  questions.forEach((q, i) => {
    O.push(`${i + 1}. ${q.question}`, '', `   **Resposta.** ${q.answer}`, '');
  });
  sec++;

  O.push(`## ${sec}. Limitações e cuidados`, '');
  for (const l of spec.limites) O.push(`- ${l}`);
  O.push('- Uso exclusivamente didático: os laboratórios não devem proteger dados reais.');
  O.push('');

  let text = O.join('\n').replace(/\n{3,}/g, '\n\n');
  text = linkRfcs(text);
  return text.trimEnd() + footer;
}

for (const lab of labs) {
  docs[lab.id] = await labDocument(lab);
}

// Âncoras da lista de figuras: o título real do cabeçalho é "N.M.K Título"
for (const id of Object.keys(docs)) {
  docs[id] = docs[id].replace(/\[Figura ([\d.]+)\]\(#[^)]*\): ([^\n]+)/g, (_, num, titulo) => `[Figura ${num}](#${slug(`${num} ${titulo}`)}): ${titulo}`);
}

// ---------------------------------------------------------------------------------------------
// Índice dos laboratórios
// ---------------------------------------------------------------------------------------------
function indice() {
  const I = ['# Laboratórios', '', 'Lista dos laboratórios do CryptoNet Lab por categoria. A fonte única é `src/labs/registry.ts`.', ''];
  for (const c of CATEGORIES) {
    I.push(`## ${c.title}`, '', c.description, '', '| Laboratório | Resumo | Motor | Padrões e referências |', '| --- | --- | --- | --- |');
    for (const l of labs.filter((x) => x.category === c.id)) {
      const s = SPECS[l.id];
      I.push(`| [${l.title}](${pageRef(l.id)}) | ${cell(l.summary)} | ${cell(s.motor)} | ${cell(s.padroes.map((x) => x.replace(/\.$/, '')).join('; '))} |`);
    }
    I.push('');
  }
  return linkRfcs(I.join('\n'));
}

// ---------------------------------------------------------------------------------------------
// Páginas da wiki
// ---------------------------------------------------------------------------------------------
for (const l of labs) files[`${pageName(l.id)}.md`] = docs[l.id];
files[DOCS ? 'README.md' : 'laboratorios.md'] = indice().replace('# Laboratórios\n', DOCS ? '# Documentação dos laboratórios\n' : '# Laboratórios\n') + footer;

if (!DOCS) {
  const arq = fs.readFileSync(path.join(root, 'docs', 'arquitetura.md'), 'utf8');
  files['arquitetura.md'] = arq.trimEnd() + footer;

  const H = [
    '# CryptoNet Lab',
    '',
    'Laboratório Virtual de Criptografia e Protocolos Seguros, da Universidade de Brasília (UnB). Cada laboratório anima, passo a passo, uma operação criptográfica ou um protocolo, com fórmulas com os valores substituídos e a visão de quem observa a rede. Tudo roda no navegador, sem servidor.',
    '',
    `- **Aplicação:** <${SITE}>`,
    `- **Código-fonte:** <${REPO}>`,
    '',
    'Em todos os laboratórios, **Alice** e **Bob** são os participantes legítimos e **Eva** é a atacante (observadora passiva ou, quando há adulteração, ativa).',
    '',
    '## Páginas',
    '',
    '- [Laboratórios](laboratorios): índice dos laboratórios por categoria, com o motor e os padrões de cada um.',
    '- [Arquitetura](arquitetura): camadas, contratos dos motores, motor de simulação, testes e como adicionar um laboratório.',
    '- [Contribuindo](contribuindo): convenções do projeto e como esta wiki é gerada.',
    '',
    '## Laboratórios por categoria',
    '',
  ];
  for (const c of CATEGORIES) {
    H.push(`### ${c.title}`, '');
    for (const l of labs.filter((x) => x.category === c.id)) H.push(`- [${l.title}](${pageName(l.id)}): ${l.summary}`);
    H.push('');
  }
  H.push('> Os modos didáticos usam parâmetros pequenos e não oferecem segurança real. Não utilize o projeto para proteger dados.', '');
  files['Home.md'] = linkRfcs(H.join('\n')) + footer;

  const S = ['**[CryptoNet Lab](Home)**', '', '- [Arquitetura](arquitetura)', '- [Laboratórios](laboratorios)', '- [Contribuindo](contribuindo)', ''];
  for (const c of CATEGORIES) {
    S.push(`**${c.title}**`, '');
    for (const l of labs.filter((x) => x.category === c.id)) S.push(`- [${l.title}](${pageName(l.id)})`);
    S.push('');
  }
  files['_Sidebar.md'] = S.join('\n');
  files['_Footer.md'] = CRED + '\n';

  files['contribuindo.md'] =
    `# Contribuindo

## Convenções

- Idioma: português do Brasil, em tom acadêmico, direto e impessoal. Termos técnicos consagrados em inglês podem ser mantidos, com o significado esclarecido na primeira ocorrência.
- Pontuação: não usar travessão longo nem meia-risca (use hífen, dois-pontos, barra ou parênteses).
- Rigor técnico: levantar as RFCs e os padrões vigentes no [rfc-editor.org](https://www.rfc-editor.org), conferir versões substituídas (por exemplo, a RFC 8446 foi substituída pela RFC 9846), citar a RFC e a seção e registrar as simplificações do laboratório.
- Segurança: os modos didáticos são inseguros por construção e assim devem ser identificados na interface; ataques ficam no nível didático e dentro do navegador.
- Atores: Alice e Bob são os legítimos; Eva (atacante) só aparece quando Alice e Bob se comunicam.
- Nada avança sozinho: cada etapa executa uma única operação e só avança com a confirmação do aluno.
- Antes de enviar: \`npm run typecheck\` e \`npm test\`.
- Commits em português, com verbo na terceira pessoa do presente e sem prefixo (por exemplo, "Adiciona o laboratório de ChaCha20").

## Como adicionar um laboratório

Veja a seção "Como adicionar um laboratório" da página [Arquitetura](arquitetura). Em resumo: criar \`src/labs/<nome>/\`, escrever o fluxo como \`ProtocolDefinition\`, registrar a entrada em \`src/labs/registry.ts\`, acrescentar a especificação do laboratório em \`scripts/gerar-wiki.mjs\` e regenerar a documentação.

## Como esta wiki é gerada

As páginas são geradas pelo código, a partir do registro, dos textos e dos fluxos de cada laboratório:

\`\`\`bash
npm run docs:labs                  # gera docs/laboratorios/ (versionado junto com o código)
npm run wiki -- <pasta-de-saida>   # gera as páginas da wiki
\`\`\`

Para publicar, clone \`CryptoNet.wiki.git\`, copie os \`.md\` gerados, faça o commit e o push. Como a wiki é pública, a publicação só ocorre com autorização expressa do autor. Edições manuais nas páginas geradas são sobrescritas na próxima geração. As páginas \`Home\`, \`arquitetura\` (cópia de \`docs/arquitetura.md\`), \`laboratorios\`, \`contribuindo\`, \`_Sidebar\` e \`_Footer\` também são geradas.
` + footer;
} else {
  // Só os documentos e o índice entram em docs/laboratorios
}

// ---------------------------------------------------------------------------------------------
// Verificações e gravação
// ---------------------------------------------------------------------------------------------
const problemas = [];
for (const [name, text] of Object.entries(files)) {
  if (/[—–]/.test(text)) problemas.push(`${name}: contém travessão ou meia-risca`);
  if (/\b[0-9a-f]{32,}\b/.test(text)) problemas.push(`${name}: contém um valor hexadecimal longo (valores aleatórios não devem aparecer)`);
}
if (problemas.length) {
  console.error('Problemas na geração:\n' + problemas.join('\n'));
  await server.close();
  process.exit(1);
}
for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(out, name), text.replace(/\r\n/g, '\n'), 'utf8');
console.log(`${Object.keys(files).length} arquivos gerados em ${out}`);
await server.close();
process.exit(0);
