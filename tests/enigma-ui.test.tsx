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
  renderAt('/lab/enigma');
  await ready();
};
/** Configuração de verificação: rotores I-II-III, refletor B, posições e anéis AAA, sem plugues. */
const verification = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Configuração de verificação/ }));
  await screen.findByText(/Estado inicial\. Pressione/, undefined, { timeout: 15000 });
};
const row = (label: string) => screen.getByText(label, { selector: 'th' }).nextElementSibling!.textContent!;

describe('laboratório da Máquina Enigma', () => {
  it('está disponível na categoria Clássica', () => {
    renderAt('/categoria/classica');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: Máquina Enigma/ })).toHaveLength(1);
  });

  it('a configuração de verificação cifra AAAAA como BDZGO', async () => {
    await open();
    await verification();
    fireEvent.change(screen.getByLabelText('Mensagem de Alice'), { target: { value: 'AAAAA' } });
    fireEvent.change(screen.getByLabelText(/Texto provável de Eva/), { target: { value: 'AAA' } });
    await screen.findByText('BDZGO', { selector: 'td' }, { timeout: 15000 });
    expect(row('Texto cifrado')).toBe('BDZGO');
    expect(row('Mensagem recuperada por Bob')).toBe('AAAAA');
  }, 40000);

  it('mostra o caminho do sinal em dez estágios, com o teclado e a lâmpada', async () => {
    await open();
    await verification();
    fireEvent.change(screen.getByLabelText('Mensagem de Alice'), { target: { value: 'AAAAA' } });
    fireEvent.change(screen.getByLabelText(/Texto provável de Eva/), { target: { value: 'AAA' } });
    await screen.findByText('BDZGO', { selector: 'td' }, { timeout: 15000 });
    expect(screen.getByText(/Pressione uma tecla/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela primeira tecla' }));
    expect(screen.getByText(/Tecla 1 de 5/)).toBeTruthy();
    const path = screen.getByRole('list', { name: 'Caminho do sinal da tecla A' });
    expect(within(path).getAllByRole('listitem')).toHaveLength(10);
    expect(within(path).getByText('Refletor')).toBeTruthy();
    expect(screen.getByText(/\(tecla pressionada\)/)).toBeTruthy();
    expect(screen.getByText(/\(lâmpada acesa\)/)).toBeTruthy();
    expect(screen.getByText(/Cifra até aqui: B/)).toBeTruthy();
    expect(screen.getAllByText(/Rotores:/)[0].textContent).toMatch(/AAA.*AAB/);
  }, 40000);

  it('mostra o passo duplo do rotor do meio (ADU → ADV → AEW → BFX → BFY)', async () => {
    await open();
    await verification();
    fireEvent.change(screen.getByLabelText(/Posições iniciais/), { target: { value: 'ADU' } });
    fireEvent.change(screen.getByLabelText('Mensagem de Alice'), { target: { value: 'AAAAA' } });
    fireEvent.change(screen.getByLabelText(/Texto provável de Eva/), { target: { value: 'AAA' } });
    await screen.findByText(/Posições finais dos rotores/, undefined, { timeout: 15000 });
    expect(row('Posições finais dos rotores')).toBe('BFZ'); // após 5 teclas: ADV, AEW, BFX, BFY, BFZ
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela primeira tecla' }));
    fireEvent.click(screen.getByRole('button', { name: /Próxima tecla/ })); // AEW
    expect(screen.getByText(/o rotor do meio avançou/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Próxima tecla/ })); // BFX
    expect(screen.getByText(/o rotor esquerdo avançou/)).toBeTruthy();
    expect(screen.getByText(/o rotor esquerdo avançou.*o rotor do meio avançou/)).toBeTruthy();
  }, 40000);

  it('Eva elimina alinhamentos do texto provável, e a posição real nunca é descartada', async () => {
    await open();
    const table = screen.getByRole('table', { name: /Alinhamentos do texto provável com a cifra/ });
    const rows = within(table).getAllByRole('row');
    const tr = rows.slice(1);
    expect(tr.some((r) => /impossível/.test(r.textContent ?? ''))).toBe(true);
    expect(within(tr[0]).getByText('possível')).toBeTruthy(); // posição 1: a real (RELATORIO está no início)
    expect(within(tr[0]).getByText(/posição real/)).toBeTruthy();
    expect(screen.getByText(/alinhamentos descartados; restam/)).toBeTruthy();
  }, 40000);

  it('mostra o espaço de chaves e a estimativa de tempo', async () => {
    await open();
    expect(screen.getAllByText('158.962.555.217.826.360.000').length).toBeGreaterThan(0);
    expect(screen.getByText('150.738.274.937.250')).toBeTruthy();
    expect(screen.getByText(/5\.0\d\d anos/)).toBeTruthy(); // cerca de 5 mil anos a 1 bilhão de chaves por segundo
  }, 40000);

  it('a animação passo a passo mostra Eva reduzindo as hipóteses', async () => {
    await open();
    for (let i = 0; i < 4; i++) next(); // configuração, mensagem, cifragem, trânsito
    expect(within(slot('eva', 'S')).getByText('ainda não definido')).toBeTruthy();
    next(); // texto provável
    expect(within(slot('eva', 'S')).getByText(/de \d+ possíveis/)).toBeTruthy();
    for (let i = 0; i < 3; i++) next();
    expect(screen.getAllByText(/não inclui a Bombe/).length).toBeGreaterThan(0);
  }, 40000);

  it('valida rotores repetidos, plugues inválidos, posições e texto provável', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Rotor do meio'), { target: { value: 'I' } });
    expect((await screen.findAllByRole('alert')).some((a) => /diferentes entre si/.test(a.textContent ?? ''))).toBe(true);
    expect(screen.getByText(/Corrija os parâmetros/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Rotor do meio'), { target: { value: 'II' } });
    fireEvent.change(screen.getByLabelText(/Painel de plugues/), { target: { value: 'AB AC' } });
    expect((await screen.findAllByRole('alert')).some((a) => /mais de um par/.test(a.textContent ?? ''))).toBe(true);
    fireEvent.change(screen.getByLabelText(/Painel de plugues/), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/Posições iniciais/), { target: { value: 'AB' } });
    expect((await screen.findAllByRole('alert')).some((a) => /3 letras/.test(a.textContent ?? ''))).toBe(true);
    fireEvent.change(screen.getByLabelText(/Posições iniciais/), { target: { value: 'KLM' } });
    fireEvent.change(screen.getByLabelText(/Texto provável de Eva/), { target: { value: 'AB' } });
    expect((await screen.findAllByRole('alert', undefined, { timeout: 15000 })).some((a) => /ao menos 3 letras/.test(a.textContent ?? ''))).toBe(true);
  }, 60000);

  it('sorteia uma configuração válida', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /Sortear configuração do dia/ }));
    expect((screen.getByLabelText(/Posições iniciais/) as HTMLInputElement).value).toMatch(/^[A-Z]{3}$/);
    const plugs = (screen.getByLabelText(/Painel de plugues/) as HTMLInputElement).value.split(' ');
    expect(plugs).toHaveLength(10);
    expect(new Set(plugs.join('')).size).toBe(20); // 20 letras distintas
    expect(screen.queryAllByRole('alert').filter((a) => /diferentes|plugues|letras/.test(a.textContent ?? ''))).toHaveLength(0);
    await ready();
  }, 40000);

  it('com Eva alterando a cifra, Bob não percebe', async () => {
    await open();
    fireEvent.click(screen.getByLabelText(/Eva altera uma letra/));
    await screen.findByRole('button', { name: /Eva intercepta a cifra/ }, { timeout: 15000 });
    await ready();
    for (let i = 0; i < 9; i++) next();
    expect(screen.getAllByText(/Bob decifrou a mensagem alterada sem perceber/).length).toBeGreaterThan(0);
  }, 40000);

  it('não tem violações de acessibilidade', async () => {
    renderAt('/lab/enigma');
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela primeira tecla' }));
    next();
    next();
    expect(await violations(document.body)).toEqual([]);
  }, 60000);
});
