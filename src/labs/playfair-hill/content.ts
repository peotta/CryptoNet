import type { ReviewQuestion } from '../../components/ui';

export const POLY_OBJECTIVES = [
  'Montar a grade 5 × 5 do Playfair a partir de uma palavra-chave e aplicar as regras da linha, da coluna e do retângulo.',
  'Explicar por que cifrar pares de letras (digrafos) achata o histograma de letras e resiste à análise de frequência simples.',
  'Cifrar e decifrar com a cifra de Hill por multiplicação de matrizes módulo 26, e calcular a inversa da chave.',
  'Explicar por que o determinante da matriz-chave precisa ser coprimo com 26.',
  'Executar o ataque de texto claro conhecido contra o Hill (K = C · P⁻¹) e entender por que a linearidade o torna frágil.',
  'Reconhecer que nenhuma das duas cifras tem integridade e que ambas são cifras clássicas, sem segurança real.',
];

export const POLY_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Cifre "HI" com o Playfair e a chave "PLAYFAIR EXAMPLE". Qual a regra aplicada?',
    answer:
      'A grade é PLAYF / IREXM / BCDGH / KNOQS / TUVWZ. H está na linha 3, coluna 5 e I na linha 2, coluna 1: linhas e colunas diferentes, regra do retângulo. H é trocada pela letra da sua linha na coluna de I (B) e I pela letra da sua linha na coluna de H (M). O resultado é "BM".',
  },
  {
    question: 'Por que o Playfair resiste à análise de frequência que quebra a substituição simples?',
    answer:
      'Porque cifra pares de letras: a mesma letra clara vira letras cifradas diferentes conforme a vizinha, e o histograma de letras fica achatado (o IC cai bastante, de cerca de 0,07 para cerca de 0,05). As estatísticas de digrafos existem, mas são cerca de 600 possíveis em vez de 26, e exigem muito mais texto cifrado para aparecer.',
  },
  {
    question: 'Por que o Playfair não é seguro, apesar disso?',
    answer:
      'Digrafos repetidos no texto claro geram digrafos repetidos na cifra, e a estrutura da língua (digrafos como "ES", "DE", "OS") sobrevive. Com algumas centenas de letras, análise de digrafos, palavras prováveis ou busca por computador recuperam a grade. Também vale o padrão inverso: se AB vira CD, então BA vira DC.',
  },
  {
    question: 'Por que o determinante da matriz do Hill precisa ser coprimo com 26?',
    answer:
      'Para a matriz ter inversa módulo 26: K⁻¹ = (det K)⁻¹ · adj(K), e o inverso de det K módulo 26 só existe se mdc(det K, 26) = 1. Sem inversa, Bob não consegue decifrar e blocos diferentes poderiam gerar a mesma cifra.',
  },
  {
    question: 'Como Eva quebra o Hill 2 × 2 conhecendo 4 letras do texto claro?',
    answer:
      'Dois blocos de texto claro P1 e P2 e as cifras C1 e C2 satisfazem C = K · P, em que as colunas de P e de C são os blocos. Se P é inversível módulo 26, então K = C · P⁻¹. Ela calcula P⁻¹ (inverso do determinante vezes a adjunta) e multiplica. A linearidade do Hill é a sua fraqueza.',
  },
  {
    question: 'Por que às vezes o ataque ao Hill precisa de mais texto claro conhecido do que o mínimo?',
    answer:
      'Porque os blocos conhecidos precisam formar uma matriz P inversível módulo 26. Dependendo das letras, o determinante pode ser par ou múltiplo de 13 e P não tem inversa (por exemplo, blocos repetidos). Com mais blocos, Eva escolhe outros que sejam independentes.',
  },
  {
    question: 'O Hill difunde cada letra por todo o bloco. Isso o protege contra adulteração?',
    answer:
      'Não. Se Eva altera uma letra da cifra, o bloco inteiro de n letras é decifrado errado (difusão), mas Bob não tem como perceber: não há verificação de integridade. Só cifras autenticadas, como o AES-GCM, detectam a alteração.',
  },
];
