// Motor local das cifras clássicas e da sua criptoanálise. Cada família fica em um módulo próprio para que cada laboratório carregue só o que usa.
import { crack as crackClassical, decrypt as decryptClassical, encrypt as encryptClassical } from '../classical';
import { crackSubstitution as crackSub, substitutionDecrypt, substitutionEncrypt } from '../substitution';
import { crackVigenere as crackVig, vigenereDecrypt, vigenereEncrypt } from '../vigenere';
import { buildGrid, playfairDecrypt, playfairEncryptSteps } from '../playfair';
import { hillDecrypt, hillEncryptBlocks, hillPrepare, knownPlaintextAttack as hillAttack } from '../hill';
import { bombeAttack } from '../bombe';
import { cribOffsets, enigmaRun } from '../enigma';
import { cribDrag, otpDecrypt, otpEncrypt } from '../otp';
import { columnarDecrypt, columnarEncrypt, crackColumnar as crackCol, crackRail as crackRl, productDecrypt, productEncrypt, railDecrypt, railEncrypt } from '../transposition';
import type { ClassicalEngine, EngineSet } from '../engines';

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
  runBombe: async (setup, ciphertext, crib, offset) => bombeAttack(setup, ciphertext, crib, offset),
  encryptOtp: async (key, plaintext) => otpEncrypt(key, plaintext),
  decryptOtp: async (key, ciphertext) => otpDecrypt(key, ciphertext),
  dragOtp: async (cipher1, cipher2, crib, inFirst) => cribDrag(cipher1, cipher2, crib, inFirst),
  encryptRail: async (text, rails) => railEncrypt(text, rails),
  decryptRail: async (ciphertext, rails) => railDecrypt(ciphertext, rails),
  crackRail: async (ciphertext) => crackRl(ciphertext),
  encryptColumnar: async (text, keyword) => columnarEncrypt(text, keyword),
  decryptColumnar: async (ciphertext, keyword) => columnarDecrypt(ciphertext, keyword),
  crackColumnar: async (ciphertext) => crackCol(ciphertext),
  encryptProduct: async (text, key, keyword) => productEncrypt(text, key, keyword),
  decryptProduct: async (ciphertext, key, keyword) => productDecrypt(ciphertext, key, keyword),
};

export const engines: Pick<EngineSet, 'classical'> = { classical };
