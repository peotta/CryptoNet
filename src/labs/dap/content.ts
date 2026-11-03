import type { ReviewQuestion } from '../../components/ui';

export const DAP_OBJECTIVES = [
  'Explicar por que um computador não confiável (UC) não pode ser o único canal de autorização de uma transação, e como o DAP usa um canal óptico fora de banda com o celular (MD).',
  'Acompanhar o provisionamento da chave k por duas metades, k = k1 ⊕ k2, em dois canais separados, e a ativação com o código de transação 000.',
  'Montar e verificar o desafio trans_data | r\' | y: cifragem do código r com AES-256-CBC e autenticação do conjunto com HMAC-SHA-256.',
  'Aplicar o princípio "o que você vê é o que você assina" (WYSIWYS): a tela do MD mostra os dados autenticados, e o usuário confere.',
  'Reconhecer como o DAP reage a Eva: alteração do QR, pedido trocado por malware, chute do código, repetição do código e metade da chave trocada.',
  'Identificar os limites do protocolo: a independência das metades da chave, o relógio do MD e o usuário que confirma uma transação fraudulenta.',
];

export const DAP_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Por que a chave k é entregue em duas metades por canais diferentes, e o que acontece se Eva vê as duas?',
    answer:
      'k1 é uniforme em {0,1}^512 e k2 sai de uma função pseudoaleatória com a chave-mestra MK, de modo que cada metade isolada não diz nada sobre k = k1 ⊕ k2 (argumento do one-time pad). O UC mostra k1 e o ATM mostra k2: Eva, que controla o UC, vê só k1. Se ela também enxergar o ATM no momento em que k2 é exibido (por exemplo, com uma câmera oculta), calcula k e o segundo fator deixa de existir. Por isso o ATM exibe k2 uma única vez, por pouco tempo, e o banco deve refazer o cadastro se suspeitar de observação.',
  },
  {
    question: 'O QR de troca de chaves (código 001) tem um campo Check. Ele impede que Eva troque k1 por outra metade?',
    answer:
      'Não. O Check são os 4 primeiros octetos do SHA-256 do próprio texto e qualquer pessoa pode recalculá-lo, então só detecta erro de leitura. Se Eva trocar k1, o MD aceita o QR e calcula uma chave diferente da do e-Bank. A troca é descoberta na ativação: o desafio de código 000 é autenticado com a chave do e-Bank, o MD recalcula y com outra chave e o resultado não confere. Por isso o e-Bank só habilita o MD depois de uma ativação bem-sucedida.',
  },
  {
    question: 'Por que o MD recalcula y antes de decifrar r\' e interrompe tudo se a etiqueta não confere?',
    answer:
      'A etiqueta cobre trans_data e r\' (cifrar e depois autenticar). Assim, nenhum byte alterado em trânsito chega à decifragem, o que evita ataques de oráculo de preenchimento, e nenhum dado financeiro adulterado chega à tela do MD. Como Eva não conhece k\'1, não consegue recalcular y para o conteúdo que alterou. A comparação é em tempo constante para não vazar, pelo tempo, quantos octetos coincidem.',
  },
  {
    question: 'Eva repassa o QR autêntico de uma transação fraudulenta (ataque MITB). O HMAC não detecta nada. Onde o ataque é barrado?',
    answer:
      'Na tela do MD. O desafio é autêntico, pois veio do e-Bank, mas traz a conta e o valor de Eva. O MD mostra esses dados autenticados e Alice, ao compará-los com o que pretendia, cancela. Sem o r_hat, que só aparece depois da confirmação, o e-Bank não executa a transação e a cancela em até 120 s. A proteção, porém, depende do usuário: se ele confirmar sem ler, o DAP autoriza a fraude, risco residual que o draft reconhece e que pede avisos claros na interface do MD.',
  },
  {
    question: 'O código r tem só seis dígitos. Por que Eva não consegue quebrá-lo por força bruta?',
    answer:
      'Porque a adivinhação precisa passar pelo e-Bank, que aceita no máximo 3 tentativas por desafio dentro de 120 s e depois cancela a transação: a chance de sucesso é de 3 em 10^6 (3 × 10^-6). Offline, Eva também não tem como testar candidatos, já que r\' é a cifra de r com k\'2, que ela desconhece, e qualquer chave produz algum texto. O limite por usuário de desafios falhos e o monitoramento complementam a defesa.',
  },
  {
    question: 'O que o prazo de 120 s e o carimbo de geração acrescentam à proteção contra repetição?',
    answer:
      'O carimbo está dentro de trans_data e, portanto, coberto pelo HMAC: Eva não pode rejuvenescer um QR antigo. O MD descarta desafios com mais de 120 s e tolera até 60 s de adiantamento por causa dos relógios de celulares. Essa verificação é complementar, porque o relógio do MD não é confiável e não conta o tempo de leitura da tela e de digitação. A autoridade do prazo é o e-Bank, que cancela por conta própria depois de 120 s e invalida o código na primeira execução.',
  },
];
