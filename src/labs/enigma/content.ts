import type { ReviewQuestion } from '../../components/ui';

export const ENIGMA_OBJECTIVES = [
  'Descrever os componentes da Enigma I: teclado, painel de plugues, três rotores, refletor e lâmpadas.',
  'Acompanhar o caminho do sinal por uma tecla: ida pelos rotores, reflexão e volta.',
  'Explicar o avanço dos rotores, inclusive o passo duplo do rotor do meio, e por que a cifra é polialfabética.',
  'Explicar por que a Enigma é recíproca e por que nenhuma letra é cifrada em si mesma.',
  'Calcular o tamanho do espaço de chaves e relacioná-lo à segurança que se imaginava.',
  'Usar um texto provável (crib) e a fraqueza do refletor para descartar hipóteses, como fizeram os criptoanalistas aliados.',
];

export const ENIGMA_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Cifre "AAAAA" com os rotores I-II-III, refletor B, posições AAA e sem plugues. Qual é a cifra?',
    answer:
      'BDZGO. A mesma letra A vira cinco letras diferentes, porque o rotor da direita avança a cada tecla e muda a ligação elétrica. Observe também que nenhum A vira A.',
  },
  {
    question: 'Por que a Enigma é recíproca, isto é, cifrar e decifrar são a mesma operação?',
    answer:
      'O refletor é uma involução sem ponto fixo: liga as letras em pares (se A vai a E, então E vai a A), e o sinal percorre o mesmo circuito nos dois sentidos. Se, com uma certa posição dos rotores, P é cifrada em C, então C é cifrada em P na mesma posição. Basta partir da mesma configuração e das mesmas posições iniciais.',
  },
  {
    question: 'Por que nenhuma letra pode ser cifrada em si mesma, e por que isso é uma fraqueza?',
    answer:
      'O refletor nunca liga uma letra a ela mesma, e o sinal volta pelo mesmo caminho, então a saída nunca é igual à entrada. Isso permite descartar qualquer alinhamento de um texto provável (crib) em que uma letra do texto coincida com a da cifra na mesma posição, reduzindo muito as hipóteses.',
  },
  {
    question: 'O que é o passo duplo (double stepping) do rotor do meio?',
    answer:
      'O rotor do meio avança quando o rotor da direita passa pelo seu entalhe, mas também quando ele próprio está no entalhe, e, nesse caso, arrasta o rotor da esquerda. Por isso o rotor do meio pode avançar em duas teclas seguidas (por exemplo, ADU, ADV, AEW, BFX, BFY: o rotor do meio vai de D para E e de E para F).',
  },
  {
    question: 'Quantas configurações a Enigma I admite? Isso a tornava segura?',
    answer:
      'Com 3 rotores escolhidos entre 5 (60 ordens), 26³ = 17.576 posições iniciais e 10 pares de plugues (150.738.274.937.250 combinações), são cerca de 1,6 × 10²⁰ configurações, sem contar os anéis. Era um espaço enorme para a época, mas os ataques não testaram todas as chaves: exploraram textos prováveis, a fraqueza do refletor e erros dos operadores, com máquinas (as Bombes) para eliminar hipóteses.',
  },
  {
    question: 'Por que a Enigma não protege a integridade da mensagem?',
    answer:
      'Cada letra é cifrada de forma independente do restante: se Eva altera uma letra da cifra, apenas a letra correspondente sai errada na decifragem, e Bob não tem como perceber (só pelo contexto). Não há etiqueta de autenticação, como o GCM tem.',
  },
];
