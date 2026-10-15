// @vitest-environment jsdom
import axe from 'axe-core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/App';

afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MotionConfig reducedMotion="always">
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </MotionConfig>,
  );
}

async function violations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

const next = () => fireEvent.click(screen.queryByRole('button', { name: 'Iniciar' }) ?? screen.getByRole('button', { name: /Próxima etapa/ }));
const ready = () => screen.findByText(/Estado inicial\. Pressione/, undefined, { timeout: 10000 });
const partB = async (scenario?: string) => {
  renderAt('/lab/chacha20');
  fireEvent.click(await screen.findByRole('radio', { name: /Parte B/ }));
  if (scenario) fireEvent.click(screen.getByRole('radio', { name: scenario }));
  await ready();
};

describe('laboratório de ChaCha20', () => {
  it('está disponível na categoria Simétrica', () => {
    renderAt('/categoria/simetrica');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: ChaCha20/ })).toHaveLength(1);
  });

  it('quarter round: executa uma operação por vez', async () => {
    renderAt('/lab/chacha20');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Iniciar: primeira operação' }))[0]);
    expect(screen.getByText(/Operação 1 de 12: a ← a \+ b/)).toBeTruthy();
    const words = screen.getByRole('table', { name: /Quatro palavras depois da operação 1/ });
    expect(within(words).getByText('12131415')).toBeTruthy(); // 11111111 + 01020304
  });

  it('quarter round completo termina no vetor da RFC', async () => {
    renderAt('/lab/chacha20');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Iniciar: primeira operação' }))[0]);
    for (let i = 0; i < 11; i++) fireEvent.click(screen.getAllByRole('button', { name: /Próxima operação/ })[0]);
    expect(screen.getByText(/Conferido com a RFC 8439/)).toBeTruthy();
    expect(screen.getByText(/ea2a92f4, cb1cf8ce, 4581472e, 5881c4bb/)).toBeTruthy();
  });

  it('valida as palavras do quarter round', async () => {
    renderAt('/lab/chacha20');
    fireEvent.change(await screen.findByLabelText(/Palavra a/), { target: { value: 'xyz' } });
    expect(screen.getAllByRole('alert').some((a) => /hexadecimais/.test(a.textContent ?? ''))).toBe(true);
    expect(screen.getByText(/Corrija as palavras/)).toBeTruthy();
  });

  it('bloco: avança rodada a rodada até o fluxo de chaves da RFC', async () => {
    renderAt('/lab/chacha20');
    const start = await screen.findByRole('button', { name: 'Iniciar: primeira rodada' });
    fireEvent.click(start);
    expect(screen.getByText(/Estado depois da rodada 1 de 20 \(coluna\)/)).toBeTruthy();
    for (let i = 0; i < 19; i++) fireEvent.click(screen.getByRole('button', { name: /Próxima rodada|Somar com o estado inicial/ }));
    fireEvent.click(screen.getByRole('button', { name: /Somar com o estado inicial/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ver o fluxo de chaves/ }));
    expect(screen.getByText(/10f1e7e4d13b5915500fdd1fa32071c4/)).toBeTruthy();
    expect(screen.getByText(/Conferido com a RFC 8439/, { selector: 'p, div, section, h3, strong' })).toBeTruthy();
  });

  it('valida a chave e o nonce do bloco', () => {
    renderAt('/lab/chacha20');
    fireEvent.change(screen.getByLabelText(/Chave \(32 bytes/), { target: { value: 'abc' } });
    expect(screen.getAllByRole('alert').some((a) => /64 dígitos/.test(a.textContent ?? ''))).toBe(true);
  });

  it('Parte B: a animação passo a passo traz Eva só observando', async () => {
    await partB();
    for (let i = 0; i < 6; i++) next(); // chave, nonce, mensagem, fluxo, cifra, trânsito
    expect(screen.getByRole('button', { name: /Eva tenta ler a cifra/ })).toBeTruthy();
    for (let i = 0; i < 5; i++) next();
    expect(screen.getAllByText(/Eva não lê a mensagem/).length).toBeGreaterThan(0);
  }, 30000);

  it('Parte B: com adulteração, Bob aceita uma mensagem alterada', async () => {
    await partB();
    fireEvent.click(screen.getByLabelText(/Eva inverte um bit/));
    await screen.findByRole('button', { name: /Eva intercepta a cifra/ }, { timeout: 10000 });
    await ready();
    for (let i = 0; i < 11; i++) next();
    expect(screen.getAllByText(/Bob aceita uma mensagem alterada/).length).toBeGreaterThan(0);
  }, 30000);

  it('nonce reutilizado: Eva lê um trecho da outra mensagem', async () => {
    await partB('Erro: nonce reutilizado');
    const table = await screen.findByRole('table', { name: /Trechos da mensagem 2/ }, { timeout: 10000 });
    expect(within(table).getByText(/posição real/)).toBeTruthy();
    expect(within(table).getByText('ESTA AO A')).toBeTruthy(); // trecho da mensagem 2 na posição de AMANHECER (byte 18, a partir de 0)
    expect(screen.getAllByText(/destruiu o sigilo/).length).toBeGreaterThan(0);
  }, 30000);

  it('valida o texto provável', async () => {
    await partB('Erro: nonce reutilizado');
    fireEvent.change(screen.getByLabelText(/Texto provável de Eva/), { target: { value: 'AB' } });
    expect((await screen.findAllByRole('alert')).some((a) => /ao menos 3/.test(a.textContent ?? ''))).toBe(true);
  }, 30000);

  it('não tem violações de acessibilidade', async () => {
    renderAt('/lab/chacha20');
    expect(await violations(document.body)).toEqual([]);
    cleanup();
    await partB();
    next();
    next();
    expect(await violations(document.body)).toEqual([]);
  }, 40000);
});
