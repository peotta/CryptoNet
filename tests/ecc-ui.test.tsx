// @vitest-environment jsdom
import axe from 'axe-core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const slot = (party: string, key: string) => screen.getByTestId(`slot-${party}-${key}`);
const next = () => fireEvent.click(screen.queryByRole('button', { name: 'Iniciar' }) ?? screen.getByRole('button', { name: /Próxima etapa/ }));
const ready = () => screen.findByText(/Estado inicial\. Pressione/, undefined, { timeout: 15000 });
const open = async (part?: RegExp) => {
  renderAt('/lab/ecdh-assinaturas');
  if (part) {
    fireEvent.click(await screen.findByRole('radio', { name: part }, { timeout: 10000 }));
    await ready();
  } else {
    await screen.findByRole('radio', { name: /A: a curva/ }, { timeout: 10000 });
  }
};

describe('laboratório de curvas elípticas (ECDH, ECDSA e Ed25519)', () => {
  it('está disponível na categoria Assimétrica', () => {
    renderAt('/categoria/assimetrica');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: ECDH, ECDSA e Ed25519/ })).toHaveLength(1);
  });

  it('Parte A: tabela do grupo com 2G = (6, 3) e o ponto no infinito', async () => {
    await open();
    const t = screen.getByRole('table', { name: /Os 19 elementos do grupo/ });
    expect(within(t).getAllByRole('row')).toHaveLength(20);
    expect(within(t).getByText('(6, 3)')).toBeTruthy();
    expect(within(t).getByText('O (infinito)')).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /Pontos da curva/ }).length).toBeGreaterThan(0);
  });

  it('Parte A: a soma de pontos avança uma conta por vez até R', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/P = k · G/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Q = k · G/), { target: { value: '1' } }); // dobro de G
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar: primeira conta' }));
    expect(screen.getByText(/Dobro: inclinação da tangente/)).toBeTruthy();
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /Próxima conta/ }));
    expect(screen.getByText(/Resultado: R = \(6, 3\)/)).toBeTruthy();
    expect(screen.getByText(/P \+ Q = \(6, 3\)/)).toBeTruthy();
  });

  it('Parte A: soma com oposto dá o ponto no infinito', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/P = k · G/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Q = k · G/), { target: { value: '18' } }); // 18G = -G
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar: primeira conta' }));
    expect(screen.getByText(/Q = −P/)).toBeTruthy();
    expect(screen.getByText(/P \+ Q = O \(infinito\)/)).toBeTruthy();
  });

  it('Parte A: dobrar e somar mostra uma operação por vez e termina em 13·G = (16, 4)', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar: primeiro bit' }));
    expect(screen.getByText(/Bit 1 de 4 \(1\): dobrar/)).toBeTruthy();
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: /Próxima operação/ }));
    expect(screen.getByText(/13 · G = \(16, 4\)/)).toBeTruthy();
  });

  it('Parte A: valida os escalares', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Escalar k/), { target: { value: '0' } });
    expect(screen.getAllByRole('alert').some((a) => /1 a 200/.test(a.textContent ?? ''))).toBe(true);
    fireEvent.change(screen.getByLabelText(/P = k · G/), { target: { value: 'x' } });
    expect(screen.getAllByRole('alert').some((a) => /1 a 19/.test(a.textContent ?? ''))).toBe(true);
  });

  it('Parte B: Eva só tem as chaves públicas até o passo do logaritmo discreto', async () => {
    await open(/B: ECDH/);
    for (let i = 0; i < 4; i++) next(); // parâmetros, chaves de Alice e Bob, envio de A
    expect(within(slot('eva', 'd')).getByText('ainda não definido')).toBeTruthy();
    for (let i = 0; i < 4; i++) next(); // envio de B, segredo de Alice e de Bob, ...
    next(); // Eva procura
    expect(within(slot('eva', 'd')).queryByText('ainda não definido')).toBeNull();
    next();
    next();
    expect(screen.getAllByText(/rho de Pollard/).length).toBeGreaterThan(0);
    expect(within(slot('eva', 'S')).getByText(/\(\d+, \d+\)/)).toBeTruthy();
  }, 40000);

  it('Parte B: valida as chaves privadas', async () => {
    await open(/B: ECDH/);
    fireEvent.change(screen.getByLabelText(/Chave privada de Alice a/), { target: { value: '19' } });
    expect(screen.getAllByRole('alert').some((a) => /1 a 18/.test(a.textContent ?? ''))).toBe(true);
    expect(await screen.findByText(/Corrija os parâmetros/, undefined, { timeout: 5000 })).toBeTruthy();
  }, 30000);

  it('Parte C: uso correto, e a alteração de Eva é detectada', async () => {
    await open(/C: ECDSA/);
    fireEvent.click(screen.getByLabelText(/Eva altera a mensagem/));
    await screen.findByRole('button', { name: /Eva altera a mensagem em trânsito/ }, { timeout: 15000 });
    await ready();
    for (let i = 0; i < 6; i++) next();
    expect(within(slot('bob', 'ok')).getByText('rejeitada')).toBeTruthy();
    expect(screen.getAllByText(/A alteração foi detectada/).length).toBeGreaterThan(0);
  }, 40000);

  it('Parte C: com o nonce reutilizado, Eva recupera a chave e forja uma assinatura aceita', async () => {
    await open(/C: ECDSA/);
    fireEvent.click(screen.getByLabelText(/reutiliza o mesmo nonce/));
    await screen.findByRole('button', { name: /Alice assina a mensagem 2 com o MESMO k/ }, { timeout: 15000 });
    await ready();
    for (let i = 0; i < 12; i++) next();
    expect(within(slot('eva', 'd')).getByText('7')).toBeTruthy();
    expect(within(slot('bob', 'ok')).getByText(/aceita \(forjada!\)/)).toBeTruthy();
    expect(screen.getAllByText(/PlayStation 3/).length).toBeGreaterThan(0);
    const results = screen.getByRole('table', { name: 'Resultados do ECDSA didático' });
    expect(within(results).getByText(/k = 9, d = 7/)).toBeTruthy();
  }, 40000);

  it('Parte C: mensagens com o mesmo hash reduzido são recusadas', async () => {
    await open(/C: ECDSA/);
    fireEvent.click(screen.getByLabelText(/reutiliza o mesmo nonce/));
    fireEvent.change(screen.getByLabelText('Mensagem 2'), { target: { value: 'PAGAR R$ 100 A BOB' } });
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => /mesmo hash reduzido/.test(a.textContent ?? ''))).toBe(true), { timeout: 10000 });
  }, 30000);

  it('Parte D: ECDSA P-256 aceita; com Eva alterando um bit, rejeita', async () => {
    await open(/D: ECDSA P-256/);
    const results = () => screen.getByRole('table', { name: 'Resultados da assinatura real' });
    expect(within(results()).getByText('assinatura válida')).toBeTruthy();
    expect(within(results()).getByText(/Não: o nonce aleatório muda a assinatura/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Eva inverte um bit/));
    await waitFor(() => expect(within(results()).getByText('assinatura inválida')).toBeTruthy(), { timeout: 10000 });
    expect(screen.getByRole('table', { name: /Comparação entre os dois algoritmos/ })).toBeTruthy();
  }, 40000);

  it('Parte D: Ed25519 é determinístico', async () => {
    await open(/D: ECDSA P-256/);
    fireEvent.click(screen.getByRole('radio', { name: 'Ed25519' }));
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Resultados da assinatura real' })).getByText(/Sim: assinatura determinística/)).toBeTruthy(), { timeout: 10000 });
  }, 40000);

  it('não tem violações de acessibilidade em nenhuma parte', async () => {
    await open();
    expect(await violations(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /C: ECDSA/ }));
    await ready();
    next();
    expect(await violations(document.body)).toEqual([]);
  }, 60000);
});
