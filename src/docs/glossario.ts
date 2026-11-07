// Glossário de siglas: fonte única do significado e da finalidade de cada sigla usada nos documentos dos laboratórios.
// Uso: seção "Glossário" no fim de cada documento gerado. A cobertura é verificada por tests/glossario.test.ts.
// Redação: português do Brasil, sem travessão longo nem meia-risca. As expansões seguem os nomes oficiais em inglês.

export interface Sigla {
  /** A sigla como aparece no texto (ex.: "AES-GCM"). */
  sigla: string;
  /** Expansão oficial, em geral em inglês. */
  expansao: string;
  /** Nome em português, quando existe um uso corrente. */
  pt?: string;
  /** Uma frase: para que serve. */
  serve: string;
  /** Ids dos laboratórios em que o sentido vale. Sem este campo, a entrada vale em todos. */
  escopo?: string[];
  /** Siglas que compõem esta (ex.: AES-GCM tem AES e GCM). */
  partes?: string[];
}

export const GLOSSARIO: Sigla[] = [
  // ---- projeto, normas e publicações ----
  { sigla: 'IA', expansao: 'Inteligência Artificial', serve: 'no rodapé do projeto, indica que o conteúdo foi elaborado com apoio de IA generativa, sob revisão do autor' },
  { sigla: 'MIT', expansao: 'Massachusetts Institute of Technology (licença MIT)', pt: 'licença MIT', serve: 'licença de código aberto permissiva sob a qual o CryptoNet é distribuído' },
  { sigla: 'RFC', expansao: 'Request for Comments', pt: 'pedido de comentários', serve: 'documento numerado do IETF que define ou descreve um protocolo da Internet; cada documento do projeto cita as RFCs com link para o RFC Editor' },
  { sigla: 'IETF', expansao: 'Internet Engineering Task Force', serve: 'organização aberta que desenvolve e publica os padrões da Internet, as RFCs' },
  { sigla: 'IEEE', expansao: 'Institute of Electrical and Electronics Engineers', serve: 'entidade profissional que publica padrões e periódicos, como o IEEE Transactions on Information Theory' },
  { sigla: 'NIST', expansao: 'National Institute of Standards and Technology', pt: 'Instituto Nacional de Padrões e Tecnologia (EUA)', serve: 'publica os padrões criptográficos federais americanos, como os FIPS e as SP 800' },
  { sigla: 'EUA', expansao: 'Estados Unidos da América', serve: 'país de origem de órgãos como o NIST e o NBS, citados nos padrões' },
  { sigla: 'NBS', expansao: 'National Bureau of Standards', serve: 'antigo nome do NIST, que publicou o DES em 1977' },
  { sigla: 'FIPS', expansao: 'Federal Information Processing Standards', pt: 'padrões federais de processamento de informação', serve: 'padrões do NIST de uso obrigatório nos órgãos americanos, como o FIPS 197 (AES) e o FIPS 203 (ML-KEM)' },
  { sigla: 'SP', expansao: 'Special Publication', pt: 'publicação especial', serve: 'série de recomendações do NIST, como a SP 800-38A (modos de operação) e a SP 800-38D (modo GCM)' },
  { sigla: 'ISO/IEC', expansao: 'International Organization for Standardization / International Electrotechnical Commission', serve: 'organizações internacionais que publicam normas técnicas conjuntas, inclusive de segurança da informação' },
  { sigla: 'ACM', expansao: 'Association for Computing Machinery', serve: 'sociedade científica que edita periódicos e anais de computação, como o Communications of the ACM' },
  { sigla: 'IACR', expansao: 'International Association for Cryptologic Research', serve: 'associação que organiza as conferências de criptologia e mantém o repositório de artigos ePrint' },
  { sigla: 'USENIX', expansao: 'Advanced Computing Systems Association (nome histórico: Unix Users Group)', serve: 'associação que realiza conferências de sistemas e segurança, como o USENIX Security' },
  { sigla: 'EFF', expansao: 'Electronic Frontier Foundation', serve: 'organização de defesa de direitos digitais que construiu, em 1998, a máquina que quebrou o DES por força bruta' },
  { sigla: 'DOI', expansao: 'Digital Object Identifier', pt: 'identificador de objeto digital', serve: 'identificador permanente de uma publicação, que leva ao artigo pelo endereço doi.org' },
  { sigla: 'PDF', expansao: 'Portable Document Format', pt: 'formato de documento portátil', serve: 'formato de arquivo das cópias dos artigos citados' },
  // ---- cifras simétricas e modos ----
  { sigla: 'AES', expansao: 'Advanced Encryption Standard', pt: 'padrão de criptografia avançado', serve: 'cifra de bloco de 128 bits com chaves de 128, 192 ou 256 bits, padronizada no FIPS 197' },
  { sigla: 'DES', expansao: 'Data Encryption Standard', pt: 'padrão de criptografia de dados', serve: 'cifra de bloco de 64 bits com chave efetiva de 56 bits, padronizada em 1977 e hoje obsoleta' },
  { sigla: 'RC4', expansao: 'Rivest Cipher 4', serve: 'cifra de fluxo antiga, hoje proibida em protocolos modernos por vieses no fluxo de chaves' },
  { sigla: 'KSA', expansao: 'Key-Scheduling Algorithm', pt: 'algoritmo de escalonamento de chave', serve: 'fase do RC4 que embaralha a permutação inicial com a chave', escopo: ['rc4'] },
  { sigla: 'PRGA', expansao: 'Pseudo-Random Generation Algorithm', pt: 'algoritmo de geração pseudoaleatória', serve: 'fase do RC4 que produz o fluxo de chave byte a byte', escopo: ['rc4'] },
  { sigla: 'FMS', expansao: 'Fluhrer, Mantin e Shamir', serve: 'ataque de 2001 que recupera a chave do WEP a partir dos primeiros bytes do fluxo de chave do RC4', escopo: ['rc4'] },
  { sigla: 'PTW', expansao: 'Pyshkin, Tews e Weinmann', serve: 'ataque de 2007 ao WEP que precisa de bem menos pacotes que o FMS', escopo: ['rc4'] },
  { sigla: 'WEP', expansao: 'Wired Equivalent Privacy', pt: 'privacidade equivalente à de redes cabeadas', serve: 'mecanismo de segurança do Wi-Fi original, baseado em RC4 e quebrado por falhas no uso do vetor de inicialização' },
  { sigla: 'WPA', expansao: 'Wi-Fi Protected Access', pt: 'acesso protegido Wi-Fi', serve: 'sucessor do WEP no Wi-Fi, com renovação das chaves por pacote' },
  { sigla: 'WPA2', expansao: 'Wi-Fi Protected Access 2', serve: 'versão do WPA que usa o AES no modo CCMP', partes: ['WPA', 'AES'] },
  { sigla: 'GCM', expansao: 'Galois/Counter Mode', pt: 'modo de Galois com contador', serve: 'modo de operação que cifra em modo contador e autentica com um hash universal; é um modo AEAD (SP 800-38D)' },
  { sigla: 'AES-GCM', expansao: 'AES no modo Galois/Counter', serve: 'cifra autenticada de uso corrente no TLS e em armazenamento: cifra e detecta alteração com a mesma chave', partes: ['AES', 'GCM'] },
  { sigla: 'CTR', expansao: 'Counter mode', pt: 'modo contador', serve: 'transforma uma cifra de bloco em cifra de fluxo cifrando contadores sucessivos' },
  { sigla: 'AES-CTR', expansao: 'AES no modo contador', serve: 'cifra de fluxo construída com o AES; não autentica a mensagem', partes: ['AES', 'CTR'] },
  { sigla: 'CBC', expansao: 'Cipher Block Chaining', pt: 'encadeamento de blocos cifrados', serve: 'modo em que cada bloco é combinado por XOR com o bloco cifrado anterior antes de cifrar; exige vetor de inicialização imprevisível' },
  { sigla: 'ECB', expansao: 'Electronic Codebook', pt: 'livro de códigos eletrônico', serve: 'modo em que cada bloco é cifrado separadamente; blocos iguais geram textos cifrados iguais, o que revela padrões' },
  { sigla: 'IV', expansao: 'Initialization Vector', pt: 'vetor de inicialização', serve: 'valor que torna distintas duas cifragens com a mesma chave; em geral público, mas único ou imprevisível conforme o modo' },
  { sigla: 'XOR', expansao: 'Exclusive OR', pt: 'ou exclusivo', serve: 'operação bit a bit que combina o texto claro com o fluxo de chave e é a sua própria inversa' },
  { sigla: 'AEAD', expansao: 'Authenticated Encryption with Associated Data', pt: 'cifra autenticada com dados associados', serve: 'cifra que protege o sigilo e a integridade juntos e também autentica dados que ficam em claro, como cabeçalhos' },
  { sigla: 'GHASH', expansao: 'Galois Hash', serve: 'função de autenticação do GCM, calculada por multiplicação no corpo de Galois GF(2^128)', partes: ['GCM'] },
  { sigla: 'GF', expansao: 'Galois Field', pt: 'corpo de Galois', serve: 'corpo finito em que o AES e o GHASH fazem suas multiplicações' },
  { sigla: 'ARX', expansao: 'Add-Rotate-XOR', serve: 'família de cifras construídas só com soma, rotação e XOR, como o ChaCha20', escopo: ['chacha20'] },
  { sigla: 'PC-1', expansao: 'Permuted Choice 1', pt: 'escolha permutada 1', serve: 'permutação que reduz a chave de 64 para 56 bits no escalonamento de chaves do DES', escopo: ['des'] },
  { sigla: 'PC-2', expansao: 'Permuted Choice 2', pt: 'escolha permutada 2', serve: 'permutação que seleciona 48 bits para formar cada subchave de rodada do DES', escopo: ['des'] },
  { sigla: 'BEAST', expansao: 'Browser Exploit Against SSL/TLS', serve: 'ataque de 2011 ao CBC com vetor de inicialização previsível no TLS 1.0', escopo: ['aes'] },
  { sigla: 'SAC', expansao: 'Selected Areas in Cryptography', serve: 'conferência de criptografia em que foram publicados artigos sobre o RC4', escopo: ['rc4'] },
  // ---- hash, MAC e derivação de chaves ----
  { sigla: 'SHA-1', expansao: 'Secure Hash Algorithm 1', serve: 'hash de 160 bits com colisões demonstradas; evitado em assinaturas, mas ainda usado no HMAC do HOTP e do TOTP' },
  { sigla: 'SHA-2', expansao: 'Secure Hash Algorithm 2', serve: 'família de hashes (SHA-224 a SHA-512) padronizada no FIPS 180-4' },
  { sigla: 'SHA-3', expansao: 'Secure Hash Algorithm 3', serve: 'família de hashes baseada na esponja Keccak, padronizada no FIPS 202' },
  { sigla: 'SHA-256', expansao: 'Secure Hash Algorithm, saída de 256 bits', serve: 'hash da família SHA-2 de uso mais comum', partes: ['SHA-2'] },
  { sigla: 'SHA-512', expansao: 'Secure Hash Algorithm, saída de 512 bits', serve: 'hash da família SHA-2 com palavras de 64 bits', partes: ['SHA-2'] },
  { sigla: 'HMAC', expansao: 'Keyed-Hash Message Authentication Code', pt: 'código de autenticação de mensagem com chave', serve: 'autentica uma mensagem com uma chave secreta e uma função de hash (RFC 2104)' },
  { sigla: 'HKDF', expansao: 'HMAC-based Key Derivation Function', pt: 'função de derivação de chaves baseada em HMAC', serve: 'extrai e expande um segredo em várias chaves independentes (RFC 5869)', partes: ['HMAC'] },
  { sigla: 'PBKDF2', expansao: 'Password-Based Key Derivation Function 2', serve: 'deriva uma chave de uma senha repetindo um HMAC muitas vezes, para encarecer a adivinhação (RFC 8018)', partes: ['HMAC'] },
  { sigla: 'PKCS', expansao: 'Public-Key Cryptography Standards', pt: 'padrões de criptografia de chave pública', serve: 'série de padrões da RSA Laboratories, como o PKCS #1 (RSA) e o PKCS #5 (senhas)' },
  { sigla: 'HOTP', expansao: 'HMAC-based One-Time Password', pt: 'senha de uso único baseada em HMAC', serve: 'código de uso único derivado de um segredo e de um contador de eventos (RFC 4226)', partes: ['HMAC'] },
  { sigla: 'TOTP', expansao: 'Time-based One-Time Password', pt: 'senha de uso único baseada em tempo', serve: 'código que muda a cada 30 segundos, derivado de um segredo e do relógio (RFC 6238), usado como segundo fator', partes: ['HOTP'] },
  // ---- criptografia assimétrica e acordo de chaves ----
  { sigla: 'RSA', expansao: 'Rivest, Shamir e Adleman', serve: 'sistema de chave pública cuja segurança vem da dificuldade de fatorar o produto de dois primos grandes; cifra e assina' },
  { sigla: 'OAEP', expansao: 'Optimal Asymmetric Encryption Padding', pt: 'preenchimento assimétrico ótimo para cifração', serve: 'preenchimento aleatório que torna a cifração RSA segura contra textos cifrados escolhidos (PKCS #1)', partes: ['RSA'] },
  { sigla: 'PSS', expansao: 'Probabilistic Signature Scheme', pt: 'esquema de assinatura probabilístico', serve: 'preenchimento aleatório da assinatura RSA, com prova de segurança (PKCS #1)', partes: ['RSA'] },
  { sigla: 'DH', expansao: 'Diffie-Hellman', serve: 'troca de chaves em que as duas partes chegam ao mesmo segredo sem enviá-lo pela rede' },
  { sigla: 'ECDH', expansao: 'Elliptic Curve Diffie-Hellman', pt: 'Diffie-Hellman em curvas elípticas', serve: 'acordo de chaves que obtém o mesmo segredo compartilhado com chaves bem menores que as do DH clássico', partes: ['DH'] },
  { sigla: 'ECDHE', expansao: 'Elliptic Curve Diffie-Hellman Ephemeral', pt: 'Diffie-Hellman efêmero em curvas elípticas', serve: 'ECDH com chaves novas a cada sessão, o que dá sigilo perfeito para a frente', partes: ['ECDH'] },
  { sigla: 'ECDSA', expansao: 'Elliptic Curve Digital Signature Algorithm', pt: 'algoritmo de assinatura digital em curvas elípticas', serve: 'assinatura digital sobre curvas elípticas (FIPS 186-5)' },
  { sigla: 'KEM', expansao: 'Key Encapsulation Mechanism', pt: 'mecanismo de encapsulamento de chave', serve: 'esquema de chave pública que transporta um segredo compartilhado: quem encapsula gera o segredo e o texto cifrado, e quem desencapsula recupera o segredo' },
  { sigla: 'ML-KEM', expansao: 'Module-Lattice-Based Key-Encapsulation Mechanism', pt: 'mecanismo de encapsulamento de chave baseado em reticulados de módulo', serve: 'KEM pós-quântico padronizado no FIPS 203, derivado do CRYSTALS-Kyber', partes: ['KEM'] },
  { sigla: 'ML-DSA', expansao: 'Module-Lattice-Based Digital Signature Algorithm', serve: 'assinatura pós-quântica padronizada no FIPS 204, derivada do CRYSTALS-Dilithium' },
  { sigla: 'SLH-DSA', expansao: 'Stateless Hash-Based Digital Signature Algorithm', serve: 'assinatura pós-quântica baseada em hash, padronizada no FIPS 205' },
  { sigla: 'LWE', expansao: 'Learning With Errors', pt: 'aprendizado com erros', serve: 'problema de reticulados, difícil mesmo para computadores quânticos, em que se baseiam o ML-KEM e outros esquemas pós-quânticos' },
  { sigla: 'NTT', expansao: 'Number-Theoretic Transform', pt: 'transformada teórica dos números', serve: 'análogo da FFT em corpos finitos, que acelera a multiplicação de polinômios no ML-KEM', escopo: ['ml-kem'] },
  { sigla: 'CCA', expansao: 'Chosen-Ciphertext Attack', pt: 'ataque de texto cifrado escolhido', serve: 'modelo de ataque em que o adversário pede a decifração de textos cifrados à sua escolha; "CCA-secure" é resistir a ele' },
  { sigla: 'MITM', expansao: 'Man-in-the-Middle', pt: 'homem do meio', serve: 'ataque em que Eva se interpõe entre Alice e Bob e retransmite ou altera as mensagens' },
  { sigla: 'MITB', expansao: 'Man-in-the-Browser', pt: 'homem no navegador', serve: 'ataque em que um código malicioso no navegador altera o que o usuário vê e envia', escopo: ['dap'] },
  { sigla: 'PSK', expansao: 'Pre-Shared Key', pt: 'chave pré-compartilhada', serve: 'segredo combinado antes da sessão, usado para autenticar ou derivar chaves' },
  // ---- protocolos, redes e formatos ----
  { sigla: 'TLS', expansao: 'Transport Layer Security', pt: 'segurança da camada de transporte', serve: 'protocolo que cifra e autentica a comunicação entre cliente e servidor; sucessor do SSL' },
  { sigla: 'SSL', expansao: 'Secure Sockets Layer', serve: 'protocolo que deu origem ao TLS; suas versões estão obsoletas e proibidas', partes: ['TLS'] },
  { sigla: 'SSH', expansao: 'Secure Shell', serve: 'protocolo de acesso remoto e de transferência de arquivos com autenticação e cifra' },
  { sigla: 'HTTP', expansao: 'Hypertext Transfer Protocol', pt: 'protocolo de transferência de hipertexto', serve: 'protocolo de aplicação da Web' },
  { sigla: 'HTTPS', expansao: 'HTTP over TLS', pt: 'HTTP sobre TLS', serve: 'HTTP protegido por TLS', partes: ['HTTP', 'TLS'] },
  { sigla: 'IP', expansao: 'Internet Protocol', pt: 'protocolo de internet', serve: 'endereça e encaminha pacotes entre redes, de origem a destino' },
  { sigla: 'CCS', expansao: 'Change Cipher Spec (no TLS) / Computer and Communications Security (conferência da ACM)', serve: 'no TLS 1.3, mensagem mantida só por compatibilidade com middleboxes; nas referências, o simpósio ACM CCS' },
  { sigla: 'HS', expansao: 'Handshake Secret', pt: 'segredo do handshake', serve: 'segredo do cronograma de chaves do TLS 1.3 de que saem as chaves de tráfego do handshake', escopo: ['tls13'] },
  { sigla: 'API', expansao: 'Application Programming Interface', pt: 'interface de programação de aplicações', serve: 'conjunto de funções que um programa oferece a outros, como a Web Crypto API usada no navegador' },
  { sigla: 'JSON', expansao: 'JavaScript Object Notation', serve: 'formato de texto para dados estruturados; no laboratório do Kerberos, serializa o conteúdo dos tíquetes', escopo: ['kerberos'] },
  { sigla: 'ASCII', expansao: 'American Standard Code for Information Interchange', serve: 'código que associa números aos caracteres básicos de texto' },
  { sigla: 'UTF-8', expansao: 'Unicode Transformation Format, 8 bits', serve: 'codificação de texto Unicode em bytes, compatível com o ASCII' },
  { sigla: 'UTC', expansao: 'Coordinated Universal Time', pt: 'tempo universal coordenado', serve: 'referência de horário usada nos exemplos de TOTP e Kerberos' },
  { sigla: 'QR', expansao: 'Quick Response', pt: 'resposta rápida', serve: 'código de barras bidimensional; entrega o segredo do TOTP ao aplicativo autenticador, e no DAP leva a chave pelo canal óptico' },
  { sigla: 'PIN', expansao: 'Personal Identification Number', pt: 'número de identificação pessoal', serve: 'senha numérica curta que, com o cartão, autentica o usuário' },
  { sigla: 'SMS', expansao: 'Short Message Service', pt: 'serviço de mensagens curtas', serve: 'mensagem de texto de celular, às vezes usada para entregar um código de uso único' },
  { sigla: 'ID', expansao: 'Identifier', pt: 'identificador', serve: 'valor que nomeia uma chave, um usuário ou uma sessão' },
  { sigla: 'HSM', expansao: 'Hardware Security Module', pt: 'módulo de segurança em hardware', serve: 'dispositivo que guarda chaves e executa operações criptográficas sem expô-las', escopo: ['dap'] },
  { sigla: 'ATM', expansao: 'Automated Teller Machine', pt: 'caixa eletrônico', serve: 'terminal bancário usado como canal de autenticação no DAP', escopo: ['dap'] },
  { sigla: 'DAP', expansao: 'Dynamic Authorization Protocol', pt: 'protocolo de autorização dinâmica', serve: 'protocolo de autorização de transações com canal óptico fora de banda entre o computador e o celular', escopo: ['dap'] },
  { sigla: 'UC', expansao: 'Untrusted Computer', pt: 'computador não confiável', serve: 'o computador do usuário, que pode estar comprometido e por isso não é o único canal de autorização', escopo: ['dap'] },
  { sigla: 'MD', expansao: 'Mobile Device', pt: 'dispositivo móvel', serve: 'o celular do usuário, que exibe os dados da transação e confirma a autorização', escopo: ['dap'] },
  { sigla: 'MK', expansao: 'Master Key', pt: 'chave-mestra', serve: 'chave guardada no HSM do banco, da qual derivam as chaves de cada usuário', escopo: ['dap'] },
  { sigla: 'WYSIWYS', expansao: 'What You See Is What You Sign', pt: 'o que você vê é o que você assina', serve: 'princípio de que a tela confiável mostra os dados exatos que serão autenticados', escopo: ['dap'] },
  // ---- autenticação e Kerberos ----
  { sigla: 'KDC', expansao: 'Key Distribution Center', pt: 'centro de distribuição de chaves', serve: 'terceiro de confiança do Kerberos que conhece a chave de cada participante e emite tíquetes', escopo: ['kerberos'] },
  { sigla: 'AS', expansao: 'Authentication Service', pt: 'serviço de autenticação', serve: 'parte do KDC que verifica o cliente e entrega o tíquete de concessão de tíquetes (TGT)', escopo: ['kerberos'] },
  { sigla: 'TGS', expansao: 'Ticket-Granting Service', pt: 'serviço de concessão de tíquetes', serve: 'parte do KDC que troca o TGT por tíquetes de serviço', escopo: ['kerberos'] },
  { sigla: 'TGT', expansao: 'Ticket-Granting Ticket', pt: 'tíquete de concessão de tíquetes', serve: 'tíquete emitido pelo AS, que permite pedir tíquetes de serviço sem repetir a senha', escopo: ['kerberos'] },
  { sigla: 'AP', expansao: 'Application Protocol (exchange)', pt: 'troca com a aplicação', serve: 'troca em que o cliente apresenta o tíquete e o autenticador ao serviço', escopo: ['kerberos'] },
  { sigla: 'FAST', expansao: 'Flexible Authentication Secure Tunneling', serve: 'túnel que protege o pedido inicial do Kerberos contra a adivinhação de senha offline (RFC 6113)', escopo: ['kerberos'] },
  { sigla: 'GSS-API', expansao: 'Generic Security Service Application Program Interface', serve: 'interface genérica que as aplicações usam para obter autenticação do Kerberos (RFC 4121)', escopo: ['kerberos'] },
  // ---- criptografia clássica ----
  { sigla: 'IC', expansao: 'Índice de Coincidência (Index of Coincidence)', serve: 'probabilidade de duas letras sorteadas do texto serem iguais; distingue um texto de substituição simples de um polialfabético' },
  { sigla: 'ADFGVX', expansao: 'letras A, D, F, G, V e X (nome da cifra alemã de 1918)', serve: 'cifra produto que combinava um quadrado de substituição com uma transposição, quebrada em 1918' },
  { sigla: 'FDR', expansao: 'Failures-Divergences Refinement', serve: 'verificador de modelos com que Lowe encontrou o ataque ao protocolo Needham-Schroeder', escopo: ['needham-schroeder'] },
  { sigla: 'CMS', expansao: 'Cryptographic Message Syntax', serve: 'formato padronizado para mensagens assinadas e cifradas (RFC 5652)' },
];

