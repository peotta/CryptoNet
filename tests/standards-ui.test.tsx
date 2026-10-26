// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App';

afterEach(cleanup);

async function openLab(id: string) {
  render(
    <MotionConfig reducedMotion="always">
      <MemoryRouter initialEntries={[`/lab/${id}`]}>
        <AppRoutes />
      </MemoryRouter>
    </MotionConfig>,
  );
  const heading = await screen.findByText('Normas e referências', undefined, { timeout: 15000 });
  return heading.parentElement as HTMLElement;
}

describe('normas e referências na introdução dos laboratórios', () => {
  it.each([
    ['rsa', [/FIPS 186-5/, /FIPS 180-4/, /SP 800-56B Rev\. 2/, /SP 800-57 Parte 1 Rev\. 5/]],
    ['diffie-hellman', [/SP 800-56A Rev\. 3/, /SP 800-56C Rev\. 2/, /SP 800-38D/]],
    ['ecdh-assinaturas', [/FIPS 186-5/, /SP 800-186/, /SP 800-56A Rev\. 3/]],
    ['tls13', [/RFC 9846/, /SP 800-52 Rev\. 2/, /FIPS 186-5/]],
    ['chacha20', [/RFC 8439.*ChaCha20/, /não é um algoritmo aprovado pelo NIST/]],
  ] as const)('%s', async (id, expected) => {
    const box = await openLab(id);
    for (const re of expected) expect(box.textContent, String(re)).toMatch(re);
  }, 30000);

  it('cada FIPS e SP citada é link para a página oficial do NIST, em nova aba', async () => {
    const box = await openLab('rsa');
    const link = within(box).getByRole('link', { name: /^FIPS 186-5/ });
    expect(link.getAttribute('href')).toBe('https://csrc.nist.gov/pubs/fips/186-5/final');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(within(box).getByRole('link', { name: /^SP 800-56B Rev\. 2/ }).getAttribute('href')).toBe('https://csrc.nist.gov/pubs/sp/800/56/b/r2/final');
    expect(within(box).getByRole('link', { name: /^RFC 8017/ }).getAttribute('href')).toBe('https://www.rfc-editor.org/rfc/rfc8017');
  }, 30000);

  it('nenhum laboratório cita a RFC 8446 como vigente (foi substituída pela RFC 9846)', async () => {
    const box = await openLab('tls13');
    expect(box.textContent).toMatch(/substitui a RFC 8446/);
  }, 30000);
});
