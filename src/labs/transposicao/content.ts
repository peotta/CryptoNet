import type { ReviewQuestion } from '../../components/ui';

export const TRANSPOSICAO_OBJECTIVES = [
  'Distinguir substituição (troca as letras) de transposição (troca as posições) e reconhecer cada uma pela estatística da cifra.',
  'Cifrar e decifrar com a cerca de trilhos e com a transposição colunar com palavra-chave.',
  'Explicar por que a transposição preserva o índice de coincidência e o histograma de letras, e por que isso a denuncia.',
  'Executar a criptoanálise por anagramação: testar números de trilhos e ordens de colunas e escolher o texto mais legível.',
  'Compreender confusão e difusão (Shannon) e por que a cifra produto resiste aos ataques que quebram cada parte isolada.',
  'Relacionar a cifra produto às rodadas do AES (SubBytes é confusão; ShiftRows e MixColumns são difusão).',
];

export const TRANSPOSICAO_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Cifre "WEAREDISCOVEREDFLEEATONCE" com a cerca de trilhos de 3 trilhos.',
    answer:
      'A escrita em zigue-zague coloca as letras nos trilhos 1, 2, 3, 2, 1, 2, 3, ... Lendo trilho por trilho: trilho 1 = WECRLTE, trilho 2 = ERDSOEEFEAOC, trilho 3 = AIVDEN. A cifra é "WECRLTEERDSOEEFEAOCAIVDEN".',
  },
  {
    question: 'Por que o índice de coincidência de uma cifra de transposição é igual ao do texto claro?',
    answer:
      'Porque a transposição só reordena as letras: a contagem de cada letra não muda, e o IC depende apenas dessas contagens. Por isso o histograma da cifra acompanha o do português, e Eva reconhece de imediato que se trata de transposição. O que se perde são os pares de letras vizinhas, e é isso que ela explora.',
  },
  {
    question: 'Como Eva quebra a transposição colunar de poucas colunas?',
    answer:
      'Por anagramação: para cada número de colunas testa todas as ordens de leitura (c! permutações) e escolhe a que dá o texto mais legível, medido pela probabilidade dos pares de letras. Com 8 colunas são 40.320 ordens, trivial para um computador. A palavra-chave não precisa ser descoberta como palavra, apenas a ordem das colunas.',
  },
  {
    question: 'Aumentar o número de colunas torna a transposição segura?',
    answer:
      'Não por si só. O espaço de chaves cresce como c! (12! ≈ 4,8 × 10⁸), mas a busca local (trocar colunas e manter o que melhora a legibilidade) e a análise de pares de colunas quebram chaves maiores sem testar todas. A dupla transposição, usada até a Segunda Guerra, dificulta mais, mas ainda é cifra clássica.',
  },
  {
    question: 'O que são confusão e difusão, e como a cifra produto as combina?',
    answer:
      'Shannon (1949) chamou de confusão a relação complexa entre chave e cifra (a substituição esconde as letras) e de difusão o espalhamento da estrutura do texto claro (a transposição desfaz os pares de letras). A cifra produto aplica as duas em sequência: a anagramação falha porque as letras já estão trocadas, e a análise de frequência com bigramas falha porque os pares estão embaralhados.',
  },
  {
    question: 'A cifra produto de substituição e transposição é segura?',
    answer:
      'Não. Resiste aos ataques isolados, mas existem ataques conjuntos: por exemplo, pares de letras repetidos são invariantes à substituição e revelam a estrutura da transposição. A ADFGVX alemã (1918), que combinava um quadrado de Polybius com transposição colunar, foi quebrada por Georges Painvin. A lição moderna é a do AES: muitas rodadas de confusão e difusão com chaves fortes e análise pública.',
  },
];
