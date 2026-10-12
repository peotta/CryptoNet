import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type CategoryId = 'simetrica' | 'assimetrica';

export interface Category {
  id: CategoryId;
  title: string;
  description: string;
}

export interface LabMeta {
  id: string;
  category: CategoryId;
  title: string;
  summary: string;
  objectives: string[];
  status: 'available' | 'planned';
  /** Presente somente em laboratórios disponíveis. */
  component?: LazyExoticComponent<ComponentType>;
}

export const CATEGORIES: Category[] = [
  {
    id: 'simetrica',
    title: 'Criptografia Simétrica',
    description: 'Uma única chave compartilhada cifra e decifra. Base da proteção de dados em trânsito e em repouso.',
  },
  {
    id: 'assimetrica',
    title: 'Criptografia Assimétrica e Acordo de Chaves',
    description: 'Pares de chaves pública e privada, assinaturas digitais e estabelecimento de segredos por canais inseguros.',
  },
];

// Para adicionar um laboratório: crie a pasta em src/labs/<nome>/, exporte o componente
// por default e acrescente uma entrada aqui. Nenhum outro arquivo precisa mudar.
export const LABS: LabMeta[] = [
  {
    id: 'rsa',
    category: 'assimetrica',
    title: 'RSA',
    summary: 'Geração de chaves, cifragem, decifragem e assinatura digital, em versão didática (BigInt) e real (RSA-OAEP e RSA-PSS).',
    objectives: ['Calcular n, φ(n), e e d', 'Diferenciar RSA sem padding de OAEP e PSS', 'Distinguir cifragem de assinatura'],
    status: 'available',
    component: lazy(() => import('./rsa/RsaLab')),
  },
  {
    id: 'diffie-hellman',
    category: 'assimetrica',
    title: 'Diffie-Hellman',
    summary: 'Acordo de chaves por um canal público, visão de Eva, derivação de chave com HKDF e o ataque do homem do meio.',
    objectives: ['Calcular o segredo compartilhado', 'Entender o logaritmo discreto', 'Reconhecer o MITM e a necessidade de autenticação'],
    status: 'available',
    component: lazy(() => import('./diffie-hellman/DhLab')),
  },
  {
    id: 'ecdh-assinaturas',
    category: 'assimetrica',
    title: 'ECDH, ECDSA e Ed25519',
    summary: 'Curvas elípticas para acordo de chaves e assinaturas.',
    objectives: [],
    status: 'planned',
  },
  {
    id: 'tls13',
    category: 'assimetrica',
    title: 'Handshake do TLS 1.3',
    summary: 'Animação do protocolo completo reutilizando o motor de simulação.',
    objectives: [],
    status: 'planned',
  },
  {
    id: 'aes',
    category: 'simetrica',
    title: 'AES',
    summary: 'Rodadas, SubBytes, ShiftRows, MixColumns e AddRoundKey.',
    objectives: [],
    status: 'planned',
  },
  {
    id: 'chacha20',
    category: 'simetrica',
    title: 'ChaCha20',
    summary: 'Cifra de fluxo baseada em operações ARX.',
    objectives: [],
    status: 'planned',
  },
  {
    id: 'modos-aead',
    category: 'simetrica',
    title: 'Modos de operação e criptografia autenticada',
    summary: 'ECB, CBC, CTR e GCM: por que o modo importa.',
    objectives: [],
    status: 'planned',
  },
  {
    id: 'hash-hmac',
    category: 'simetrica',
    title: 'Primitivas: funções hash e HMAC',
    summary: 'SHA-2 reais, efeito avalanche visualizado bit a bit e HMAC calculado passo a passo (RFC 2104).',
    objectives: ['Observar o efeito avalanche', 'Calcular o HMAC em duas passagens', 'Distinguir hash de autenticação de mensagem'],
    status: 'available',
    component: lazy(() => import('./hash-hmac/HashHmacLab')),
  },
];

export const labsByCategory = (id: CategoryId) => LABS.filter((l) => l.category === id);
export const findLab = (id: string | undefined) => LABS.find((l) => l.id === id);
