// Contratos dos motores criptográficos. A interface React depende SOMENTE destes tipos.
// Todos os métodos são assíncronos de propósito: a implementação local (navegador) pode ser
// substituída ou complementada por um cliente REST/WebSocket para uma API Python/FastAPI
// (ver docs/arquitetura.md) sem alterar nenhum componente.
import {
  decryptDidactic,
  encryptDidactic,
  generateDidacticKeys,
  signDidactic,
  verifyDidactic,
  type RsaDidacticKeys,
  type RsaPrivateKey,
  type RsaPublicKey,
} from './rsaDidactic';
import {
  aesBlockWebCrypto,
  cbcDecrypt,
  cbcEncrypt,
  ctrXor,
  ecbDecrypt,
  ecbEncrypt,
  expandKey,
  gcmDecrypt,
  gcmEncrypt,
  traceEncrypt,
  type AesMode,
  type RoundStep,
} from './aes';
import {
  crack as crackClassical,
  decrypt as decryptClassical,
  encrypt as encryptClassical,
  type ClassicalCipher,
  type ClassicalKey,
  type CrackCandidate,
} from './classical';
import {
  crackSubstitution as crackSub,
  substitutionDecrypt,
  substitutionEncrypt,
  type SubstitutionCrack,
} from './substitution';
import { crackVigenere as crackVig, vigenereDecrypt, vigenereEncrypt, type VigenereCrack } from './vigenere';
import {
  buildGrid,
  playfairDecrypt,
  playfairEncryptSteps,
  type DigraphStep,
} from './playfair';
import {
  hillDecrypt,
  hillEncryptBlocks,
  hillPrepare,
  knownPlaintextAttack as hillAttack,
  type HillAttack,
  type HillBlock,
  type Matrix,
} from './hill';
import { cribOffsets, enigmaRun, type CribOffset, type EnigmaConfig, type EnigmaResult } from './enigma';
import { cribDrag, otpDecrypt, otpEncrypt, type DragResult } from './otp';
import { avalancheStats, digest, hmacTrace, hmacWebCrypto, constantTimeEqual, type AvalancheStats, type HashAlgo, type HmacTrace } from './hash';
import { runDhSession, runMitmSession, type DhSession, type MitmSession } from './diffieHellman';
import {
  decryptOaep,
  describePublicKey,
  encryptOaep,
  generateOaepKeyPair,
  generatePssKeyPair,
  signPss,
  verifyPss,
  type PublicKeyInfo,
  type RsaKeySize,
} from './rsaWebCrypto';

export type EngineKind = 'educational' | 'webcrypto' | 'remote';

export interface CryptoEngine {
  readonly id: string;
  readonly kind: EngineKind;
}

/** Simulação matemática educacional do RSA (BigInt, sem padding). */
export interface RsaDidacticEngine extends CryptoEngine {
  generateKeys(p: bigint, q: bigint, e: bigint): Promise<RsaDidacticKeys>;
  encrypt(m: bigint, key: RsaPublicKey): Promise<bigint>;
  decrypt(c: bigint, key: RsaPrivateKey): Promise<bigint>;
  sign(m: bigint, key: RsaPrivateKey): Promise<bigint>;
  verify(m: bigint, s: bigint, key: RsaPublicKey): Promise<boolean>;
}

/** Referência opaca a um par de chaves; a implementação decide o que ela contém. */
export interface RealKeyPair {
  readonly size: RsaKeySize;
  readonly info: PublicKeyInfo;
  readonly handle: CryptoKeyPair;
}

/** RSA real (OAEP e PSS). */
export interface RsaRealEngine extends CryptoEngine {
  generateEncryptionKeys(size: RsaKeySize): Promise<RealKeyPair>;
  generateSigningKeys(size: RsaKeySize): Promise<RealKeyPair>;
  encrypt(keys: RealKeyPair, data: Uint8Array): Promise<Uint8Array>;
  decrypt(keys: RealKeyPair, data: Uint8Array): Promise<Uint8Array>;
  sign(keys: RealKeyPair, data: Uint8Array): Promise<Uint8Array>;
  verify(keys: RealKeyPair, signature: Uint8Array, data: Uint8Array): Promise<boolean>;
}

