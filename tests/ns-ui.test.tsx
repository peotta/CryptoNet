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
  renderAt('/lab/needham-schroeder');
  if (partName) fireEvent.click(await screen.findByRole('radio', { name: partName }, { timeout: 15000 }));
  if (scenario) fireEvent.click(await screen.findByRole('radio', { name: scenario }));
  await ready();
};

describe('laboratório do Needham-Schroeder', () => {
  it('está na categoria Autenticação e marcado como Novo', () => {
    renderAt('/categoria/autenticacao');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: Needham-Schroeder e o ataque de Lowe/ })).toHaveLength(1);
    expect(screen.getAllByText('Novo').length).toBeGreaterThan(0);
  });

  it('mostra a explicação da parte escolhida', async () => {
    renderAt('/lab/needham-schroeder');
    expect((await screen.findAllByText(/^Parte A: o protocolo original$/, undefined, { timeout: 15000 })).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('radio', { name: /Parte B/ }));
    expect(screen.getAllByText(/^Parte B: o ataque de Lowe$/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/^Parte A: o protocolo original$/).filter((e) => !e.closest('[role="radiogroup"]') && !e.closest('label'))).toHaveLength(0);
  });

  it('Parte A: Alice e Bob se autenticam e Eva não conhece os nonces', async () => {
    await open();
    for (let i = 0; i < 10; i++) next();
    expect(screen.getAllByText(/Autenticação mútua concluída/).length).toBeGreaterThan(0);
    expect(screen.getByText('Eva conhece Na?').parentElement!.textContent).toMatch(/não$/);
    expect(screen.getByText('Eva conhece Nb?').parentElement!.textContent).toMatch(/não$/);
  }, 60000);

  it('Parte B: o ataque de Lowe tem êxito', async () => {
    await open(/Parte B/);
    for (let i = 0; i < 16; i++) next();
    expect(screen.getAllByText(/Ataque de Lowe bem-sucedido/).length).toBeGreaterThan(0);
    expect(screen.getByText('Eva conhece Nb?').parentElement!.textContent).toMatch(/sim$/);
    expect(screen.getByText('Resultado').parentElement!.textContent).toMatch(/ataque bem-sucedido/);
  }, 60000);

  it('Parte C: com a correção, Alice aborta diante do ataque', async () => {
    await open(/Parte C/, /O mesmo ataque, agora barrado/);
    for (let i = 0; i < 14; i++) next();
    expect(screen.getAllByText(/Ataque barrado/).length).toBeGreaterThan(0);
    expect(screen.getByText('Eva conhece Nb?').parentElement!.textContent).toMatch(/não$/);
    expect(screen.getAllByText('Conclusão de Alice').some((e) => /aborta/.test(e.parentElement!.textContent ?? ''))).toBe(true);
  }, 60000);

  it('Parte C: a comparação inclui o Kerberos', async () => {
    await open(/Parte C/);
    expect(screen.getByRole('table', { name: /Protocolos de autenticação da família Needham-Schroeder/ })).toBeTruthy();
    expect(screen.getAllByText(/Kerberos \(RFC 4120\)/).length).toBeGreaterThan(0);
  }, 30000);

  it('não tem violações de acessibilidade em nenhuma parte', async () => {
    await open();
    expect(await violations(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /Parte B/ }));
    await ready();
    next();
    expect(await violations(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /Parte C/ }));
    await ready();
    expect(await violations(document.body)).toEqual([]);
  }, 90000);
});
