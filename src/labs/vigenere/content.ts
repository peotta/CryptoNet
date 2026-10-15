import type { ReviewQuestion } from '../../components/ui';

export const VIGENERE_OBJECTIVES = [
  'Cifrar e decifrar com a Vigenère, somando a cada letra a letra da chave na posição i mod m (módulo 26).',
  'Usar a tabela de Vigenère e explicar por que a cifra é polialfabética.',
  'Explicar por que o índice de coincidência do texto inteiro cai e por que o IC de cada coluna não.',
  'Aplicar o teste de Kasiski e o IC médio por tamanho de chave para descobrir o tamanho da chave.',
  'Deduzir a chave por análise de frequência de cada coluna, reduzindo a Vigenère a vários Césares.',
  'Relacionar o tamanho da chave e do texto ao sucesso da criptoanálise.',
];

export const VIGENERE_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Cifre "ATTACKATDAWN" com a chave LEMON. Qual é a cifra?',
    answer:
      'A chave se repete: LEMONLEMONLE. Somando letra a letra, módulo 26: A+L = L, T+E = X, T+M = F, A+O = O, C+N = P, K+L = V, e assim por diante. O resultado é "LXFOPVEFRNHR".',
  },
  {
    question: 'Por que a Vigenère resiste à análise de frequência simples, que quebra a substituição?',
    answer:
      'Porque a mesma letra clara vira letras cifradas diferentes, conforme a posição (cada letra da chave usa um alfabeto). O histograma da cifra fica quase plano e o IC do texto inteiro cai para perto de 0,04, escondendo a frequência do idioma.',
  },
  {
    question: 'Como o teste de Kasiski revela o tamanho da chave?',
    answer:
      'Se um trecho de texto claro se repete a uma distância que é múltiplo do tamanho m da chave, ele é cifrado do mesmo jeito nas duas vezes e a cifra repete a sequência. As distâncias entre repetições são múltiplos de m; o fator comum a muitas delas é candidato a m. Divisores pequenos (2, 3...) também aparecem, por isso o Kasiski sozinho pode ser ambíguo.',
  },
  {
    question: 'Por que o IC médio das colunas tem um pico no tamanho correto da chave (e em seus múltiplos)?',
    answer:
      'Com o tamanho certo, cada coluna foi cifrada por uma única letra da chave, isto é, é um César: tem o mesmo IC do português (cerca de 0,074). Com um tamanho errado, cada coluna mistura letras cifradas por chaves diferentes e o IC cai para perto de 0,04. Múltiplos do tamanho certo também separam colunas de uma única letra de chave; o menor deles é o tamanho da chave.',
  },
  {
    question: 'Depois de saber o tamanho da chave, como Eva encontra as letras da chave?',
    answer:
      'Separa o texto em m colunas. Cada coluna é um César com um deslocamento desconhecido; testando os 26 deslocamentos e escolhendo o que deixa a coluna mais parecida com português (menor χ²), obtém a letra da chave daquela coluna. A Vigenère se reduz, assim, a m cifras de César.',
  },
  {
    question: 'Por que uma chave tão longa quanto a mensagem, usada uma única vez, muda tudo?',
    answer:
      'Se a chave é aleatória, tão longa quanto o texto e nunca reutilizada, não há repetição para o Kasiski nem colunas para a frequência: é o one-time pad, que tem sigilo perfeito (Shannon). Chaves curtas e repetidas, como na Vigenère, deixam a periodicidade, e é ela que Eva explora.',
  },
];
