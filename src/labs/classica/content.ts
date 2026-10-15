import type { ReviewQuestion } from '../../components/ui';

export const CLASSICAL_OBJECTIVES = [
  'Cifrar e decifrar com a cifra de César e com a cifra afim, e escrever as fórmulas em aritmética modular (módulo 26).',
  'Explicar por que a cifra afim exige mdc(a, 26) = 1 e calcular o inverso multiplicativo de a.',
  'Calcular o tamanho do espaço de chaves de cada cifra (26 e 312) e relacioná-lo à força bruta.',
  'Usar a análise de frequência das letras e a estatística χ² para quebrar uma cifra de substituição.',
  'Reconhecer o princípio de Kerckhoffs e por que as cifras clássicas não oferecem integridade nem segurança.',
];

export const CLASSICAL_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Cifre "ATAQUE" com a cifra de César e k = 3. Qual é a decifragem de "DWDTXH"?',
    answer: 'A → D, T → W, A → D, Q → T, U → X e E → H, logo "ATAQUE" vira "DWDTXH". Decifrar é deslocar 3 posições para trás, o que devolve "ATAQUE".',
  },
  {
    question: 'Por que a cifra afim C = (a·P + b) mod 26 não aceita a = 2 nem a = 13?',
    answer:
      'Porque mdc(a, 26) precisa ser 1 para que a multiplicação tenha inverso módulo 26. Com a = 2, duas letras diferentes (por exemplo, A e N) viram a mesma letra cifrada, e a decifragem passa a ser ambígua. Há 12 valores válidos de a (1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23 e 25).',
  },
  {
    question: 'Quantas chaves tem a cifra afim? É seguro?',
    answer:
      '12 valores de a e 26 de b: 312 chaves. Não é seguro: Eva testa as 312 em milissegundos e escolhe a que dá o texto mais parecido com português. Com duas letras claras conhecidas, ela resolve um sistema de duas equações e descobre a e b.',
  },
  {
    question: 'Por que a análise de frequência funciona contra o César e a cifra afim?',
    answer:
      'Porque cada letra do texto claro sempre vira a mesma letra cifrada: a cifra apenas permuta as letras. As frequências do português (A, E e O muito comuns; K, W e Y raras) sobrevivem, só trocadas de posição. O histograma da cifra é o do português reordenado.',
  },
  {
    question: 'Eva altera uma letra da cifra. Bob percebe?',
    answer:
      'Não. Cifras clássicas não têm nenhum mecanismo de integridade: Bob decifra a letra alterada e obtém outra letra no texto claro, sem nenhum aviso. Isso reaparece nos modos CBC e CTR do AES, e só o GCM, com a etiqueta de autenticação, detecta a alteração.',
  },
  {
    question: 'O que diz o princípio de Kerckhoffs, e como ele se aplica a estas cifras?',
    answer:
      'A segurança de um sistema deve depender somente do sigilo da chave, e não do sigilo do algoritmo. Eva conhece o algoritmo (César ou afim), e o que protege a mensagem seria apenas a chave, mas o espaço de chaves é tão pequeno que a proteção desaparece.',
  },
];
