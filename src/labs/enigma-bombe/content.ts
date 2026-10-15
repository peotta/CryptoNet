import type { ReviewQuestion } from '../../components/ui';

export const BOMBE_OBJECTIVES = [
  'Montar o menu de um texto provável (crib): o grafo que liga a letra suposta à letra cifrada em cada tecla.',
  'Explicar a hipótese de plugue e a propagação de consequências, e reconhecer uma contradição (uma letra com dois plugues).',
  'Acompanhar passo a passo a propagação em uma posição inicial e ver por que a posição errada leva a contradição.',
  'Relacionar o número de laços do menu ao número de paradas falsas, e entender por que menus sem laços não funcionam.',
  'Reconhecer paradas verdadeiras e falsas e completar o painel de plugues pela legibilidade do texto.',
  'Comparar o custo da Bombe (17.576 posições por ordem de rotores) com a força bruta sobre o espaço de chaves inteiro.',
];

export const BOMBE_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'O que é o menu da Bombe e como se monta?',
    answer:
      'É um grafo cujos vértices são letras e cujas arestas representam as teclas do texto provável: na tecla k, liga-se a letra suposta do texto claro à letra cifrada, e a aresta leva o número k. Como cada tecla corresponde a uma posição diferente dos rotores, cada aresta representa uma permutação diferente da máquina. Os laços (ciclos) do grafo são o que dá poder ao ataque.',
  },
  {
    question: 'Por que a Bombe não precisa conhecer o painel de plugues para testar uma posição dos rotores?',
    answer:
      'Porque as consequências do texto provável dependem só da relação entre as letras ligadas por plugues. Se o plugue da letra a é y (S(a) = y), então S(b) = E_k(y), em que E_k é a permutação dos rotores e do refletor na tecla k. Basta supor um plugue para uma letra e propagar. Se a propagação exigir que alguma letra tenha dois plugues, a hipótese é impossível. Se todas as 26 hipóteses forem impossíveis, a posição dos rotores é descartada, sem que o painel seja conhecido.',
  },
  {
    question: 'O que é uma parada da Bombe e por que existem paradas falsas?',
    answer:
      'Uma parada é uma posição inicial dos rotores em que ao menos uma hipótese de plugue não leva a contradição. Pode ser a verdadeira ou acaso: cada hipótese errada escapa da contradição com probabilidade que cai muito com o número de laços do menu. Com poucos laços, milhares de posições falsas sobrevivem (como no experimento deste laboratório); com dois ou mais laços sobra praticamente só a verdadeira.',
  },
  {
    question: 'Por que o texto provável precisa estar na posição certa, e como os aliados lidavam com isso?',
    answer:
      'O menu é montado alinhando o texto provável à cifra. Se o alinhamento estiver errado, as contradições surgem em quase todas as posições e a Bombe não deixa a parada verdadeira. Os aliados exploravam a propriedade de que nenhuma letra se cifra em si mesma para descartar alinhamentos impossíveis (como na fase 1) e a regularidade das mensagens (relatórios do tempo, saudações, fórmulas finais) para propor textos prováveis em posições conhecidas.',
  },
  {
    question: 'Qual a diferença entre a Bombe polonesa (bomba) e a Bombe de Turing?',
    answer:
      'A bomba polonesa (1938) explorava a repetição da chave de mensagem enviada duas vezes no início de cada mensagem, um defeito do procedimento alemão. Quando os alemães mudaram o procedimento, Turing e Welchman projetaram, em Bletchley Park, uma máquina baseada em textos prováveis, que funcionava sem depender da repetição. Welchman acrescentou o painel diagonal, que explora a simetria do painel de plugues (se S(a) = y, então S(y) = a) e reduziu muito as paradas falsas.',
  },
  {
    question: 'Esta simulação reproduz a Bombe histórica fielmente?',
    answer:
      'Não. Ela reproduz a ideia lógica (menu, hipótese de plugue, propagação com simetria e contradição), mas simplifica: Eva conhece a ordem dos rotores, o refletor e os anéis (a máquina real era executada para cada ordem de rotores e tratava os anéis pelo cálculo de entalhes), o avanço dos rotores é simulado exatamente (a máquina física exigia que o rotor do meio não girasse durante o texto provável) e o completamento do painel usa a legibilidade do texto, em vez do trabalho manual dos analistas.',
  },
];
