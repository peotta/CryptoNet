import type { ReviewQuestion } from '../../components/ui';

export const RSA_OBJECTIVES = [
  'Calcular um par de chaves RSA a partir de dois primos (n, φ(n), e, d) e interpretar cada parâmetro.',
  'Cifrar e decifrar com exponenciação modular e explicar por que m^(e·d) ≡ m (mod n).',
  'Diferenciar RSA de livro-texto (sem padding) de RSA-OAEP e RSA-PSS, e justificar por que só os últimos são aceitáveis na prática.',
  'Distinguir cifragem (confidencialidade, chave pública cifra) de assinatura digital (autenticidade e integridade, chave privada assina).',
  'Observar o efeito da adulteração de uma cifra ou de uma mensagem assinada.',
];

export const RSA_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Por que a segurança do RSA depende da dificuldade de fatorar n, e não de manter n em segredo?',
    answer:
      'O módulo n é público. Quem fatora n = p × q calcula φ(n) = (p - 1)(q - 1) e, com isso, obtém d como inverso modular de e. A chave privada deixa de ser secreta. Por isso n precisa ser grande o bastante para tornar a fatoração inviável (2048 bits ou mais).',
  },
  {
    question: 'Com p = 61, q = 53 e e = 17, qual é o valor de d? Verifique que e·d ≡ 1 (mod φ(n)).',
    answer: 'φ(n) = 60 × 52 = 3120 e d = 2753, pois 17 × 2753 = 46801 = 15 × 3120 + 1. Logo e·d ≡ 1 (mod 3120).',
  },
  {
    question: 'Por que o RSA sem padding é inseguro mesmo com chaves grandes?',
    answer:
      'Ele é determinístico (mesma mensagem, mesma cifra), permite ataques de dicionário, é maleável (c1 × c2 mod n cifra m1 × m2) e não detecta adulteração. Padrões como OAEP e PSS acrescentam aleatoriedade e verificações de integridade.',
  },
  {
    question: 'Qual a diferença entre cifrar com a chave pública e assinar com a chave privada?',
    answer:
      'Na cifragem, qualquer pessoa pode cifrar para o dono da chave e só ele decifra (confidencialidade). Na assinatura, só o dono da chave privada assina e qualquer pessoa verifica com a pública (autenticidade, integridade e não repúdio). A assinatura, por si só, não oculta a mensagem.',
  },
  {
    question: 'No modo real, por que a decifragem falha quando um único bit da cifra é alterado?',
    answer:
      'O RSA-OAEP embute um teste de integridade no bloco codificado: após a operação com a chave privada, o decodificador verifica a estrutura (hash do rótulo e separador). Uma cifra alterada produz um bloco sem essa estrutura e a operação é rejeitada.',
  },
];
