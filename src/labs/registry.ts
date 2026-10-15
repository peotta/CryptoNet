import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type CategoryId = 'classica' | 'simetrica' | 'assimetrica';

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
    id: 'classica',
    title: 'Criptografia Clássica',
    description: 'Cifras de substituição e de transposição anteriores aos computadores, e a criptoanálise que as quebra: força bruta, análise de frequência e máquinas.',
  },
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
    id: 'cesar-afim',
    category: 'classica',
    title: 'Cifras de César e afim',
    summary: 'Disco de cifra, aritmética modular e a criptoanálise de Eva por força bruta e frequência das letras.',
    objectives: ['Cifrar e decifrar módulo 26', 'Entender por que mdc(a, 26) = 1', 'Quebrar a cifra por força bruta e por frequência'],
    status: 'available',
    component: lazy(() => import('./classica/CesarAfimLab')),
  },
  {
    id: 'substituicao-frequencia',
    category: 'classica',
    title: 'Substituição simples e análise de frequência',
    summary: 'Chave de 26 letras (26! chaves) e a quebra por histograma de frequências e índice de coincidência.',
    objectives: [],
    status: 'planned',
  },
  {
    id: 'vigenere',
    category: 'classica',
    title: 'Vigenère, Kasiski e índice de coincidência',
    summary: 'Cifra polialfabética e como Eva descobre o tamanho da chave.',
    objectives: [],
    status: 'planned',
  },
  {
    id: 'playfair-hill',
    category: 'classica',
    title: 'Playfair e Hill',
    summary: 'Cifras poligráficas: digrafos em uma grade 5 × 5 e multiplicação por matriz módulo 26.',
    objectives: [],
    status: 'planned',
  },
  {
    id: 'transposicao',
    category: 'classica',
    title: 'Transposição e cifra produto',
    summary: 'Cerca de trilhos, transposição colunar e a combinação com substituição (confusão e difusão).',
    objectives: [],
    status: 'planned',
  },
  {
    id: 'enigma',
    category: 'classica',
    title: 'Máquina Enigma',
    summary: 'Rotores, refletor e painel de plugues: o caminho do sinal e a criptoanálise.',
    objectives: [],
    status: 'planned',
  },
  {
    id: 'otp',
    category: 'classica',
    title: 'One-time pad',
    summary: 'Sigilo perfeito e o perigo de reutilizar a chave.',
    objectives: [],
    status: 'planned',
  },
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
    title: 'AES e modos de operação',
    summary: 'As rodadas do AES operação por operação e a comparação de ECB, CBC, CTR e GCM diante de Eva, que observa e altera a cifra.',
    objectives: ['Acompanhar SubBytes, ShiftRows, MixColumns e AddRoundKey', 'Ver o vazamento de padrões do ECB', 'Comparar o efeito da adulteração em cada modo'],
    status: 'available',
    component: lazy(() => import('./aes/AesLab')),
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
