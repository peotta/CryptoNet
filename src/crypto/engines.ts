// Contratos dos motores criptográficos. A interface React depende SOMENTE destes tipos.
// Todos os métodos são assíncronos de propósito: a implementação local (navegador) pode ser
// substituída ou complementada por um cliente REST/WebSocket para uma API Python/FastAPI
// (ver docs/arquitetura.md) sem alterar nenhum componente.
import type { Curve, EcdsaSignature, EcdsaVerification, Point, RealSigAlgo, RealSigRun } from './ecc';
import type { TlsHandshake, TlsInput } from './tls13';
import type { ChaChaBlock } from './chacha20';
import type { RsaDidacticKeys, RsaPrivateKey, RsaPublicKey } from './rsaDidactic';
import type { AesMode, RoundStep } from './aes';
import type { ClassicalCipher, ClassicalKey, CrackCandidate } from './classical';
import type { SubstitutionCrack } from './substitution';
import type { VigenereCrack } from './vigenere';
import type { DigraphStep } from './playfair';
import type { HillAttack, HillBlock, Matrix } from './hill';
import type { BombeAttack, BombeSetup } from './bombe';
import type { CribOffset, EnigmaConfig, EnigmaResult } from './enigma';
import type { DragResult } from './otp';
import type { ColumnarCandidate, RailCandidate } from './transposition';
import type { AvalancheStats, HashAlgo, HmacTrace } from './hash';
import type { DhSession, MitmSession } from './diffieHellman';
import type { PublicKeyInfo, RsaKeySize } from './rsaWebCrypto';
import type { DecapsDetail, EncapsDetail, KeyGenDetail, MlKemParams } from './mlkem';
import type { LweAttack, LweCiphertext, LweDecryption, LweKeys, LweParams } from './lwe';

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
  /** Bombe: menu, busca nas 17.576 posições iniciais e verificação das paradas (sem conhecer as posições nem os plugues). */
  runBombe(setup: BombeSetup, ciphertext: string, crib: string, offset: number): Promise<BombeAttack>;
  /** One-time pad: soma módulo 26, com chave do tamanho da mensagem (lança erro se a chave for curta). */
  encryptOtp(key: string, plaintext: string): Promise<string>;
  decryptOtp(key: string, ciphertext: string): Promise<string>;
  /** Arrasto de texto provável sobre duas cifras feitas com a MESMA chave (two-time pad). */
  dragOtp(cipher1: string, cipher2: string, crib: string, inFirst: boolean): Promise<DragResult[]>;
  /** Transposição: cerca de trilhos e colunar. Só reordenam as letras. */
  encryptRail(text: string, rails: number): Promise<string>;
  decryptRail(ciphertext: string, rails: number): Promise<string>;
  /** Força bruta sobre o número de trilhos, ordenada pela legibilidade do texto. */
  crackRail(ciphertext: string): Promise<RailCandidate[]>;
  encryptColumnar(text: string, keyword: string): Promise<string>;
  decryptColumnar(ciphertext: string, keyword: string): Promise<string>;
  /** Anagramação: melhor ordem de colunas para 2 a 8 colunas, ordenada pela legibilidade. */
  crackColumnar(ciphertext: string): Promise<ColumnarCandidate[]>;
  /** Cifra produto: substituição simples seguida de transposição colunar. */
  encryptProduct(text: string, substitutionKey: string, keyword: string): Promise<string>;
  decryptProduct(ciphertext: string, substitutionKey: string, keyword: string): Promise<string>;
}

/** ChaCha20 (RFC 8439): cifra de fluxo ARX, com o bloco completo para a visualização. */
export interface ChaChaEngine extends CryptoEngine {
  /** Cifra ou decifra (a operação é a mesma) por XOR com o fluxo de chaves. */
  crypt(key: Uint8Array, nonce: Uint8Array, counter: number, data: Uint8Array): Promise<Uint8Array>;
  /** Bloco de 64 bytes com o estado inicial, as 20 rodadas e a soma final. */
  block(key: Uint8Array, nonce: Uint8Array, counter: number): Promise<ChaChaBlock>;
}

