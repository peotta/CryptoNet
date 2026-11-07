// @vitest-environment jsdom
import axe from 'axe-core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
const ready = () => screen.findByText(/Estado inicial\. Pressione/, undefined, { timeout: 15000 });
const open = async (partName?: RegExp, scenario?: RegExp) => {
  renderAt('/lab/totp-hotp');
  if (partName) fireEvent.click(await screen.findByRole('radio', { name: partName }, { timeout: 15000 }));
  if (scenario) fireEvent.click(await screen.findByRole('radio', { name: scenario }));
  await ready();
};

describe('laboratório de HOTP e TOTP', () => {
  it('está na categoria Autenticação e marcado como Novo', () => {
    renderAt('/categoria/autenticacao');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: HOTP e TOTP/ })).toHaveLength(1);
    expect(screen.getAllByText('Novo').length).toBeGreaterThan(0);
  });

  it('Parte A: o código do contador 0 é 755224 e nada avança sozinho', async () => {
    await open();
    expect(screen.queryByText(/Autenticação aceita/)).toBeNull();
    for (let i = 0; i < 9; i++) next();
    expect(screen.getAllByText(/Autenticação aceita/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Código \(6 dígitos\)/).parentElement!.textContent).toMatch(/755224$/);
  }, 60000);

  it('Parte A: confere os 16 vetores das RFCs', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /Conferir os vetores/ }));
    expect(await screen.findByText(/Os 16 vetores conferem/)).toBeTruthy();
  }, 60000);

  it('Parte A: muda para TOTP e mostra o tempo Unix', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /TOTP/ }));
    expect(await screen.findByLabelText(/Tempo Unix T/)).toBeTruthy();
  });

  it('Parte B: código vencido, repetição, phishing e força bruta chegam a um veredito', async () => {
    await open(/Parte B/);
    for (let i = 0; i < 7; i++) next();
    expect(screen.getAllByText(/O código vencido não serve a Eva/).length).toBeGreaterThan(0);
    cleanup();

    await open(/Parte B/, /Repetição do código/);
    fireEvent.click(screen.getByRole('checkbox', { name: /registra o último contador/ }));
    await ready();
    await new Promise((r) => setTimeout(r, 200)); // o cenário é recalculado de forma assíncrona após a mudança
    for (let i = 0; i < 7; i++) next();
    expect(screen.getAllByText(/A repetição foi barrada/).length).toBeGreaterThan(0);
    cleanup();

    await open(/Parte B/, /Phishing em tempo real/);
    for (let i = 0; i < 6; i++) next();
    expect(screen.getAllByText(/O TOTP não impediu o phishing/).length).toBeGreaterThan(0);
  }, 90000);

  it('não tem violações de acessibilidade nas duas partes', async () => {
    const { container } = renderAt('/lab/totp-hotp');
    await ready();
    expect(await violations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /Parte B/ }));
    await ready();
    expect(await violations(container)).toEqual([]);
  }, 60000);
});
