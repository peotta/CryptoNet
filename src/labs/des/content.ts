import type { ReviewQuestion } from '../../components/ui';

export const DES_OBJECTIVES = [
  'Descrever o DES como uma rede de Feistel de 16 rodadas sobre blocos de 64 bits e chave de 56 bits úteis.',
  'Acompanhar a geração das 16 subchaves de 48 bits (PC-1, giros de C e D e PC-2) e a função f (expansão E, XOR com a subchave, caixas S e permutação P), conferidas com o exemplo clássico.',
  'Explicar por que decifrar é cifrar com as subchaves em ordem inversa e qual é o papel das permutações inicial e final.',
  'Mostrar por que 56 bits não bastam: a busca exaustiva de Eva com texto claro conhecido, em escala didática, e a projeção para a chave inteira.',
  'Entender o Triple DES (cifrar, decifrar, cifrar), a segurança efetiva de 112 bits e o limite do bloco de 64 bits (Sweet32).',
  'Verificar o efeito avalanche, a propriedade do complemento e as chaves fracas, e situar o DES entre a FIPS 46-3 (retirada) e o AES.',
];

export const DES_QUESTIONS: ReviewQuestion[] = [
  {
    question: 'O que é uma rede de Feistel e por que o DES decifra com o mesmo circuito de cifragem?',
    answer:
      'Em cada rodada o bloco é dividido em L e R, e o novo estado é L(i) = R(i-1) e R(i) = L(i-1) ⊕ f(R(i-1), K(i)). A função f não precisa ser inversível, porque a inversão da rodada é feita pelo XOR: L(i-1) = R(i) ⊕ f(L(i), K(i)). Por isso, para decifrar basta executar as mesmas 16 rodadas com as subchaves em ordem inversa (K16 primeiro), depois de trocar as metades no fim.',
  },
  {
    question: 'Quais são os papéis da expansão E, das caixas S e da permutação P na função f?',
    answer:
      'A expansão E leva 32 bits a 48 repetindo alguns, para casar com a subchave e para que cada bit influencie duas caixas S. O XOR com a subchave é o único ponto em que a chave entra. As oito caixas S (6 bits para 4 bits) são a única parte não linear, fonte da confusão; sem elas o DES seria uma função linear e se quebraria por álgebra. A permutação P espalha as saídas das caixas pelas entradas da rodada seguinte, produzindo difusão.',
  },
  {
    question: 'Por que a chave do DES tem 56 bits úteis se ocupa 64 bits?',
    answer:
      'O último bit de cada um dos 8 bytes é de paridade (ímpar) e é descartado pela PC-1. Os 56 bits restantes definem 2^56, cerca de 7,2 × 10^16 chaves. Os bits de paridade foram pensados para detectar erros de transmissão da chave, e não aumentam a segurança. Mudar um bit de paridade não altera a cifra.',
  },
  {
    question: 'Como Eva quebra um DES com um par de texto claro e cifra conhecidos?',
    answer:
      'Ela testa cada uma das 2^56 chaves cifrando o bloco claro conhecido e compara com o bloco cifrado observado; a chave certa é a que coincide (no CBC, o bloco claro é antes combinado com o IV, que é público). Em média basta metade do espaço, 2^55 testes. Isso é viável: o EFF DES Cracker (1998) levou 56 horas e, com a rede distributed.net (1999), 22 horas e 15 minutos. O laboratório faz o mesmo em escala reduzida, deixando poucos bits desconhecidos.',
  },
  {
    question: 'Por que o Triple DES usa cifrar, decifrar, cifrar (EDE) e não cifrar três vezes?',
    answer:
      'Com K1 = K2 = K3, o passo D(K2, ·) desfaz o E(K1, ·) e o conjunto equivale a uma única cifragem DES com K3, o que preservou a compatibilidade com sistemas antigos. Quanto à segurança, o ataque do encontro no meio (meet-in-the-middle) reduz o custo de 2^168 para cerca de 2^112 com três chaves independentes; com duas chaves (K3 = K1) a segurança cai para cerca de 80 bits (nível legado no SP 800-57 Parte 1 Rev. 5). Duas cifragens em sequência (2DES) renderiam só cerca de 57 bits de segurança, por isso o 3DES.',
  },
  {
    question: 'O que é o ataque Sweet32 e por que ele condena o DES e o Triple DES?',
    answer:
      'Em um bloco de 64 bits, pelo paradoxo do aniversário, depois de cerca de 2^32 blocos (32 GiB) cifrados com a mesma chave em CBC surgem dois blocos cifrados iguais, e o XOR deles revela o XOR dos dois blocos claros. Em 2016 mostrou-se que isso é prático contra conexões longas (HTTPS e OpenVPN com 3DES ou Blowfish). Não adianta aumentar a chave: o limite é o tamanho do bloco. O AES tem blocos de 128 bits, e o limite sobe a 2^64 blocos.',
  },
  {
    question: 'O que mostra o CBC quando Eva inverte um bit de um bloco cifrado?',
    answer:
      'Bob decifra o bloco alterado por completo, e o resultado é irreconhecível (cerca de metade dos 64 bits muda). No bloco seguinte, o mesmo bit é invertido, porque o bloco cifrado alterado entra no XOR dele. Eva consegue modificar de forma dirigida um bloco ao preço de corromper o anterior, sem conhecer a chave. O CBC cifra, mas não autentica: é preciso um código de autenticação (HMAC) ou um modo autenticado, como o GCM.',
  },
];
