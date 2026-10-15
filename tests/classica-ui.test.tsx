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
const ready = () => screen.findByText(/Estado inicial\. Pressione/);

describe('aba Criptografia Clássica', () => {
  it('aparece na página inicial, no menu e tem sua própria categoria', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Clássica' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Criptografia Clássica' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Criptografia Simétrica' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Criptografia Assimétrica e Acordo de Chaves' })).toBeTruthy();
  });
  it('a categoria lista o laboratório disponível e os futuros, separados das outras categorias', () => {
    renderAt('/categoria/classica');
    expect(screen.getByRole('heading', { level: 1, name: 'Criptografia Clássica' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: Cifras de César e afim/ })).toHaveLength(1);
    for (const t of ['Vigenère, Kasiski e índice de coincidência', 'Playfair e Hill', 'Máquina Enigma', 'One-time pad']) {
      expect(screen.getByRole('heading', { name: t })).toBeTruthy();
    }
    expect(screen.queryByRole('heading', { name: 'RSA' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'AES e modos de operação' })).toBeNull();
  });
});

describe('laboratório de César e cifra afim', () => {
  it('César: o disco de cifra e a conta letra a letra', async () => {
    renderAt('/lab/cesar-afim');
    await ready();
    expect(screen.getByRole('img', { name: /Disco de cifra com deslocamento 3/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela primeira letra' }));
    // "Nós atacaremos..." normalizado começa com N = 13; C = (13 + 3) mod 26 = 16 = Q
    expect(screen.getByText(/C = \(13 \+ 3\) mod 26 = 16 mod 26 = 16/)).toBeTruthy();
    expect(screen.getByText(/Cifra até aqui: Q/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Próxima letra/ }));
    expect(screen.getByText(/Letra 2 de/)).toBeTruthy();
    expect(screen.getByText(/Cifra até aqui: QR/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Letra anterior/ }));
    expect(screen.getByText(/Letra 1 de/)).toBeTruthy();
  });

  it('César: o disco acompanha a chave digitada e a tira mostra o mapeamento', async () => {
    renderAt('/lab/cesar-afim');
    await ready();
    fireEvent.change(screen.getByLabelText('Deslocamento k'), { target: { value: '13' } });
    expect(await screen.findByRole('img', { name: /deslocamento 13: a letra A do texto claro corresponde a N/ })).toBeTruthy();
    const cells = within(screen.getByRole('table', { name: /Correspondência entre as letras/ })).getAllByRole('cell');
    expect(cells[0].textContent).toBe('A');
    expect(cells[26].textContent).toBe('N'); // A vira N com k = 13
  });

  it('César: a animação passo a passo mostra Eva deduzindo a chave', async () => {
    renderAt('/lab/cesar-afim');
    await ready();
    for (let i = 0; i < 4; i++) next(); // chave, mensagem, cifragem, trânsito
    expect(screen.getAllByTestId('transit-message')).toHaveLength(1);
    expect(within(slot('eva', 'K')).getByText('ainda não definido')).toBeTruthy();
    next(); // Eva faz a força bruta
    expect(within(slot('eva', 'K')).getByText('k = 3')).toBeTruthy();
    for (let i = 0; i < 3; i++) next();
    expect(screen.getAllByText(/Eva deduziu a chave \(k = 3\)/).length).toBeGreaterThan(0); // descrição e veredito
    expect(within(slot('bob', 'mrec')).getByText(/NOSAT/)).toBeTruthy();
  });

  it('César: a criptoanálise mostra as 26 chaves, o histograma e a chave mais provável', async () => {
    renderAt('/lab/cesar-afim');
    await ready();
    const table = screen.getByRole('table', { name: /Todas as 26 chaves testadas por Eva/ });
    expect(within(table).getAllByRole('row')).toHaveLength(27); // cabeçalho + 26 chaves
    expect(within(table).getByText(/menor: chave mais provável/)).toBeTruthy();
    expect(within(table).getByText(/chave real de Alice e Bob/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /Histograma de frequências/ })).toBeTruthy();
  });

  it('César: valida o deslocamento', async () => {
    renderAt('/lab/cesar-afim');
    await ready();
    fireEvent.change(screen.getByLabelText('Deslocamento k'), { target: { value: '30' } });
    expect((await screen.findAllByRole('alert')).some((a) => /entre 0 e 25/.test(a.textContent ?? ''))).toBe(true);
    expect(screen.getByText(/Corrija os parâmetros/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Deslocamento k'), { target: { value: 'x' } });
    expect(screen.getAllByRole('alert').some((a) => /inteiro/.test(a.textContent ?? ''))).toBe(true);
  });

  it('César: mensagem sem letras é rejeitada', async () => {
    renderAt('/lab/cesar-afim');
    await ready();
    fireEvent.change(screen.getByLabelText('Mensagem de Alice'), { target: { value: '123 !!!' } });
    expect((await screen.findAllByRole('alert')).some((a) => /ao menos uma letra/.test(a.textContent ?? ''))).toBe(true);
  });

  it('César: com Eva alterando a cifra, Bob não percebe', async () => {
    renderAt('/lab/cesar-afim');
    await ready();
    fireEvent.click(screen.getByLabelText(/Eva altera uma letra/));
    await screen.findByRole('button', { name: /Eva intercepta a cifra/ });
    await ready();
    for (let i = 0; i < 9; i++) next();
    expect(screen.getAllByText(/Bob decifrou a mensagem alterada sem perceber/).length).toBeGreaterThan(0);
  });

  it('afim: oferece só os 12 valores válidos de a e testa 312 chaves', async () => {
    renderAt('/lab/cesar-afim');
    await ready();
    fireEvent.click(screen.getByRole('radio', { name: 'Cifra afim' }));
    const select = (await screen.findByLabelText('Multiplicador a')) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['1', '3', '5', '7', '9', '11', '15', '17', '19', '21', '23', '25']);
    await ready();
    expect(screen.getByRole('table', { name: /8 chaves mais prováveis entre as 312/ })).toBeTruthy();
    expect(screen.queryByRole('img', { name: /Disco de cifra/ })).toBeNull(); // o disco é só do César
    expect(screen.getByText(/312 chaves possíveis/)).toBeTruthy();
  });

  it('afim: a conta letra a letra usa a e b', async () => {
    renderAt('/lab/cesar-afim');
    await ready();
    fireEvent.click(screen.getByRole('radio', { name: 'Cifra afim' }));
    await screen.findByLabelText('Multiplicador a');
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela primeira letra' }));
    // a = 5, b = 8, N = 13: (5 · 13 + 8) = 73 mod 26 = 21 = V
    expect(screen.getByText(/C = \(5 · 13 \+ 8\) mod 26 = 73 mod 26 = 21/)).toBeTruthy();
    expect(screen.getByText(/Cifra até aqui: V/)).toBeTruthy();
  });

  it('afim: valida b e Eva encontra a chave', async () => {
    renderAt('/lab/cesar-afim');
    await ready();
    fireEvent.click(screen.getByRole('radio', { name: 'Cifra afim' }));
    await screen.findByLabelText('Multiplicador a');
    await ready();
    for (let i = 0; i < 5; i++) next();
    expect(within(slot('eva', 'K')).getByText('a = 5, b = 8')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Deslocamento b'), { target: { value: '99' } });
    expect((await screen.findAllByRole('alert')).some((a) => /entre 0 e 25/.test(a.textContent ?? ''))).toBe(true);
  });

  it('não tem violações de acessibilidade (César e afim)', async () => {
    const { container } = renderAt('/lab/cesar-afim');
    await ready();
    next();
    next();
    expect(await violations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: 'Cifra afim' }));
    await screen.findByLabelText('Multiplicador a');
    await ready();
    expect(await violations(container)).toEqual([]);
  });
});
