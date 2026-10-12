/** Duração de uma animação em segundos, respeitando velocidade e preferência por movimento reduzido. */
export function motionDuration(baseSeconds: number, speed: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return baseSeconds / Math.max(speed, 0.1);
}