/** Siglas que aparecem nos documentos mas não são siglas de glossário: textos de exemplo, nomes próprios, variantes e combinações. */
export const NAO_SIGLAS = new Set([
  // textos cifrados, palavras-chave, mensagens e pares de letras de exemplo
  'AMANHECER', 'ENIGMA', 'MESMO', 'MESMA', 'CHAVE', 'ATAQUE', 'ESTA', 'EVA', 'PAGAR', 'PARA', 'TRANSFERIR', 'SEGREDO', 'RELATORIO', 'RELATORIODOTEMPO', 'MARIA', 'MONARQUIA', 'SILVA',
  'LEMON', 'LEMONLEMONLE', 'ATTACKATDAWN', 'WEAREDISCOVEREDFLEEATONCE', 'WECRLTE', 'WECRLTEERDSOEEFEAOC', 'WECRLTEERDSOEEFEAOCAIVDEN', 'TUDO', 'HELLO', 'EXAMPLE', 'PLAYFAIR', 'PLAYF',
  'AAAAA', 'AAA', 'AA', 'AB', 'BA', 'CD', 'DC', 'BM', 'ES', 'DE', 'OS', 'HI', 'AO', 'OU', 'US', 'QU', 'QX', 'IX', 'QWERTY', 'ROFESSORE', 'ERDSOEEFEAOC', 'KNOQS', 'KLM',
  'BCDGH', 'BDZGO', 'BFX', 'BFY', 'ADU', 'ADV', 'AEW', 'AIVDEN', 'DWDTXH', 'EQNVZ', 'HXUQFLDEJMTPSD', 'IREXM', 'LXFOPVEFRNHR', 'PZZQZIPMT', 'QDV', 'TUVWZ', 'XMCKL',
  // marcadores de diagrama, variáveis e rótulos
  'C1', 'C2', 'P1', 'P2', 'K1', 'K2', 'K3', 'K16', 'N1', 'N2', 'CH', 'KS', 'HW', 'IT-22', 'II', 'III', 'V5', 'SNAP', 'LLC/SNAP', 'AP-REP', 'AP-REQ', 'AS-REP', 'AS-REQ', 'TGS-REP', 'TGS-REQ', 'MD5',
  // nomes de conferências, editoras e identificadores
  'CRYPTO', 'INDOCRYPT', 'STOC', 'MDPI', 'ORCID', 'CRYSTALS', 'X25519', 'SHAKE', 'SHAKE128', 'UTF', 'ASN', 'EDE',
  // combinações cujas partes já têm entrada
  'AES-128', 'AES-192', 'AES-256', 'AES-128-GCM', 'AES-256-GCM', 'AES-128-CBC', 'AES-256-CBC', 'AES-128-CTR', 'AES-128-ECB', 'AES-CTS', 'DES-CBC', 'ECDSA-P256',
  'HMAC-SHA-1', 'HMAC-SHA1', 'HMAC-SHA-2', 'HMAC-SHA-256', 'HMAC-SHA-512', 'HKDF-SHA-256', 'PBKDF2-HMAC-SHA-256', 'SHA-224', 'SHA-384', 'SHA3-512', 'OR', 'ML-KEM-768',
  'RSA-OAEP', 'RSA-PSS', 'RSAES-OAEP', 'RSASSA-PSS', 'RC4-HMAC-EXP',
]);

