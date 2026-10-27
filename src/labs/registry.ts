import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type CategoryId = 'classica' | 'simetrica' | 'assimetrica' | 'posquantica';

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
  /** Destaca o cartão com a marca Novo. */
  novo?: boolean;
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
  {
    id: 'posquantica',
    title: 'Criptografia Pós-Quântica',
    description: 'Algoritmos que resistem a computadores quânticos, como o ML-KEM (FIPS 203), baseado em reticulados, e a migração dos protocolos atuais.',
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
    summary: 'Chave de 26 letras (26! chaves) e a quebra por frequência, índice de coincidência e bigramas, com Eva como criptoanalista.',
    objectives: ['Entender por que 26! chaves não bastam', 'Calcular o índice de coincidência', 'Refinar o palpite com pares de letras'],
    status: 'available',
    component: lazy(() => import('./substituicao/SubstituicaoLab')),
  },
  {
    id: 'vigenere',
    category: 'classica',
    title: 'Vigenère, Kasiski e índice de coincidência',
    summary: 'Cifra polialfabética, tabela de Vigenère e como Eva descobre o tamanho e as letras da chave por Kasiski, IC e frequência por coluna.',
    objectives: ['Cifrar com uma chave de várias letras', 'Aplicar o teste de Kasiski e o IC por coluna', 'Quebrar a chave coluna a coluna'],
    status: 'available',
    component: lazy(() => import('./vigenere/VigenereLab')),
  },
  {
    id: 'playfair-hill',
    category: 'classica',
    title: 'Playfair e Hill',
    summary: 'Cifras poligráficas: digrafos em uma grade 5 × 5 e multiplicação por matriz módulo 26, com o ataque de texto claro conhecido contra o Hill.',
    objectives: ['Aplicar as regras do Playfair na grade 5 × 5', 'Cifrar e decifrar com matrizes módulo 26', 'Resolver a chave do Hill com texto claro conhecido'],
    status: 'available',
    component: lazy(() => import('./playfair-hill/PlayfairHillLab')),
  },
  {
    id: 'transposicao',
    category: 'classica',
    title: 'Transposição e cifra produto',
    summary: 'Cerca de trilhos, transposição colunar e a combinação com substituição (confusão e difusão), com a anagramação de Eva.',
    objectives: ['Distinguir substituição de transposição pela estatística', 'Quebrar a transposição por anagramação', 'Entender confusão e difusão na cifra produto'],
    status: 'available',
    component: lazy(() => import('./transposicao/TransposicaoLab')),
  },
  {
    id: 'enigma',
    category: 'classica',
    title: 'Máquina Enigma',
    summary: 'Enigma I: rotores, refletor, anéis e plugues, o caminho do sinal tecla a tecla e a criptoanálise de Eva por texto provável.',
    objectives: ['Acompanhar o sinal pelos rotores e pelo refletor', 'Entender a reciprocidade e o passo duplo', 'Usar um texto provável contra a fraqueza do refletor'],
    status: 'available',
    component: lazy(() => import('./enigma/EnigmaLab')),
  },
  {
    id: 'enigma-bombe',
    category: 'classica',
    title: 'Enigma, fase 2: a Bombe',
    summary: 'O ataque de Turing e Welchman: menu do texto provável, hipótese de plugue, propagação, contradição e paradas falsas, com Alice, Bob e Eva.',
    objectives: ['Montar o menu do texto provável', 'Acompanhar a propagação até a contradição', 'Entender por que os laços eliminam paradas falsas'],
    status: 'available',
    component: lazy(() => import('./enigma-bombe/EnigmaBombeLab')),
  },
  {
    id: 'otp',
    category: 'classica',
    title: 'One-time pad',
    summary: 'Sigilo perfeito de Shannon, a maleabilidade e a destruição do sigilo quando a chave é reutilizada, com o arrasto de texto provável de Eva.',
    objectives: ['Demonstrar o sigilo perfeito', 'Ver por que a chave não pode ser reutilizada', 'Executar o arrasto de texto provável'],
    status: 'available',
    component: lazy(() => import('./otp/OtpLab')),
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
    summary: 'Aritmética de curvas elípticas passo a passo, ECDH e ECDSA em uma curva didática (com o ataque ao nonce reutilizado) e assinaturas reais ECDSA P-256 e Ed25519.',
    objectives: ['Somar pontos e multiplicar por escalar', 'Ver por que o ECDH depende do tamanho do grupo', 'Quebrar o ECDSA com o nonce reutilizado'],
    status: 'available',
    component: lazy(() => import('./ecc/EccLab')),
  },
  {
    id: 'ml-kem',
    novo: true,
    category: 'posquantica',
    title: 'ML-KEM e reticulados (pós-quântica)',
    summary: 'O problema LWE em escala didática e o ML-KEM (FIPS 203) passo a passo, com Eva observando e adulterando o texto cifrado, e a comparação de tamanhos com os algoritmos atuais.',
    objectives: ['Entender o ruído do LWE e por que ele protege a chave', 'Acompanhar a geração de chaves, o encapsulamento e o desencapsulamento do ML-KEM', 'Ver a rejeição implícita diante de um texto cifrado adulterado'],
    status: 'available',
    component: lazy(() => import('./ml-kem/MlKemLab')),
  },
  {
    id: 'tls13',
    category: 'assimetrica',
    title: 'Handshake do TLS 1.3',
    summary: 'ECDHE, cronograma de chaves com HKDF, certificado, CertificateVerify e Finished, com Eva observando e como homem do meio.',
    objectives: ['Acompanhar o handshake 1-RTT', 'Seguir o cronograma de chaves do TLS 1.3', 'Ver por que a autenticação do servidor barra o homem do meio'],
    status: 'available',
    component: lazy(() => import('./tls13/Tls13Lab')),
  },
  {
    id: 'des',
    novo: true,
    category: 'simetrica',
    title: 'DES e Triple DES',
    summary: 'A rede de Feistel de 16 rodadas operação por operação, a busca exaustiva de Eva contra a chave de 56 bits e o Triple DES, com Alice e Bob.',
    objectives: ['Acompanhar subchaves, expansão, caixas S e permutações', 'Ver por que 56 bits não resistem à força bruta', 'Entender o Triple DES e o limite do bloco de 64 bits'],
    status: 'available',
    component: lazy(() => import('./des/DesLab')),
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
    summary: 'Cifra de fluxo ARX (RFC 8439): quarter round e bloco operação por operação, nonce reutilizado e maleabilidade diante de Eva.',
    objectives: ['Executar o quarter round e as 20 rodadas', 'Ver por que o nonce não pode se repetir', 'Perceber que a cifra de fluxo sozinha não autentica'],
    status: 'available',
    component: lazy(() => import('./chacha20/ChaCha20Lab')),
  },
  {
    id: 'rc4',
    novo: true,
    category: 'simetrica',
    title: 'RC4 e o ataque ao WEP',
    summary: 'Cifra de fluxo clássica: KSA e PRGA troca por troca, a maleabilidade e o ataque FMS, com que Eva recupera a chave do WEP por votação.',
    objectives: ['Executar a KSA e a PRGA com vetores conhecidos', 'Ver como o IV em claro do WEP entregou a chave', 'Medir o viés do segundo byte do fluxo'],
    status: 'available',
    component: lazy(() => import('./rc4/Rc4Lab')),
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

/** Documento do laboratório (gerado por npm run docs:labs), no GitHub. */
export const DOCS_BASE = 'https://github.com/peotta/CryptoNet/blob/main/docs/laboratorios/';
export const docUrl = (lab: LabMeta) => `${DOCS_BASE}${lab.id}.md`;

export const labsByCategory = (id: CategoryId) => LABS.filter((l) => l.category === id);
export const findLab = (id: string | undefined) => LABS.find((l) => l.id === id);
