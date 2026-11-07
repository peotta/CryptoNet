import type { ReviewQuestion } from '../../components/ui';

export const NS_OBJECTIVES = [
  'Descrever o protocolo de Needham-Schroeder de chave pública em três mensagens, {Na, A}, {Na, Nb} e {Nb}, e o papel dos nonces (números usados uma vez) na prova de atualidade e de posse da chave privada.',
  'Executar o protocolo passo a passo entre Alice e Bob, vendo o que cada um calcula, decifra e confere, e o que Eva observa no canal.',
  'Reproduzir o ataque de Lowe (1995): Eva, um participante legítimo, usa uma sessão iniciada por Alice para se passar por Alice diante de Bob e obter os dois nonces.',
  'Explicar por que o protocolo falha: a mensagem 2 não identifica quem a gerou, e Alice funciona, sem saber, como oráculo de decifragem para Eva.',
  'Aplicar a correção de Lowe (a identidade de Bob dentro da mensagem 2) e verificar que Alice aborta o protocolo diante do ataque.',
  'Situar o protocolo entre os de autenticação com servidor de chaves: a versão simétrica, a falha de repetição de Denning e Sacco e o Kerberos.',
];

export const NS_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Qual é o papel dos nonces Na e Nb no protocolo de chave pública?',
    answer:
      'Um nonce é um valor aleatório usado uma única vez. Na prova a Alice que a mensagem 2 é recente e foi produzida por quem decifrou a mensagem 1, pois só quem possui a chave privada do destinatário lê Na. Nb prova a Bob que a mensagem 3 foi produzida por quem decifrou a mensagem 2, ou seja, por quem possui a chave privada de Alice. Dessa forma, cada lado recebe uma prova de posse da chave privada do outro e de atualidade, sem relógio sincronizado.',
  },
  {
    question: 'Como Eva realiza o ataque de Lowe e por que Alice não percebe?',
    answer:
      'Alice inicia uma sessão legítima com Eva (um usuário do sistema). Eva decifra a mensagem 1, aprende Na, e a recifra com a chave pública de Bob, apresentando-se como Alice. Bob responde com {Na, Nb} cifrado para Alice; Eva não consegue lê-lo, mas o repassa a Alice sem alterar. Alice decifra, vê o seu Na correto e devolve {Nb} a Eva, achando que conversa com Eva. Eva decifra Nb, recifra para Bob e é aceita como Alice. Alice não percebe porque, na versão original, a mensagem 2 não contém nada que identifique Bob como o seu autor.',
  },
  {
    question: 'Qual foi a correção proposta por Lowe e por que ela funciona?',
    answer:
      'Colocar a identidade do respondente dentro da mensagem 2: {Na, Nb, B}_KA+. Ao decifrá-la, Alice confere que o B interno é o participante com quem iniciou a sessão. No ataque, Alice iniciou a sessão com Eva, mas a mensagem 2 contém B, de modo que ela vê o desencontro e aborta antes de enviar a mensagem 3. Eva não aprende Nb e Bob nunca recebe a confirmação. O vínculo entre a resposta e o seu autor é o que faltava.',
  },
  {
    question: 'Por que o protocolo ficou 17 anos sem que se conhecesse a falha?',
    answer:
      'O protocolo foi publicado em 1978 e a falha só foi descrita por Gavin Lowe em 1995; em 1996, ele mostrou como o verificador de modelos FDR encontra o ataque e confirma a correção. O ataque exige um modelo de adversário em que Eva é também um participante legítimo, que conversa de verdade com Alice. Modelos que consideravam o adversário apenas como alguém de fora do sistema não o enxergavam. É um bom exemplo de como a análise formal revela erros que a revisão informal não vê.',
  },
  {
    question: 'O que é a versão simétrica do protocolo e que falha ela tem?',
    answer:
      'Na versão simétrica, Alice e Bob compartilham chaves de longo prazo com um servidor de confiança S, que gera uma chave de sessão Kab e a entrega a Alice cifrada, junto com um bilhete {Kab, A} cifrado para Bob. A falha foi descrita por Denning e Sacco em 1981: Bob não tem como saber se o bilhete é recente. Se uma chave de sessão antiga for comprometida, Eva reapresenta o bilhete antigo a Bob e o convence a usar uma chave que ela conhece. A solução foi acrescentar carimbos de tempo, que é o que o Kerberos faz. Este laboratório não simula essa versão, porque ela exige um servidor de chaves, um quarto participante.',
  },
  {
    question: 'Como o Kerberos se relaciona com o Needham-Schroeder?',
    answer:
      'O Kerberos (RFC 4120) é descendente direto do protocolo simétrico: usa um servidor de autenticação e um servidor de concessão de bilhetes, e entrega ao cliente bilhetes cifrados para o servidor de aplicação. Corrige a falha de Denning e Sacco com carimbos de tempo e validade nos bilhetes e nos autenticadores, o que exige relógios aproximadamente sincronizados.',
  },
];
