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
// A criptoanálise leva algumas centenas de milissegundos; os testes esperam com folga.
const ready = () => screen.findByText(/Estado inicial\. Pressione/, undefined, { timeout: 15000 });
const open = async () => {
  renderAt('/lab/substituicao-frequencia');
  await ready();
};
// A mensagem padrão do laboratório é curta (80 letras) e Eva falha; a análise de frequência precisa de centenas de letras.
const LONG_TEXT =
  'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol, atravessar o vale em silêncio e esperar o sinal do comandante junto à ponte velha. Quem for visto pelos moradores deverá voltar imediatamente ao acampamento e aguardar novas ordens. Ninguém deve acender fogueiras durante a noite, porque a fumaça denunciaria a posição de todo o grupo ao inimigo que vigia a estrada principal. Se o plano der certo, ao meio dia a bandeira estará hasteada na torre mais alta.';
const percentOf = (text: string) => Number(/(\d+,\d)% corretas/.exec(text)![1].replace(',', '.'));

describe('laboratório de substituição simples e análise de frequência', () => {
  it('está disponível na categoria Clássica', () => {
    renderAt('/categoria/classica');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: Substituição simples e análise de frequência/ })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: Cifras de César e afim/ })).toHaveLength(1);
  });

  it('mostra a tabela da chave e a conta letra a letra', async () => {
    await open();
    const cells = within(screen.getByRole('table', { name: /Correspondência entre as letras/ })).getAllByRole('cell');
    expect(cells[0].textContent).toBe('A');
    expect(cells[26].textContent).toBe('Q'); // chave QWERTY...: A vira Q
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela primeira letra' }));
    // "Nós atacaremos..." começa com N (posição 13), e a posição 13 da chave QWERTY... é F
    expect(screen.getByText(/está na posição 13 do alfabeto/)).toBeTruthy();
    expect(screen.getByRole('group', { name: /Mensagem de Alice e saída/ }).textContent).toContain('NOSATF·'); // primeira letra cifrada, as demais pendentes
    fireEvent.click(screen.getByRole('button', { name: /Próxima letra/ }));
    expect(screen.getByText(/Letra 2 de/)).toBeTruthy();
  }, 30000);

  it('o índice de coincidência da cifra é igual ao do texto claro', async () => {
    await open();
    const value = (label: string) => screen.getAllByText(label).find((el) => el.tagName === 'DT')!.nextElementSibling!.textContent;
    expect(value('Texto cifrado')).toBe(value('Texto claro'));
    expect(Number(value('Texto claro')!.replace(',', '.'))).toBeGreaterThan(0.06);
  }, 30000);

  it('a análise de frequência acerta cerca de metade e o refinamento quase tudo', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Mensagem de Alice'), { target: { value: LONG_TEXT } });
    await waitFor(() => expect(percentOf(screen.getByText(/Depois do refinamento: .* corretas:/).textContent!)).toBeGreaterThan(90), { timeout: 20000 });
    const freq = percentOf(screen.getByText(/Só por frequência: .* corretas/).textContent!);
    const refined = percentOf(screen.getByText(/Depois do refinamento: .* corretas:/).textContent!);
    expect(freq).toBeGreaterThan(25);
    expect(freq).toBeLessThan(75);
    expect(refined).toBeGreaterThan(90);
    expect(screen.getByRole('table', { name: /8 letras mais frequentes/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Histograma de frequências/ })).toBeTruthy();
    expect(screen.getByText(/de 26 posições iguais/)).toBeTruthy();
  }, 30000);

  it('a animação passo a passo mostra Eva descobrindo a chave', async () => {
    await open();
    for (let i = 0; i < 4; i++) next(); // chave, mensagem, cifragem, trânsito
    expect(within(slot('eva', 'P0')).getByText('ainda não definido')).toBeTruthy();
    next(); // análise de frequência
    expect(within(slot('eva', 'P0')).queryByText('ainda não definido')).toBeNull();
    expect(within(slot('eva', 'K')).getByText('ainda não definido')).toBeTruthy();
    next(); // refinamento
    expect(within(slot('eva', 'K')).queryByText('ainda não definido')).toBeNull();
    for (let i = 0; i < 3; i++) next();
    expect(screen.getAllByText(/Eva recuperou/).length).toBeGreaterThan(0);
  }, 30000);

  it('valida a chave: tamanho e letras repetidas', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Chave \(permutação/), { target: { value: 'ABC' } });
    expect((await screen.findAllByRole('alert')).some((a) => /26 letras/.test(a.textContent ?? ''))).toBe(true);
    expect(screen.getByText(/Corrija os parâmetros/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Chave \(permutação/), { target: { value: 'A'.repeat(26) } });
    expect(screen.getAllByRole('alert').some((a) => /não pode repetir/.test(a.textContent ?? ''))).toBe(true);
  }, 30000);

  it('sorteia uma chave válida (26 letras distintas)', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /Sortear chave/ }));
    const input = screen.getByLabelText(/Chave \(permutação/) as HTMLInputElement;
    expect(input.value).toMatch(/^[A-Z]{26}$/);
    expect(new Set(input.value).size).toBe(26);
    expect(screen.queryAllByRole('alert').filter((a) => /26 letras|repetir/.test(a.textContent ?? ''))).toHaveLength(0);
  }, 30000);

  it('com Eva alterando a cifra, Bob não percebe', async () => {
    await open();
    fireEvent.click(screen.getByLabelText(/Eva altera uma letra/));
    await screen.findByRole('button', { name: /Eva intercepta a cifra/ }, { timeout: 15000 });
    await ready();
    for (let i = 0; i < 10; i++) next();
    expect(screen.getAllByText(/Bob decifrou a mensagem alterada sem perceber/).length).toBeGreaterThan(0);
  }, 40000);

  it('com texto curto, a criptoanálise de Eva não quebra a cifra por completo', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Mensagem de Alice'), { target: { value: 'Atacar ao amanhecer' } });
    await screen.findByText(/Letras na mensagem/, undefined, { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));
    const cell = (await screen.findByText(/Eva quebrou a cifra\?/, undefined, { timeout: 15000 })).nextElementSibling!.textContent!;
    expect(cell).not.toMatch(/quase todo o texto/);
  }, 40000);

  it('não tem violações de acessibilidade', async () => {
    renderAt('/lab/substituicao-frequencia');
    await ready();
    next();
    next();
    expect(await violations(document.body)).toEqual([]);
  }, 40000);
});