/** Handshake do TLS 1.3 (1-RTT) com Web Crypto: ECDHE P-256, HKDF-SHA-256, ECDSA P-256, HMAC e AES-128-GCM. */
export interface TlsEngine extends CryptoEngine {
  handshake(input: TlsInput): Promise<TlsHandshake>;
}

/** Curvas elípticas: aritmética didática (curva minúscula, BigInt) e assinaturas reais (ECDSA P-256 e Ed25519). */
export interface EccEngine extends CryptoEngine {
  readonly curve: Curve;
  publicKey(d: bigint): Promise<Point>;
  ecdh(d: bigint, Q: Point): Promise<Point>;
  /** Força bruta do logaritmo discreto: possível só porque a curva didática é minúscula. */
  discreteLog(Q: Point): Promise<{ k: bigint | null; tries: number }>;
  sign(d: bigint, z: bigint, k: bigint): Promise<EcdsaSignature>;
  verify(Q: Point, z: bigint, r: bigint, s: bigint): Promise<EcdsaVerification>;
  recoverNonceReuse(z1: bigint, s1: bigint, z2: bigint, s2: bigint, r: bigint): Promise<{ k: bigint; d: bigint } | null>;
  realSupported(algo: RealSigAlgo): Promise<boolean>;
  realSignature(algo: RealSigAlgo, message: Uint8Array, tamper: boolean): Promise<RealSigRun>;
}

/** ML-KEM (FIPS 203): geração de chaves, encapsulamento e desencapsulamento, com os valores intermediários. */
export interface MlKemEngine extends CryptoEngine {
  keyGen(params: MlKemParams, d: Uint8Array, z: Uint8Array): Promise<KeyGenDetail>;
  encaps(params: MlKemParams, ek: Uint8Array, m: Uint8Array): Promise<EncapsDetail>;
  decaps(params: MlKemParams, dk: Uint8Array, c: Uint8Array): Promise<DecapsDetail>;
}

/** LWE em escala didática (números minúsculos), com os ataques algébrico e exaustivo. */
export interface LweEngine extends CryptoEngine {
  keyGen(params: LweParams, seed: number): Promise<LweKeys>;
  encrypt(keys: Pick<LweKeys, 'params' | 'A' | 'b'>, bit: 0 | 1, seed: number): Promise<LweCiphertext>;
  decrypt(params: LweParams, s: number[], u: number[], v: number): Promise<LweDecryption>;
  attackGauss(keys: LweKeys): Promise<LweAttack>;
  attackBruteForce(keys: LweKeys): Promise<LweAttack>;
}

export interface EngineSet {
  rsaDidactic: RsaDidacticEngine;
  rsaReal: RsaRealEngine;
  diffieHellman: DiffieHellmanEngine;
  hash: HashEngine;
  aes: AesEngine;
  classical: ClassicalEngine;
  chacha: ChaChaEngine;
  tls: TlsEngine;
  ecc: EccEngine;
  mlkem: MlKemEngine;
  lwe: LweEngine;
}

// Conjunto completo, usado nos testes e na documentação. Os laboratórios importam apenas a família de que precisam (src/crypto/local/).
import { engines as rsa } from './local/rsa';
import { engines as diffieHellman } from './local/diffieHellman';
import { engines as hash } from './local/hash';
import { engines as aes } from './local/aes';
import { engines as classical } from './local/classical';
import { engines as chacha } from './local/chacha';
import { engines as tls } from './local/tls';
import { engines as ecc } from './local/ecc';
import { engines as mlkem } from './local/mlkem';

export const engines: EngineSet = { ...rsa, ...diffieHellman, ...hash, ...aes, ...classical, ...chacha, ...tls, ...ecc, ...mlkem };
