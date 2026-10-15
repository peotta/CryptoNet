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
  renderAt('/lab/otp');
  await ready();
};
const openReuse = async () => {
  await open();
  fireEvent.click(screen.getByRole('radio', { name: /reutilização da chave/ }));
  await screen.findByLabelText('Mensagem 1 de Alice');
  await ready();
};
const dd = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling!.textContent!;
const row = (label: string) => screen.getByText(label, { selector: 'th' }).nextElementSibling!.textContent!;

describe('laboratório do one-time pad: uso correto', () => {
  it('está disponível na categoria Clássica', () => {
    renderAt('/categoria/classica');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: One-time pad/ })).toHaveLength(1);
  });

  it('mostra a mensagem, a chave e a cifra alinhadas, e a soma letra a letra', async () => {
    await open();
    const table = screen.getByRole('table', { name: /Texto claro, chave e cifra, alinhados por posição/ });
    expect(within(table).getAllByRole('row')).toHaveLength(4); // cabeçalho + 3 linhas
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela primeira letra' }));
    // a primeira letra de "Atacar..." é A (0): C = (0 + k) mod 26 = k, e a letra cifrada é a própria letra da chave
    expect(screen.getByText(/C = \(0 \+ \d+\) mod 26 = \d+ mod 26 = \d+/)).toBeTruthy();
    const cifra = /Cifra até aqui: ([A-Z])/.exec(document.body.textContent ?? '')![1];
    const chave = /K = ([A-Z]) \(/.exec(document.body.textContent ?? '')![1];
    expect(cifra).toBe(chave);
    fireEvent.click(screen.getByRole('button', { name: /Próxima letra/ }));
    expect(screen.getByText(/Letra 2 de/)).toBeTruthy();
  }, 40000);

  it('sigilo perfeito: para o candidato de Eva existe uma chave, e a chave verdadeira volta ao texto verdadeiro', async () => {
    await open();
    expect(dd('Verificação: decifrar C com K′')).toMatch(/^RECUARPARAAESTACAOCENTRALAOANOITECERS/);
    fireEvent.click(screen.getByRole('button', { name: /Usar a mensagem verdadeira como candidato/ }));
    // a verificação é recalculada de forma assíncrona: espera aparecer o texto verdadeiro
    await screen.findByText('ATACARAPONTEAOAMANHECERSEMAVISARNINGUEM', { selector: 'dd' }, { timeout: 15000 });
    // com o candidato verdadeiro, K′ coincide com a chave verdadeira (que Eva não tem como identificar)
    expect(dd('Chave K′ que levaria a cifra a esse candidato')).toBe(dd('A chave verdadeira de Alice e Bob (Eva não a vê)'));
  }, 40000);

  it('o candidato precisa ter o mesmo tamanho da mensagem', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Texto candidato de Eva/), { target: { value: 'CURTO' } });
    expect((await screen.findAllByRole('alert')).some((a) => /exatamente 39 letras/.test(a.textContent ?? ''))).toBe(true);
    // a seção de Eva continua na tela, e o estudante pode corrigir o campo
    expect(screen.getByLabelText(/Texto candidato de Eva/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Usar o candidato padrão/ }));
    expect(screen.queryAllByRole('alert').filter((a) => /exatamente/.test(a.textContent ?? ''))).toHaveLength(0);
  }, 40000);

  it('rejeita uma chave curta, explicando que repeti-la vira Vigenère', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Chave \(pad\): \d+ letras/), { target: { value: 'ABC' } });
    const alert = (await screen.findAllByRole('alert')).map((a) => a.textContent ?? '').join(' ');
    expect(alert).toMatch(/tão longa quanto a mensagem/);
    expect(alert).toMatch(/Vigenère/);
    expect(screen.getByText(/Corrija os parâmetros/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Sortear chave do tamanho da mensagem/ }));
    expect((screen.getByLabelText(/Chave \(pad\): \d+ letras/) as HTMLInputElement).value).toMatch(/^[A-Z]{39}$/);
    await ready();
  }, 40000);

  it('a cifra parece sorteada: IC perto do aleatório', async () => {
    await open();
    expect(Number(dd('Texto cifrado').replace(',', '.'))).toBeLessThan(0.07);
    expect(screen.getByRole('img', { name: /Histograma de frequências/ })).toBeTruthy();
  }, 40000);

  it('a animação passo a passo mostra a hipótese de Eva e o sigilo perfeito', async () => {
    await open();
    for (let i = 0; i < 4; i++) next(); // chave, mensagem, cifragem, trânsito
    expect(within(slot('eva', 'T')).getByText('ainda não definido')).toBeTruthy();
    next(); // hipótese
    expect(within(slot('eva', 'T')).queryByText('ainda não definido')).toBeNull();
    expect(within(slot('eva', 'K2')).queryByText('ainda não definido')).toBeNull();
    for (let i = 0; i < 3; i++) next();
    expect(screen.getAllByText(/sigilo perfeito/).length).toBeGreaterThan(0);
  }, 40000);

  it('com Eva alterando a cifra, Bob decifra a letra escolhida, sem erro (maleabilidade)', async () => {
    await open();
    fireEvent.click(screen.getByLabelText(/Eva altera uma letra/));
    await screen.findByRole('button', { name: /Eva intercepta a cifra/ }, { timeout: 15000 });
    expect(await screen.findByText(/sem conhecer a chave, e Bob decifrou/)).toBeTruthy();
    await ready();
    for (let i = 0; i < 9; i++) next();
    expect(screen.getAllByText(/maleabilidade/).length).toBeGreaterThan(0);
  }, 40000);

  it('não tem violações de acessibilidade', async () => {
    renderAt('/lab/otp');
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela primeira letra' }));
    next();
    next();
    expect(await violations(document.body)).toEqual([]);
  }, 60000);
});

