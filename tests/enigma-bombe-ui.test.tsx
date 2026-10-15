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

const next = () => fireEvent.click(screen.queryByRole('button', { name: 'Iniciar' }) ?? screen.getByRole('button', { name: /Próxima etapa/ }));
// A Bombe leva cerca de 2 s; os testes esperam com folga.
const ready = () => screen.findByText(/Estado inicial\. Pressione/, undefined, { timeout: 30000 });
const open = async () => {
  renderAt('/lab/enigma-bombe');
  await ready();
};

describe('laboratório da Bombe (Enigma, fase 2)', () => {
  it('está disponível na categoria Clássica', () => {
    renderAt('/categoria/classica');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: Enigma, fase 2: a Bombe/ })).toHaveLength(1);
  });

  it('mostra o menu e o resultado: uma única parada e a chave do dia recuperada', async () => {
    await open();
    expect(screen.getByRole('img', { name: /Menu da Bombe com \d+ letras/ })).toBeTruthy();
    expect(screen.getByText(/sobraram 1 parada/)).toBeTruthy();
    expect(screen.getAllByText(/A Bombe eliminou 17\.575 das 17\.576 posições/).length).toBeGreaterThan(0);
    const results = screen.getByRole('table', { name: 'Resultados da Bombe' });
    expect(within(results).getByText('Posições escolhidas por Eva').nextElementSibling!.textContent).toBe('QDV');
    expect(within(results).getByText(/Sim: 100% do texto/)).toBeTruthy();
  }, 60000);

  it('a animação passo a passo traz a Bombe de Eva depois do menu', async () => {
    await open();
    for (let i = 0; i < 4; i++) next(); // chave, mensagem, cifragem, trânsito
    expect(screen.getByRole('button', { name: /Eva monta o menu/ })).toBeTruthy();
    next(); // menu
    next(); // Bombe
    expect(screen.getByRole('button', { name: /Eva roda a Bombe/ })).toBeTruthy();
    for (let i = 0; i < 5; i++) next();
    expect(screen.getAllByText(/A Bombe quebrou a chave do dia/).length).toBeGreaterThan(0);
  }, 60000);

  it('o inspetor mostra a contradição numa posição errada, uma dedução por vez', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar: aplicar a hipótese' }));
    expect(screen.getByText('Hipótese:', { selector: 'strong' })).toBeTruthy();
    for (let i = 0; i < 40 && !screen.queryByText(/Contradição:|Sem contradição:/); i++) {
      const btn = screen.getByRole('button', { name: /Próxima dedução/ });
      if ((btn as HTMLButtonElement).disabled) break;
      fireEvent.click(btn);
    }
    expect(screen.getByText(/Contradição: pela tecla/)).toBeTruthy(); // AAA não é a posição verdadeira
  }, 60000);

  it('o inspetor na posição verdadeira, com o plugue verdadeiro, termina sem contradição', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Posições iniciais dos rotores/), { target: { value: 'QDV' } });
    // o plugue verdadeiro da letra de teste: procura o valor que não leva a contradição
    const select = screen.getByLabelText(/está ligada no painel/) as HTMLSelectElement;
    let found = false;
    for (const opt of Array.from(select.options)) {
      fireEvent.change(select, { target: { value: opt.value } });
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar: aplicar a hipótese' }));
      for (let i = 0; i < 40; i++) {
        const btn = screen.getByRole('button', { name: /Próxima dedução/ }) as HTMLButtonElement;
        if (btn.disabled) break;
        fireEvent.click(btn);
      }
      if (screen.queryByText(/Sem contradição:/)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  }, 60000);

  it('valida as posições do inspetor e o texto provável', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Posições iniciais dos rotores/), { target: { value: 'A' } });
    expect(screen.getAllByRole('alert').some((a) => /exatamente 3 letras/.test(a.textContent ?? ''))).toBe(true);
    fireEvent.change(screen.getByLabelText(/Texto provável de Eva/), { target: { value: 'AB' } });
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => /ao menos 3 letras/.test(a.textContent ?? ''))).toBe(true), { timeout: 10000 });
  }, 60000);

  it('com o texto provável sem laços, as paradas falsas impedem a verificação', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Texto provável sem laços' }));
    fireEvent.change(screen.getByLabelText(/Posições iniciais do dia/), { target: { value: 'KLM' } });
    expect(await screen.findAllByText(/Paradas falsas demais/, undefined, { timeout: 30000 })).not.toHaveLength(0);
  }, 90000);

  it('não tem violações de acessibilidade', async () => {
    await open();
    next();
    next();
    expect(await violations(document.body)).toEqual([]);
  }, 60000);
});
