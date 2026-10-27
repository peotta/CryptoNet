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
const ready = () => screen.findByText(/Estado inicial\. Pressione/, undefined, { timeout: 15000 });
const part = async (name: RegExp) => {
  renderAt('/lab/rc4');
  fireEvent.click(await screen.findByRole('radio', { name }, { timeout: 15000 }));
};
const partB = async (scenario?: RegExp) => {
  await part(/Parte B/);
  if (scenario) fireEvent.click(screen.getByRole('radio', { name: scenario }));
  await ready();
};

describe('laboratório de RC4 e do ataque ao WEP', () => {
  it('está na categoria Simétrica e marcado como Novo', () => {
    renderAt('/categoria/simetrica');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: RC4 e o ataque ao WEP/ })).toHaveLength(1);
    expect(screen.getAllByText('Novo').length).toBeGreaterThan(0);
  });

  it('Parte A: a primeira troca da KSA usa j = 0 + S[0] + K[0]', async () => {
    renderAt('/lab/rc4');
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar: primeira troca da KSA' }, { timeout: 15000 }));
    expect(screen.getByText(/KSA, passo 1 de 256 \(i = 0\): j = j \+ S\[i\] \+ K\[i mod 3\] = 0 \+ 0 \+ 75 = 75 mod 256 = 75/)).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Estado S depois do passo 1 da KSA' })).toBeTruthy();
  });

  it('Parte A: vai à etapa 272 e confere o fluxo da chave "Key" com o vetor conhecido', async () => {
    renderAt('/lab/rc4');
    await screen.findByRole('button', { name: 'Iniciar: primeira troca da KSA' }, { timeout: 15000 });
    fireEvent.change(screen.getByLabelText(/Ir para a etapa/), { target: { value: '272' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ir' }));
    expect(screen.getByText(/PRGA, byte 16 do fluxo/)).toBeTruthy();
    expect(screen.getByText(/Conferido com o vetor conhecido/)).toBeTruthy();
    expect(screen.getByText(/eb9f7781b734ca72a719/)).toBeTruthy();
  });

  it('Parte A: o vetor da RFC 6229', async () => {
    renderAt('/lab/rc4');
    fireEvent.click(await screen.findByRole('button', { name: /Usar o vetor da RFC 6229/ }, { timeout: 15000 }));
    await screen.findByRole('button', { name: 'Iniciar: primeira troca da KSA' });
    fireEvent.change(screen.getByLabelText(/Ir para a etapa/), { target: { value: '272' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ir' }));
    expect(screen.getByText(/b2396305f03dc027ccc3524a0a1118a8/)).toBeTruthy();
    expect(screen.getByText(/Conferido com o vetor conhecido/)).toBeTruthy();
  });

  it('valida a chave e a etapa', async () => {
    renderAt('/lab/rc4');
    fireEvent.change(await screen.findByLabelText(/Chave \(1 a 256 bytes em hexadecimal\)/, undefined, { timeout: 15000 }), { target: { value: 'xyz' } });
    expect(screen.getAllByRole('alert').some((a) => /dígitos hexadecimais/.test(a.textContent ?? ''))).toBe(true);
  });

  it('Parte B: Bob recupera a mensagem', async () => {
    await partB();
    for (let i = 0; i < 11; i++) next();
    const results = screen.getByRole('table', { name: 'Resultados da cifragem com RC4' });
    expect(within(results).getAllByText('PAGAR R$ 1000,00 PARA BOB').length).toBeGreaterThan(1);
  }, 60000);

  it('Parte B: Eva inverte um bit e Bob não percebe', async () => {
    await partB();
    fireEvent.click(screen.getByLabelText(/Eva inverte um bit da cifra/));
    await ready();
    const results = await screen.findByRole('table', { name: 'Resultados da cifragem com RC4' });
    expect(within(results).getByText(/Sim: um bit do byte 10, e Bob não percebeu/)).toBeTruthy();
  }, 60000);

  it('Parte B: o ataque FMS recupera a chave raiz do WEP', async () => {
    await partB(/WEP: Eva recupera a chave/);
    const results = await screen.findByRole('table', { name: 'Resultados do ataque FMS contra o WEP' }, { timeout: 15000 });
    const root = within(results).getByText('Chave raiz de Alice e Bob (40 bits)').parentElement!.textContent!.replace('Chave raiz de Alice e Bob (40 bits)', '');
    const got = within(results).getByText('Chave recuperada por Eva').parentElement!.textContent!.replace('Chave recuperada por Eva', '');
    expect(got).toBe(root);
    expect(within(results).getByText('Quadro lido por Eva').parentElement!.textContent).toContain('GET /saldo HTTP/1.1');
    const votes = screen.getByRole('table', { name: 'Votação byte a byte da chave raiz' });
    expect(within(votes).getAllByRole('row')).toHaveLength(6);
    for (let i = 0; i < 14; i++) next();
    expect(screen.getAllByText(/O WEP caiu/).length).toBeGreaterThan(0);
  }, 60000);

  it('Parte C: o segundo byte é enviesado e o descarte do início o corrige', async () => {
    await part(/Parte C/);
    const t = await screen.findByRole('table', { name: /Frequência do valor zero em cada posição/ }, { timeout: 20000 });
    const second = within(t).getByText('2º byte').closest('tr')!;
    expect(second.textContent).toMatch(/enviesado/);
    fireEvent.change(screen.getByLabelText('Início do fluxo'), { target: { value: '256' } });
    await waitFor(() => {
      const t2 = screen.getByRole('table', { name: /Frequência do valor zero em cada posição/ });
      expect(within(t2).getByText('2º byte').closest('tr')!.textContent).not.toMatch(/enviesado/);
    }, { timeout: 20000 });
  }, 90000);

  it('não tem violações de acessibilidade em nenhuma parte', async () => {
    renderAt('/lab/rc4');
    await screen.findByRole('button', { name: 'Iniciar: primeira troca da KSA' }, { timeout: 15000 });
    expect(await violations(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /Parte B/ }));
    await ready();
    next();
    expect(await violations(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /Parte C/ }));
    await screen.findByRole('table', { name: /Frequência do valor zero em cada posição/ }, { timeout: 20000 });
    expect(await violations(document.body)).toEqual([]);
  }, 90000);
});