export interface DiffieHellmanEngine extends CryptoEngine {
  runSession(p: bigint, g: bigint, a: bigint, b: bigint): Promise<DhSession>;
  runMitm(p: bigint, g: bigint, a: bigint, b: bigint, e: bigint): Promise<MitmSession>;
}

/** Funções hash e HMAC (operações reais). */
export interface HashEngine extends CryptoEngine {
  digest(algo: HashAlgo, data: Uint8Array): Promise<Uint8Array>;
  /** HMAC com valores intermediários e conferência contra a implementação nativa. */
  hmac(algo: HashAlgo, key: Uint8Array, message: Uint8Array): Promise<{ trace: HmacTrace; matchesReference: boolean }>;
  avalanche(algo: HashAlgo, trials: number): Promise<AvalancheStats>;
}

/**
 * AES e modos de operação. ECB, CBC e CTR usam a implementação didática (sem preenchimento);
 * o GCM usa a Web Crypto. O iv é de 16 bytes no CBC e de 12 bytes no CTR e no GCM.
 */
export interface AesEngine extends CryptoEngine {
  /** No GCM, o resultado é o texto cifrado seguido da etiqueta de 16 bytes. */
  encrypt(mode: AesMode, key: Uint8Array, iv: Uint8Array | null, plaintext: Uint8Array): Promise<Uint8Array>;
  /** No GCM, lança erro quando a etiqueta de autenticação não confere. */
  decrypt(mode: AesMode, key: Uint8Array, iv: Uint8Array | null, data: Uint8Array): Promise<Uint8Array>;
  /** Rastro das rodadas de um bloco, conferido com a Web Crypto. */
  traceBlock(key: Uint8Array, block: Uint8Array): Promise<{ steps: RoundStep[]; roundKeys: Uint8Array[]; matchesReference: boolean }>;
}

/** Cifras clássicas (César e afim) e a sua criptoanálise por força bruta com análise de frequência. */
export interface ClassicalEngine extends CryptoEngine {
  encrypt(cipher: ClassicalCipher, key: ClassicalKey, plaintext: string): Promise<string>;
  decrypt(cipher: ClassicalCipher, key: ClassicalKey, ciphertext: string): Promise<string>;
  /** Todas as chaves possíveis, ordenadas da mais para a menos provável (menor χ² primeiro). */
  crack(cipher: ClassicalCipher, ciphertext: string): Promise<CrackCandidate[]>;
  /** Substituição simples: a chave é uma permutação das 26 letras. */
  encryptSubstitution(key: string, plaintext: string): Promise<string>;
  decryptSubstitution(key: string, ciphertext: string): Promise<string>;
  /** Criptoanálise por frequência e refinamento com bigramas (sem conhecer a chave). */
  crackSubstitution(ciphertext: string): Promise<SubstitutionCrack>;
  /** Vigenère: a chave é uma palavra de 1 a 20 letras. */
  encryptVigenere(key: string, plaintext: string): Promise<string>;
  decryptVigenere(key: string, ciphertext: string): Promise<string>;
  /** Kasiski, índice de coincidência por tamanho de chave e frequência por coluna (sem conhecer a chave). */
  crackVigenere(ciphertext: string): Promise<VigenereCrack>;
  /** Playfair: a grade vem de uma palavra-chave; devolve os digrafos com a regra aplicada em cada um. */
  encryptPlayfair(keyword: string, plaintext: string): Promise<{ grid: string; steps: DigraphStep[]; cipher: string }>;
  decryptPlayfair(grid: string, ciphertext: string): Promise<string>;
  /** Hill: matriz 2 x 2 ou 3 x 3 inversível módulo 26; devolve o texto preparado e cada bloco. */
  encryptHill(key: Matrix, plaintext: string): Promise<{ prepared: string; blocks: HillBlock[]; cipher: string }>;
  decryptHill(key: Matrix, ciphertext: string): Promise<string>;
  /** Ataque de texto claro conhecido contra o Hill (nulo se não há blocos independentes suficientes). */
  attackHill(n: number, knownPlain: string, cipherPrefix: string): Promise<HillAttack | null>;
  /** Enigma I: passa o texto pela máquina e devolve o rastro de cada tecla. É recíproca: decifrar é cifrar de novo. */
  runEnigma(config: EnigmaConfig, text: string): Promise<EnigmaResult>;
  /** Alinhamentos de um texto provável com a cifra, descartando os impossíveis (letra igual à cifrada). */
  analyzeCrib(ciphertext: string, crib: string): Promise<CribOffset[]>;
  /** One-time pad: soma módulo 26, com chave do tamanho da mensagem (lança erro se a chave for curta). */
  encryptOtp(key: string, plaintext: string): Promise<string>;
  decryptOtp(key: string, ciphertext: string): Promise<string>;
  /** Arrasto de texto provável sobre duas cifras feitas com a MESMA chave (two-time pad). */
  dragOtp(cipher1: string, cipher2: string, crib: string, inFirst: boolean): Promise<DragResult[]>;
}

