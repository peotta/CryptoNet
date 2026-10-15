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
const ready = () => screen.findByText(/Estado inicial\. Pressione/, undefined, { timeout: 15000 });
const open = async (tab?: string) => {
  renderAt('/lab/transposicao');
  if (tab) fireEvent.click(screen.getByRole('radio', { name: tab }));
  await ready();
};

describe('laboratório de transposição e cifra produto', () => {
  it('está disponível na categoria Clássica', () => {
    renderAt('/categoria/classica');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: Transposição e cifra produto/ })).toHaveLength(1);
  });

  it('cerca de trilhos: mostra o zigue-zague letra a letra', async () => {
    await open();
    expect(screen.getByRole('table', { name: /zigue-zague sobre 4 trilhos/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela primeira letra' }));
    expect(screen.getByText(/Letra 1 de .*vai para o trilho 1/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Próxima letra/ }));
    expect(screen.getByText(/Letra 2 de .*vai para o trilho 2/)).toBeTruthy();
  }, 30000);

  it('Eva reconhece a transposição e quebra a cerca de trilhos', async () => {
    await open();
    expect(screen.getByText(/é uma transposição/)).toBeTruthy();
    expect(screen.getByRole('table', { name: /para cada número de trilhos/ })).toBeTruthy();
    expect(screen.getAllByText(/Eva recuperou 100%/).length).toBeGreaterThan(0);
  }, 30000);

  it('a animação passo a passo traz Eva depois da transmissão', async () => {
    await open();
    for (let i = 0; i < 4; i++) next(); // chave, mensagem, cifragem, trânsito
    expect(screen.getByRole('button', { name: /Eva examina a estatística/ })).toBeTruthy();
    for (let i = 0; i < 6; i++) next();
    expect(screen.getAllByText(/Eva reconheceu a transposição/).length).toBeGreaterThan(0);
  }, 30000);

  it('valida o número de trilhos', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Número de trilhos/), { target: { value: '1' } });
    expect((await screen.findAllByRole('alert')).some((a) => /pelo menos 2 trilhos/.test(a.textContent ?? ''))).toBe(true);
    expect(screen.getByText(/Corrija os parâmetros/)).toBeTruthy();
  }, 30000);

  it('transposição colunar: a grade é lida coluna a coluna na ordem da chave', async () => {
    await open('Transposição colunar');
    fireEvent.change(screen.getByLabelText(/Palavra-chave da transposição/), { target: { value: 'LUA' } });
    await screen.findByRole('columnheader', { name: 'U' }, { timeout: 15000 }); // a grade já usa a nova chave
    await new Promise((r) => setTimeout(r, 500));
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela primeira coluna' }));
    expect(screen.getByText(/Coluna 3 \(letra A\) é lida em 1º lugar/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Próxima coluna/ }));
    expect(screen.getByText(/Coluna 1 \(letra L\) é lida em 2º lugar/)).toBeTruthy();
  }, 40000);

  it('com mais de 8 colunas, Eva não tenta a busca exaustiva', async () => {
    await open('Transposição colunar');
    fireEvent.change(screen.getByLabelText(/Palavra-chave da transposição/), { target: { value: 'ABCDEFGHIJ' } });
    expect(await screen.findByText(/Eva não tenta a busca exaustiva/, undefined, { timeout: 15000 })).toBeTruthy();
  }, 40000);

  it('cifra produto: os ataques isolados falham e a tabela os compara', async () => {
    await open('Cifra produto');
    const table = await screen.findByRole('table', { name: /ataques isolados|Letras do texto claro recuperadas/ }, { timeout: 30000 });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(screen.getAllByText(/Painvin/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Sortear chave de substituição (aleatório seguro)' })).toBeTruthy();
  }, 60000);

  it('com Eva alterando a cifra, Bob não percebe', async () => {
    await open();
    fireEvent.click(screen.getByLabelText(/Eva altera uma letra/));
    await screen.findByRole('button', { name: /Eva intercepta a cifra/ }, { timeout: 15000 });
    await ready();
    for (let i = 0; i < 10; i++) next();
    expect(screen.getAllByText(/Bob decifrou a mensagem alterada sem perceber/).length).toBeGreaterThan(0);
  }, 40000);

  it('não tem violações de acessibilidade', async () => {
    await open();
    next();
    next();
    expect(await violations(document.body)).toEqual([]);
  }, 40000);
});
