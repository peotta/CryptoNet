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

const slot = (party: string, key: string) => screen.getByTestId(`slot-${party}-${key}`);
const next = () => fireEvent.click(screen.queryByRole('button', { name: 'Iniciar' }) ?? screen.getByRole('button', { name: /Próxima etapa/ }));
const ready = () => screen.findByText(/Estado inicial\. Pressione/, undefined, { timeout: 15000 });
const icValue = (label: string) => Number(screen.getAllByText(label).find((el) => el.tagName === 'DT')!.nextElementSibling!.textContent!.replace(',', '.'));
const openHill = async () => {
  renderAt('/lab/playfair-hill');
  await ready();
  fireEvent.click(screen.getByRole('radio', { name: 'Hill (matrizes)' }));
  await screen.findByText(/Estado inicial\. Pressione/, undefined, { timeout: 15000 });
};

describe('laboratório de Playfair e Hill', () => {
  it('está disponível na categoria Clássica', () => {
    renderAt('/categoria/classica');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: Playfair e Hill/ })).toHaveLength(1);
  });

  it('Playfair: mostra a grade 5 × 5 e a regra aplicada a cada digrafo', async () => {
    renderAt('/lab/playfair-hill');
    await ready();
    const grid = screen.getByRole('table', { name: 'Grade 5 por 5 do Playfair' });
    expect(within(grid).getAllByRole('row')).toHaveLength(5);
    expect(within(grid).getAllByRole('cell')[0].textContent).toBe('M'); // MONARQUIA: a grade começa por M
    fireEvent.click(screen.getByRole('button', { name: 'Começar pelo primeiro digrafo' }));
    // "Nós ..." começa com NO: N e O na mesma linha (M O N A R), cada letra vai para a direita: AN
    expect(screen.getByText(/Digrafo 1 de/)).toBeTruthy();
    expect(screen.getByText(/regra:/).textContent).toMatch(/NO.*regra: linha.*AN/);
    expect(screen.getByText(/Cifra até aqui: AN/)).toBeTruthy();
    // as letras de entrada e de saída ficam marcadas na grade, para quem usa leitor de tela
    expect(within(grid).getAllByText(/\(entrada\)/).length).toBeGreaterThan(0);
    expect(within(grid).getAllByText(/\(saída\)/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Próximo digrafo/ }));
    expect(screen.getByText(/Digrafo 2 de/)).toBeTruthy();
  }, 30000);

  it('Playfair: o IC da cifra cai e Eva vê estatísticas de digrafos, mas não lê a mensagem', async () => {
    renderAt('/lab/playfair-hill');
    await ready();
    expect(icValue('Texto cifrado')).toBeLessThan(icValue('Texto claro'));
    expect(screen.getByRole('table', { name: /Digrafos mais frequentes na cifra/ })).toBeTruthy();
    expect(screen.getByRole('table', { name: /Digrafos mais frequentes no texto claro/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Histograma de frequências/ })).toBeTruthy();
    expect(screen.getByText(/só teve sucesso com cerca de 700 letras/)).toBeTruthy(); // honestidade sobre o ataque
    for (let i = 0; i < 5; i++) next(); // chave, digrafos, cifragem, trânsito, estatísticas de Eva
    expect(within(slot('eva', 'S')).getByText(/IC = /)).toBeTruthy();
    for (let i = 0; i < 3; i++) next();
    expect(screen.getAllByText(/não é seguro/).length).toBeGreaterThan(0);
  }, 30000);

  it('Playfair: com Eva alterando a cifra, Bob não percebe', async () => {
    renderAt('/lab/playfair-hill');
    await ready();
    fireEvent.click(screen.getByLabelText(/Eva altera uma letra/));
    await screen.findByRole('button', { name: /Eva intercepta a cifra/ }, { timeout: 15000 });
    await ready();
    for (let i = 0; i < 9; i++) next();
    expect(screen.getAllByText(/Bob decifrou a mensagem alterada sem perceber/).length).toBeGreaterThan(0);
  }, 40000);

  it('Playfair: valida a palavra-chave', async () => {
    renderAt('/lab/playfair-hill');
    await ready();
    fireEvent.change(screen.getByLabelText('Palavra-chave (1 a 25 letras)'), { target: { value: '123' } });
    expect((await screen.findAllByRole('alert')).some((a) => /palavra-chave/.test(a.textContent ?? ''))).toBe(true);
  }, 30000);

  it('Hill: mostra as matrizes K e K⁻¹ e a multiplicação linha por linha', async () => {
    await openHill();
    expect(screen.getByRole('table', { name: 'Matriz-chave K' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Inversa da matriz-chave' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Começar pelo primeiro bloco' }));
    // primeiro bloco AT = (0, 19), K = [[3, 3], [2, 5]]: linha 1 = 3·0 + 3·19 = 57 e 57 mod 26 = 5 (F); linha 2 = 95 mod 26 = 17 (R)
    const line = (re: RegExp) => screen.getByText((_, el) => el?.tagName === 'LI' && re.test(el.textContent ?? ''));
    expect(line(/linha 1: 3·0 \+ 3·19 = 57; 57 mod 26 = 5 → F/)).toBeTruthy();
    expect(line(/linha 2: 2·0 \+ 5·19 = 95; 95 mod 26 = 17 → R/)).toBeTruthy();
    expect(screen.getByText(/Cifra até aqui: FR/)).toBeTruthy();
  }, 30000);

  it('Hill: Eva resolve a chave exata com texto claro conhecido', async () => {
    await openHill();
    expect(screen.getByRole('table', { name: 'Chave deduzida por Eva' })).toBeTruthy();
    expect(screen.getByText(/A chave de Eva é idêntica à de Alice e Bob: \[3 3; 2 5\]/)).toBeTruthy();
    for (let i = 0; i < 4; i++) next(); // chave, mensagem, cifragem, trânsito
    expect(within(slot('eva', 'K')).getByText('ainda não definido')).toBeTruthy();
    next(); // ataque de texto claro conhecido
    expect(within(slot('eva', 'K')).getByText('[3 3; 2 5]')).toBeTruthy();
    for (let i = 0; i < 3; i++) next();
    expect(screen.getAllByText(/K = C · P⁻¹/).length).toBeGreaterThan(0);
  }, 40000);

  it('Hill: com poucas letras conhecidas, o ataque falha e o motivo é explicado', async () => {
    await openHill();
    fireEvent.change(screen.getByLabelText('Letras do início da mensagem que Eva conhece'), { target: { value: '2' } });
    expect(await screen.findByText(/Eva conhece só 2 letras/, undefined, { timeout: 15000 })).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Chave deduzida por Eva' })).toBeNull();
  }, 40000);

  it('Hill: rejeita matriz não inversível e valores fora de 0 a 25', async () => {
    await openHill();
    fireEvent.change(screen.getByLabelText('Elemento da linha 2, coluna 1'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Elemento da linha 2, coluna 2'), { target: { value: '2' } });
    // [[3, 3], [2, 2]] tem determinante 0
    expect((await screen.findAllByRole('alert')).some((a) => /não é inversível módulo 26/.test(a.textContent ?? ''))).toBe(true);
    expect(screen.getByText(/Corrija os parâmetros/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Elemento da linha 1, coluna 1'), { target: { value: '99' } });
    expect(screen.getAllByRole('alert').some((a) => /entre 0 e 25/.test(a.textContent ?? ''))).toBe(true);
  }, 40000);

  it('Hill: o botão sorteia uma matriz inversível e a troca para 3 × 3 mostra 9 campos', async () => {
    await openHill();
    fireEvent.click(screen.getByRole('button', { name: /Sortear matriz inversível/ }));
    expect(screen.queryAllByRole('alert').filter((a) => /inversível/.test(a.textContent ?? ''))).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Tamanho da matriz-chave'), { target: { value: '3' } });
    expect(await screen.findByLabelText('Elemento da linha 3, coluna 3')).toBeTruthy();
    expect(screen.getAllByLabelText(/Elemento da linha/)).toHaveLength(9);
    expect(await screen.findByRole('table', { name: 'Matriz-chave K' }, { timeout: 15000 })).toBeTruthy();
  }, 40000);

  it('não tem violações de acessibilidade (Playfair e Hill)', async () => {
    const { container } = renderAt('/lab/playfair-hill');
    await ready();
    next();
    next();
    expect(await violations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: 'Hill (matrizes)' }));
    await screen.findByRole('table', { name: 'Matriz-chave K' }, { timeout: 15000 });
    await ready();
    next();
    expect(await violations(container)).toEqual([]);
  }, 60000);
});
