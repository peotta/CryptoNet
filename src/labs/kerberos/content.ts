import type { ReviewQuestion } from '../../components/ui';

export const KRB_OBJECTIVES = [
  'Acompanhar as três trocas do Kerberos (AS, TGS e AP) e dizer o que cada mensagem carrega e com qual chave é cifrada (RFC 4120).',
  'Explicar por que a senha de Alice nunca trafega e como o TGT permite uma única autenticação por sessão (login único).',
  'Distinguir o tíquete (opaco para o cliente) do autenticador (prova de posse da chave de sessão) e dizer por que os dois são necessários.',
  'Mostrar que o carimbo de tempo limita a janela de repetição, mas só o registro de autenticadores a fecha.',
  'Reconhecer o ataque de adivinhação de senha contra a resposta do AS e a defesa pela pré-autenticação e por senhas fortes.',
];

export const KRB_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'Por que a senha de Alice nunca trafega no Kerberos?',
    answer:
      'Porque a senha só serve para derivar a chave K_c, que Alice e o KDC calculam cada um do seu lado. O KDC prova que conhece K_c cifrando com ela a chave de sessão; Alice prova que a conhece abrindo essa resposta. A rede só vê textos cifrados.',
  },
  {
    question: 'Qual a função do TGT, e por que Alice não consegue lê-lo?',
    answer:
      'O TGT guarda a chave de sessão K_AT e a identidade de Alice, selados com a chave do TGS. Ele permite que Alice peça tíquetes de serviço sem repetir a senha. Alice não o lê porque não tem K_tgs; ela apenas o apresenta ao KDC, que o abre e confia no conteúdo.',
  },
  {
    question: 'Por que o tíquete não basta e é preciso um autenticador?',
    answer:
      'O tíquete circula no canal e Eva pode copiá-lo. O autenticador {alice, T}K_AB mostra que quem o apresenta conhece a chave de sessão naquele instante. Sem K_AB, Eva não monta um autenticador novo.',
  },
  {
    question: 'Eva reenvia o AP-REQ capturado dentro da tolerância de relógio. O que o impede de funcionar?',
    answer:
      'O carimbo de tempo sozinho não impede: dentro de 5 minutos o autenticador ainda é válido. O serviço precisa guardar os autenticadores recentes e recusar a repetição (KRB_AP_ERR_REPEAT). A janela de guarda é a própria tolerância de relógio.',
  },
  {
    question: 'O que é o ataque de adivinhação de senha contra o AS-REP, e como a pré-autenticação o dificulta?',
    answer:
      'Sem pré-autenticação, qualquer pessoa recebe do KDC um texto cifrado com a chave derivada da senha de Alice e pode testá-lo offline contra um dicionário. Com a pré-autenticação, o KDC só responde a quem prova conhecer K_c, e Eva não recebe nada para atacar. Um pedido legítimo capturado no canal ainda contém um dado cifrado com K_c, por isso a senha deve ser forte e o RFC 6113 (FAST) protege o pedido.',
  },
  {
    question: 'Por que o Kerberos depende de relógios sincronizados?',
    answer:
      'Porque os autenticadores carregam um horário e o serviço só os aceita dentro de uma tolerância (por padrão, 5 minutos). Um relógio muito desviado faz o serviço recusar acessos legítimos (KRB_AP_ERR_SKEW), e uma tolerância grande demais alarga a janela de repetição.',
  },
  {
    question: 'Qual a simplificação criptográfica deste laboratório em relação ao RFC 4120?',
    answer:
      'As chaves derivam da senha por PBKDF2 com SHA-256 e as mensagens são seladas com AES-256-GCM. O RFC 3962 define a derivação com PBKDF2 e HMAC-SHA-1 e a cifra AES-CTS com HMAC-SHA1. A estrutura do protocolo (tíquetes, autenticadores, nonces, carimbos) é a mesma; a interoperabilidade com um KDC real não é.',
  },
];
