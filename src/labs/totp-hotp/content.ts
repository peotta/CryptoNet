import type { ReviewQuestion } from '../../components/ui';

export const TOTP_OBJECTIVES = [
  'Calcular um código HOTP passo a passo: contador de 8 bytes, HMAC, truncamento dinâmico e redução a 6 dígitos (RFC 4226).',
  'Explicar como o TOTP troca o contador de eventos pelo contador de tempo e por que Alice e Bob chegam ao mesmo código sem trocar mensagens (RFC 6238).',
  'Conferir a implementação contra os vetores de teste publicados nas duas RFCs.',
  'Mostrar por que um código capturado por Eva deixa de valer depois da janela e por que o servidor deve registrar o último contador aceito.',
  'Reconhecer os limites do TOTP: não resiste a phishing em tempo real e depende de limitar as tentativas, pois o código tem poucos dígitos.',
];

export const TOTP_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Por que Alice e Bob geram o mesmo código TOTP sem trocar nenhuma mensagem?',
    answer:
      'Porque ambos têm o segredo K e calculam o mesmo contador C = ⌊T / 30⌋ a partir do horário Unix. O código é HOTP(K, C), uma função determinística de K e de C. Basta que os relógios estejam próximos, e por isso o servidor aceita também os contadores vizinhos.',
  },
  {
    question: 'Por que o HMAC é truncado, e por que a posição do corte muda de código para código?',
    answer:
      'O HMAC-SHA-1 tem 20 bytes e o usuário digita 6 dígitos, então é preciso reduzir. O truncamento dinâmico usa os 4 bits menos significativos do último byte como deslocamento: como esse byte é imprevisível sem K, o corte cai em lugares diferentes do HMAC e nenhum trecho fixo é exposto. A máscara 0x7FFFFFFF apaga o bit de sinal para que todas as implementações cheguem ao mesmo inteiro.',
  },
  {
    question: 'Eva leu o código no canal. Por que ela não consegue usá-lo mais tarde?',
    answer:
      'O código vale só para o contador em que foi gerado. O servidor aceita o contador atual e, no máximo, os vizinhos. Passados cerca de 90 segundos, o contador está três passos adiante e o código capturado não coincide com nenhum dos aceitos. Dentro da janela, porém, ele serve, e é por isso que o servidor deve guardar o último contador aceito.',
  },
  {
    question: 'O que a RFC 6238 exige do servidor depois de aceitar um código?',
    answer:
      'Que não aceite uma segunda tentativa com o mesmo código (seção 5.2). Para isso o servidor registra o último contador validado e recusa qualquer código de contador igual ou menor. Sem esse registro, Eva repete o código lido no canal dentro da mesma janela e entra.',
  },
  {
    question: 'O TOTP protege contra um site falso que repassa o código ao site verdadeiro na hora?',
    answer:
      'Não. O código não está vinculado ao site em que é digitado, então Eva o retransmite ao servidor verdadeiro dentro dos 30 segundos. A proteção exige um fator que verifique a origem, como o WebAuthn, em que a assinatura inclui o domínio.',
  },
  {
    question: 'Um código de 6 dígitos não é fácil de adivinhar? O que o torna aceitável?',
    answer:
      'Há 10^6 códigos e o servidor aceita 3 por vez, então cada palpite acerta com probabilidade de 3 em um milhão. Sem limite, a busca terminaria em minutos. O que o torna aceitável é limitar as tentativas e bloquear a conta após poucos erros: com 5 tentativas, a chance de Eva é de cerca de 0,0015%.',
  },
  {
    question: 'Qual a diferença entre HOTP e TOTP, e quando o HOTP ainda é usado?',
    answer:
      'O HOTP usa um contador de eventos que avança a cada código e precisa ser ressincronizado se o usuário gerar códigos sem usá-los; o código vale até ser usado. O TOTP usa o tempo e expira sozinho. O HOTP continua em tokens de hardware sem relógio, como chaves com um botão.',
  },
];
