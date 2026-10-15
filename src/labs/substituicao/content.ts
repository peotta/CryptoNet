import type { ReviewQuestion } from '../../components/ui';

export const SUBSTITUTION_OBJECTIVES = [
  'Descrever a cifra de substituição simples e calcular o tamanho do seu espaço de chaves (26!).',
  'Explicar por que um espaço de chaves enorme não torna uma cifra segura.',
  'Aplicar a análise de frequência das letras para formar um primeiro palpite da chave.',
  'Calcular o índice de coincidência e mostrar que a substituição simples não o altera.',
  'Entender como o modelo de bigramas (pares de letras) refina o palpite e quebra a cifra.',
  'Relacionar o tamanho do texto cifrado ao sucesso da criptoanálise.',
];

export const SUBSTITUTION_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Quantas chaves tem a substituição simples? Por que isso não a torna segura?',
    answer:
      '26! ≈ 4,0 × 10²⁶ chaves (a primeira letra tem 26 opções, a segunda 25, e assim por diante). Isso derrota a força bruta, mas não a análise estatística: cada letra clara sempre vira a mesma letra cifrada, e as frequências do idioma sobrevivem. Segurança exige resistir à criptoanálise, e não apenas ao teste de todas as chaves.',
  },
  {
    question: 'Por que a análise de frequência isolada acerta só cerca de metade das letras?',
    answer:
      'Porque letras de frequência parecida se confundem (por exemplo, R, I, N e S, ou D, M e U). O palpite correto da ordem exata depende de pequenas diferenças, que variam de texto para texto. O refinamento com pares de letras resolve essas ambiguidades.',
  },
  {
    question: 'Qual é o índice de coincidência do texto cifrado, em comparação com o do texto claro?',
    answer:
      'É exatamente o mesmo. A substituição apenas renomeia as letras, então a probabilidade de duas letras sorteadas serem iguais não muda (cerca de 0,074 em português, contra 0,038 de um texto aleatório). O Vigenère, ao contrário, aproxima o IC do aleatório, e é por isso que é mais difícil de quebrar.',
  },
  {
    question: 'Por que o refinamento usa pares de letras (bigramas) em vez de só a frequência de cada letra?',
    answer:
      'Porque a frequência individual não distingue letras parecidas, mas os pares sim: "QU" é comum e "QX" é impossível; "ÃO" e "DE" são muito comuns. Medir quão plausível é o texto decifrado, par a par, permite saber se uma troca de duas letras melhora ou piora o palpite.',
  },
  {
    question: 'Por que a criptoanálise de Eva falha com um texto de 40 letras?',
    answer:
      'Com poucas letras, as frequências observadas oscilam muito em relação às do idioma, e há poucos pares de letras para avaliar. A criptoanálise estatística precisa de algumas centenas de letras. Isso é uma limitação dela nesta mensagem, e não segurança: mais texto cifrado com a mesma chave a quebra.',
  },
  {
    question: 'Quais letras da chave Eva não consegue deduzir, e isso a atrapalha?',
    answer:
      'As letras que não aparecem no texto claro, como K, W ou Y em um texto curto. Elas não deixam rastro na cifra. Como não aparecem na mensagem, não atrapalham a leitura dela.',
  },
];