/** Siglas citadas em um texto, com o número de ocorrências. Ignora blocos e trechos de código, links e números de RFC. */
export function siglasDoTexto(texto: string): Map<string, number> {
  const rx = /(?<![\w/#.-])([A-Z][A-Z0-9]+(?:[/-][A-Z0-9]+)*)(?!\w)/g;
  const limpo = texto
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\]\([^)]*\)/g, '](')
    .replace(/RFC \d+/g, '');
  const out = new Map<string, number>();
  for (const m of limpo.matchAll(rx)) out.set(m[1], (out.get(m[1]) || 0) + 1);
  return out;
}

/** Entrada do glossário para uma sigla, preferindo a do laboratório informado e, na falta, a de escopo geral. */
export function buscarSigla(sigla: string, labId?: string): Sigla | undefined {
  const todas = GLOSSARIO.filter((e) => e.sigla === sigla);
  return todas.find((e) => labId && e.escopo?.includes(labId)) || todas.find((e) => !e.escopo) || todas[0];
}

/** Entrada para uma sigla num laboratório: a de escopo próprio ou a geral. Sem a de outro laboratório (sentido errado). */
export function siglaNoLaboratorio(sigla: string, labId: string): Sigla | undefined {
  const todas = GLOSSARIO.filter((e) => e.sigla === sigla);
  return todas.find((e) => e.escopo?.includes(labId)) || todas.find((e) => !e.escopo);
}