describe('laboratório do one-time pad: reutilização da chave', () => {
  it('mostra as duas mensagens com a mesma chave e a posição a posição', async () => {
    await openReuse();
    const table = screen.getByRole('table', { name: /As duas mensagens, a mesma chave e as duas cifras/ });
    expect(within(table).getAllByRole('row')).toHaveLength(6); // cabeçalho + 5 linhas
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela primeira posição' }));
    expect(screen.getByText(/é usada nas duas mensagens/)).toBeTruthy();
    expect(screen.getByText(/Mensagem 1: P =/)).toBeTruthy();
    expect(screen.getByText(/Mensagem 2: P =/)).toBeTruthy();
  }, 40000);

  it('a chave desaparece: as duas linhas de diferença são idênticas', async () => {
    await openReuse();
    expect(screen.getByText(/As duas linhas são idênticas/)).toBeTruthy();
    expect(screen.getByRole('table', { name: /A diferença das cifras \(calculada por Eva\)/ })).toBeTruthy();
  }, 40000);

  it('o arrasto coloca a posição real em 1º lugar e revela o fragmento da outra mensagem', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /reutilização da chave/ }));
    await screen.findByLabelText('Mensagem 1 de Alice');
    const table = await screen.findByRole('table', { name: /As 8 posições de trecho mais legível/ }, { timeout: 15000 });
    expect(within(table).getAllByRole('row')).toHaveLength(9); // cabeçalho + 8
    expect(screen.getByText(/ficou em 1º lugar/)).toBeTruthy();
    const first = within(table).getAllByRole('row')[1];
    expect(first.textContent).toMatch(/mais legível \(escolha de Eva\); posição real/);
    // o fragmento da mensagem 2 na posição de AMANHECER (26): "OAMANHECERS..." na mensagem 2 vira texto legível
    expect(first.textContent).toMatch(/ROFESSORE/);
  }, 40000);

  it('um texto provável ausente não gera alinhamento legível', async () => {
    await openReuse();
    fireEvent.change(screen.getByLabelText(/Texto provável de Eva/), { target: { value: 'ZZZZZZ' } });
    expect(await screen.findByText(/O texto provável não está na mensagem 1/, undefined, { timeout: 15000 })).toBeTruthy();
  }, 40000);

  it('funciona com o texto provável na mensagem 2', async () => {
    await openReuse();
    fireEvent.click(screen.getByRole('radio', { name: 'Mensagem 2' }));
    fireEvent.change(screen.getByLabelText(/Texto provável de Eva/), { target: { value: 'PROFESSORES' } });
    expect(await screen.findByText(/ficou em 1º lugar/, undefined, { timeout: 15000 })).toBeTruthy();
  }, 40000);

  it('rejeita chave curta e texto provável curto', async () => {
    await openReuse();
    fireEvent.change(screen.getByLabelText(/Chave \(pad\) usada nas DUAS mensagens/), { target: { value: 'ABC' } });
    expect((await screen.findAllByRole('alert')).some((a) => /tão longa quanto a mensagem/.test(a.textContent ?? ''))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Sortear chave do tamanho da maior mensagem/ }));
    await ready();
    fireEvent.change(screen.getByLabelText(/Texto provável de Eva/), { target: { value: 'QUE' } });
    expect((await screen.findAllByRole('alert', undefined, { timeout: 15000 })).some((a) => /ao menos 4 letras/.test(a.textContent ?? ''))).toBe(true);
  }, 40000);

  it('a animação passo a passo mostra Eva subtraindo as cifras e arrastando o texto provável', async () => {
    await openReuse();
    for (let i = 0; i < 7; i++) next(); // chave, mensagens, 2 cifragens, 2 transmissões, subtração
    expect(within(slot('eva', 'D')).queryByText('ainda não definido')).toBeNull();
    expect(within(slot('eva', 'kfrag')).getByText('ainda não definido')).toBeTruthy();
    next(); // arrasto
    expect(within(slot('eva', 'kfrag')).queryByText('ainda não definido')).toBeNull();
    for (let i = 0; i < 4; i++) next();
    expect(screen.getAllByText(/projeto Venona/).length).toBeGreaterThan(0);
    expect(row('Eva quebrou o sigilo?')).toMatch(/^Sim/);
  }, 60000);

  it('não tem violações de acessibilidade', async () => {
    await openReuse();
    next();
    next();
    expect(await violations(document.body)).toEqual([]);
  }, 60000);

  it('o texto de cada cenário não vaza informações do outro: o uso correto não mostra o arrasto', async () => {
    await open();
    expect(screen.queryByText(/Arrasto do texto provável/)).toBeNull();
    expect(screen.queryByRole('table', { name: /As 8 posições de trecho mais legível/ })).toBeNull();
  }, 40000);
});