export interface EngineSet {
  rsaDidactic: RsaDidacticEngine;
  rsaReal: RsaRealEngine;
  diffieHellman: DiffieHellmanEngine;
  hash: HashEngine;
  aes: AesEngine;
  classical: ClassicalEngine;
}

const rsaDidactic: RsaDidacticEngine = {
  id: 'local-rsa-didactic',
  kind: 'educational',
  generateKeys: async (p, q, e) => generateDidacticKeys(p, q, e),
  encrypt: async (m, key) => encryptDidactic(m, key),
  decrypt: async (c, key) => decryptDidactic(c, key),
  sign: async (m, key) => signDidactic(m, key),
  verify: async (m, s, key) => verifyDidactic(m, s, key),
};

async function wrap(size: RsaKeySize, handle: CryptoKeyPair): Promise<RealKeyPair> {
  return { size, handle, info: await describePublicKey(handle.publicKey) };
}

const rsaReal: RsaRealEngine = {
  id: 'local-webcrypto-rsa',
  kind: 'webcrypto',
  generateEncryptionKeys: async (size) => wrap(size, await generateOaepKeyPair(size)),
  generateSigningKeys: async (size) => wrap(size, await generatePssKeyPair(size)),
  encrypt: (keys, data) => encryptOaep(keys.handle.publicKey, data),
  decrypt: (keys, data) => decryptOaep(keys.handle.privateKey, data),
  sign: (keys, data) => signPss(keys.handle.privateKey, data),
  verify: (keys, sig, data) => verifyPss(keys.handle.publicKey, sig, data),
};

const diffieHellman: DiffieHellmanEngine = {
  id: 'local-dh-didactic',
  kind: 'educational',
  runSession: async (p, g, a, b) => runDhSession(p, g, a, b),
  runMitm: async (p, g, a, b, e) => runMitmSession(p, g, a, b, e),
};

const hash: HashEngine = {
  id: 'local-webcrypto-hash',
  kind: 'webcrypto',
  digest,
  hmac: async (algo, key, message) => {
    const trace = await hmacTrace(algo, key, message);
    return { trace, matchesReference: constantTimeEqual(trace.tag, await hmacWebCrypto(algo, key, message)) };
  },
  avalanche: avalancheStats,
};

function need(iv: Uint8Array | null, length: number, mode: AesMode): Uint8Array {
  if (!iv || iv.length !== length) throw new Error(`O ${mode === 'CBC' ? 'IV' : 'nonce'} do ${mode} deve ter ${length} bytes.`);
  return iv;
}