const significado = (e: Sigla): string => e.expansao + (e.pt ? ', ' + e.pt : '');
const FIM_DOC = '\n\n---\n\n*';

/**
 * Acrescenta ao documento gerado a seção "Glossário", com o significado e a finalidade de cada sigla do
 * glossário que aparece no texto (no sentido do laboratório). O texto corrido não é alterado e o rodapé de crédito fica no fim.
 */
export function comSecaoDeSiglas(texto: string, labId: string): string {
  const fim = texto.lastIndexOf(FIM_DOC);
  const corpo = fim >= 0 ? texto.slice(0, fim) : texto.replace(/\s+$/, '');
  const rodape = fim >= 0 ? texto.slice(fim) : '\n';
  const presentes = [...siglasDoTexto(corpo).keys()]
    .map((s) => siglaNoLaboratorio(s, labId))
    .filter((e): e is Sigla => !!e)
    .sort((a, b) => a.sigla.localeCompare(b.sigla, 'en'));
  if (!presentes.length) return corpo + rodape;
  const numerada = [...corpo.matchAll(/^## (\d+)\. /gm)].pop();
  const titulo = numerada ? `## ${Number(numerada[1]) + 1}. Glossário` : '## Glossário';
  const cel = (s: string) => s.replace(/\|/g, '\\|');
  const tabela = presentes.map((e) => `| **${cel(e.sigla)}** | ${cel(significado(e))} | ${cel(e.serve)} |`);
  const secao = [titulo, '', 'Significado e finalidade das siglas usadas neste documento.', '', '| Sigla | Significado | Para que serve |', '| --- | --- | --- |', ...tabela].join('\n');
  return corpo + '\n\n' + secao + '\n' + rodape;
}
