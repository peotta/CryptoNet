// Valores aleatórios de uma execução do laboratório. Em uso normal vêm da Web Crypto; nos testes e na
// documentação vêm de uma fonte determinística, para que os resultados sejam reproduzíveis.

/** Material aleatório de um desafio: 48 octetos para o Nonce, 16 para o IV e 32 para o sorteio de r (com rejeição). */
export interface ChallengeSeed {
  nonce: Uint8Array;
  iv: Uint8Array;
  rnd: Uint8Array;
}

export interface DapSeeds {
  /** Chave-mestra do HSM (512 bits). */
  mk: Uint8Array;
  /** Metade k1 guardada pelo e-Bank (512 bits). */
  k1: Uint8Array;
  /** Metade k1 que Eva coloca no lugar da verdadeira, no ataque ao provisionamento. */
  evaK1: Uint8Array;
  /** Octetos para o identificador Enroll. */
  enrollSrc: Uint8Array;
  act: ChallengeSeed;
  tx: ChallengeSeed;
  /** Segundo desafio, usado na repetição do código por Eva. */
  tx2: ChallengeSeed;
}

const challengeSeed = (random: (n: number) => Uint8Array): ChallengeSeed => ({ nonce: random(48), iv: random(16), rnd: random(32) });

export function makeSeeds(random: (n: number) => Uint8Array): DapSeeds {
  return {
    mk: random(64),
    k1: random(64),
    evaK1: random(64),
    enrollSrc: random(48),
    act: challengeSeed(random),
    tx: challengeSeed(random),
    tx2: challengeSeed(random),
  };
}

/** Fonte determinística (não criptográfica): só para testes e documentação. */
export function fixedRandom(seed = 1): (n: number) => Uint8Array {
  let pos = 0;
  return (n) =>
    Uint8Array.from({ length: n }, () => {
      const i = pos++;
      return (i * 37 + seed * 101 + (i >> 3) * 11 + (i >> 6) * 29) & 0xff;
    });
}
