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
const open = async () => {
  renderAt('/lab/vigenere');
  await ready();
};
const icValue = (label: string) => Number(screen.getAllByText(label).find((el) => el.tagName === 'DT')!.nextElementSibling!.textContent!.replace(',', '.'));

describe('laboratório de Vigenère', () => {
  it('está disponível na categoria Clássica, ao lado dos anteriores', () => {
    renderAt('/categoria/classica');
    for (const t of ['Vigenère, Kasiski e índice de coincidência', 'Substituição simples e análise de frequência', 'Cifras de César e afim']) {
      expect(screen.getAllByRole('link', { name: new RegExp(`Abrir laboratório\\s*: ${t}`) })).toHaveLength(1);
    }
  });

  it('mostra a tabela de Vigenère e a conta letra a letra com linha e coluna destacadas', async () => {
    await open();
    const tabula = screen.getByRole('table', { name: 'Tabela de Vigenère' });
    expect(within(tabula).getAllByRole('row')).toHaveLength(27); // cabeçalho + 26 linhas
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela primeira letra' }));
    // "Nós..." começa com N (13) e a chave SEGREDO começa com S (18): (13 + 18) mod 26 = 31 mod 26 = 5 = F
    expect(screen.getByText(/C = \(13 \+ 18\) mod 26 = 31 mod 26 = 5/)).toBeTruthy();
    expect(screen.getByText(/Cifra até aqui: F/)).toBeTruthy();
    expect(screen.getByText(/Na linha S e coluna N está a letra F/, { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Próxima letra/ }));
    // a segunda letra (O = 14) usa a letra E da chave (4): 18 mod 26
    expect(screen.getByText(/C = \(14 \+ 4\) mod 26 = 18 mod 26 = 18/)).toBeTruthy();
  }, 30000);

  it('o IC do texto inteiro cai com a Vigenère', async () => {
    await open();
    expect(icValue('Texto cifrado')).toBeLessThan(icValue('Texto claro'));
    expect(icValue('Texto cifrado')).toBeLessThan(0.056);
  }, 30000);

  it('a criptoanálise mostra Kasiski, IC por tamanho e as letras da chave', async () => {
    await open();
    expect(screen.getByRole('table', { name: /sequências repetidas mais frequentes/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Quantas distâncias entre repetições/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Índice de coincidência médio das colunas/ })).toBeTruthy();
    expect(screen.getByText(/tamanho escolhido por Eva: m = 7/)).toBeTruthy();
    const table = screen.getByRole('table', { name: /Chave deduzida por Eva, coluna a coluna/ });
    expect(within(table).getAllByRole('row')).toHaveLength(8); // cabeçalho + 7 colunas
    expect(within(table).getAllByText('correta')).toHaveLength(7);
    expect(screen.getByText(/Texto deduzido por Eva: .* corretas/)).toBeTruthy();
  }, 30000);

  it('o histograma acompanha a coluna escolhida', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Ver o histograma da coluna'), { target: { value: '2' } });
    expect(screen.getByRole('img', { name: /coluna 3 da cifra/ })).toBeTruthy();
  }, 30000);

  it('a animação passo a passo mostra Eva descobrindo o tamanho e depois a chave', async () => {
    await open();
    for (let i = 0; i < 4; i++) next(); // chave, mensagem, cifragem, trânsito
    expect(within(slot('eva', 'L')).getByText('ainda não definido')).toBeTruthy();
    next(); // tamanho da chave
    expect(within(slot('eva', 'L')).getByText('m = 7')).toBeTruthy();
    expect(within(slot('eva', 'K')).getByText('ainda não definido')).toBeTruthy();
    next(); // chave
    expect(within(slot('eva', 'K')).getByText('SEGREDO')).toBeTruthy();
    for (let i = 0; i < 3; i++) next();
    expect(screen.getAllByText(/Eva descobriu o tamanho da chave \(m = 7\)/).length).toBeGreaterThan(0);
  }, 30000);

  it('valida a chave: vazia e longa demais', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Chave \(palavra/), { target: { value: '' } });
    expect((await screen.findAllByRole('alert')).some((a) => /ao menos uma letra/.test(a.textContent ?? ''))).toBe(true);
    expect(screen.getByText(/Corrija os parâmetros/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Chave \(palavra/), { target: { value: 'A'.repeat(21) } });
    expect(screen.getAllByRole('alert').some((a) => /no máximo 20/.test(a.textContent ?? ''))).toBe(true);
  }, 30000);

  it('sorteia uma chave de 6 letras e a criptoanálise a descobre', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /Sortear chave de 6 letras/ }));
    const input = screen.getByLabelText(/Chave \(palavra/) as HTMLInputElement;
    expect(input.value).toMatch(/^[A-Z]{6}$/);
    await screen.findByText(/tamanho escolhido por Eva: m = /, undefined, { timeout: 15000 });
  }, 30000);

  it('com Eva alterando a cifra, Bob não percebe', async () => {
    await open();
    fireEvent.click(screen.getByLabelText(/Eva altera uma letra/));
    await screen.findByRole('button', { name: /Eva intercepta a cifra/ }, { timeout: 15000 });
    await ready();
    for (let i = 0; i < 10; i++) next();
    expect(screen.getAllByText(/Bob decifrou a mensagem alterada sem perceber/).length).toBeGreaterThan(0);
  }, 40000);

  it('com chave longa e texto curto, Eva não quebra a cifra por completo', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Chave \(palavra/), { target: { value: 'CRIPTOGRAFIA' } });
    fireEvent.change(screen.getByLabelText('Mensagem de Alice'), { target: { value: 'Atacar ao amanhecer' } });
    await new Promise((r) => setTimeout(r, 1200));
    const cell = (await screen.findByText(/Eva quebrou a cifra\?/, undefined, { timeout: 15000 })).nextElementSibling!.textContent!;
    expect(cell).not.toMatch(/Sim: chave e mensagem/);
  }, 40000);

  it('não tem violações de acessibilidade', async () => {
    renderAt('/lab/vigenere');
    await ready();
    next();
    next();
    expect(await violations(document.body)).toEqual([]);
  }, 40000);
});