const aes: AesEngine = {
  id: 'local-aes',
  kind: 'educational',
  encrypt: async (mode, key, iv, pt) => {
    switch (mode) {
      case 'ECB':
        return ecbEncrypt(key, pt);
      case 'CBC':
        return cbcEncrypt(key, need(iv, 16, mode), pt);
      case 'CTR':
        return ctrXor(key, need(iv, 12, mode), pt);
      case 'GCM':
        return gcmEncrypt(key, need(iv, 12, mode), pt);
    }
  },
  decrypt: async (mode, key, iv, data) => {
    switch (mode) {
      case 'ECB':
        return ecbDecrypt(key, data);
      case 'CBC':
        return cbcDecrypt(key, need(iv, 16, mode), data);
      case 'CTR':
        return ctrXor(key, need(iv, 12, mode), data);
      case 'GCM':
        return gcmDecrypt(key, need(iv, 12, mode), data);
    }
  },
  traceBlock: async (key, block) => {
    const roundKeys = expandKey(key);
    const steps = traceEncrypt(roundKeys, block);
    const reference = await aesBlockWebCrypto(key, block);
    const last = steps[steps.length - 1].state;
    return { steps, roundKeys, matchesReference: reference.every((b, i) => b === last[i]) };
  },
};

const classical: ClassicalEngine = {
  id: 'local-classical',
  kind: 'educational',
  encrypt: async (cipher, key, plaintext) => encryptClassical(cipher, key, plaintext),
  decrypt: async (cipher, key, ciphertext) => decryptClassical(cipher, key, ciphertext),
  crack: async (cipher, ciphertext) => crackClassical(cipher, ciphertext),
  encryptSubstitution: async (key, plaintext) => substitutionEncrypt(key, plaintext),
  decryptSubstitution: async (key, ciphertext) => substitutionDecrypt(key, ciphertext),
  crackSubstitution: async (ciphertext) => crackSub(ciphertext),
  encryptVigenere: async (key, plaintext) => vigenereEncrypt(key, plaintext),
  decryptVigenere: async (key, ciphertext) => vigenereDecrypt(key, ciphertext),
  crackVigenere: async (ciphertext) => crackVig(ciphertext),
  encryptPlayfair: async (keyword, plaintext) => {
    const grid = buildGrid(keyword);
    const steps = playfairEncryptSteps(grid, plaintext);
    return { grid, steps, cipher: steps.map((s) => s.output).join('') };
  },
  decryptPlayfair: async (grid, ciphertext) => playfairDecrypt(grid, ciphertext),
  encryptHill: async (key, plaintext) => {
    const blocks = hillEncryptBlocks(key, plaintext);
    const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return { prepared: hillPrepare(plaintext, key.length), blocks, cipher: blocks.map((b) => b.cipher.map((v) => ALPHA[v]).join('')).join('') };
  },
  decryptHill: async (key, ciphertext) => hillDecrypt(key, ciphertext),
  attackHill: async (n, knownPlain, cipherPrefix) => hillAttack(n, knownPlain, cipherPrefix),
  runEnigma: async (config, text) => enigmaRun(config, text),
  analyzeCrib: async (ciphertext, crib) => cribOffsets(ciphertext, crib),
  encryptOtp: async (key, plaintext) => otpEncrypt(key, plaintext),
  decryptOtp: async (key, ciphertext) => otpDecrypt(key, ciphertext),
  dragOtp: async (cipher1, cipher2, crib, inFirst) => cribDrag(cipher1, cipher2, crib, inFirst),
};

/** Motores ativos. Para usar uma API remota, substitua os valores por clientes que implementem as mesmas interfaces. */
export const engines: EngineSet = { rsaDidactic, rsaReal, diffieHellman, hash, aes, classical };
