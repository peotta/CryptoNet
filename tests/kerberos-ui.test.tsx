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
const open = async (scenario?: RegExp) => {
  renderAt('/lab/kerberos');
  if (scenario) fireEvent.click(await screen.findByRole('radio', { name: scenario }, { timeout: 15000 }));
  await ready();
  if (scenario) await new Promise((r) => setTimeout(r, 200));
};

describe('laboratório de Kerberos', () => {
  it('está na categoria Autenticação', () => {
    renderAt('/categoria/autenticacao');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: Kerberos/ })).toHaveLength(1);
  });

  it('mostra os quatro participantes e a troca normal chega ao veredito, sem avançar sozinha', async () => {
    await open();
    for (const nome of ['Alice', 'KDC', 'Eva', 'Bob']) expect(screen.getAllByText(nome).length).toBeGreaterThan(0);
    expect(screen.getByText(/Eva só viu texto cifrado/).textContent).toMatch(/pendente/);
    for (let i = 0; i < 9; i++) next();
    expect(screen.getAllByText(/Eva só viu texto cifrado/).some((e) => !/pendente/.test(e.textContent ?? ''))).toBe(true);
  }, 60000);

  it('repetição com registro de autenticadores é barrada', async () => {
    await open(/Repetição do autenticador/);
    fireEvent.click(screen.getByRole('checkbox', { name: /guarda os autenticadores/ }));
    await ready();
    await new Promise((r) => setTimeout(r, 200));
    for (let i = 0; i < 11; i++) next();
    expect(screen.getAllByText(/A repetição foi barrada/).length).toBeGreaterThan(0);
  }, 60000);

  it('adivinhar a senha sem pré-autenticação encontra a senha fraca', async () => {
    await open(/Adivinhar a senha/);
    for (let i = 0; i < 7; i++) next();
    expect(screen.getAllByText(/Eva descobriu a senha de Alice/).length).toBeGreaterThan(0);
  }, 60000);

  it('não tem violações de acessibilidade', async () => {
    const { container } = renderAt('/lab/kerberos');
    await ready();
    expect(await violations(container)).toEqual([]);
  }, 60000);
});
