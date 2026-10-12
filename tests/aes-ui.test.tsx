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

// Passo a passo: "Iniciar" abre a etapa 1; depois, "Próxima etapa" confirma cada avanço.
const next = () => fireEvent.click(screen.queryByRole('button', { name: 'Iniciar' }) ?? screen.getByRole('button', { name: /Próxima etapa/ }));

/** Lê a matriz de estado do AES e a devolve como hexadecimal na ordem por colunas (linha + 4 * coluna). */
const stateText = (label = 'Estado do AES') => {
  const rows = within(screen.getByLabelText(label)).getAllByRole('row');
  const out: string[] = new Array(16);
  rows.forEach((tr, r) =>
    within(tr)
      .getAllByRole('cell')
      .forEach((td, c) => {
        out[r + 4 * c] = (td.textContent ?? '').replace(' (alterado)', '').trim();
      }),
  );
  return out.join('');
};

const openDetail = async () => {
  await screen.findByRole('heading', { name: 'Estado inicial' });
  fireEvent.click(screen.getByRole('radio', { name: /Todas as operações/ }));
  await screen.findByText(/Cada operação do AES é uma etapa/);
};

const openPartB = async () => {
  await screen.findByRole('heading', { name: 'Estado inicial' });
  fireEvent.click(screen.getByRole('radio', { name: /Parte B/ }));
  await screen.findByText(/Estado inicial\. Pressione/);
};

describe('laboratório de AES e modos de operação', () => {
  it('Parte A, visão por rodada: 11 etapas, uma rodada por etapa, com o estado depois de cada operação (FIPS 197)', async () => {
    renderAt('/lab/aes');
    await screen.findByRole('heading', { name: 'Estado inicial' });
    expect(screen.getByText(/Etapa 0 de 11/)).toBeTruthy();
    expect(stateText('Estado: bloco de entrada')).toBe('00112233445566778899aabbccddeeff');
    next(); // rodada 0
    expect(screen.getByRole('heading', { name: /Etapa 1: Rodada 0/ })).toBeTruthy();
    expect(stateText('Estado: AddRoundKey')).toBe('00102030405060708090a0b0c0d0e0f0');
    next(); // rodada 1: as quatro operações aparecem de uma vez
    expect(stateText('Estado: SubBytes')).toBe('63cab7040953d051cd60e0e7ba70e18c');
    expect(stateText('Estado: ShiftRows')).toBe('6353e08c0960e104cd70b751bacad0e7');
    expect(stateText('Estado: MixColumns')).toBe('5f72641557f5bc92f7be3b291db9f91a');
    expect(stateText('Estado: AddRoundKey')).toBe('89d810e8855ace682d1843d8cb128fe4');
  });

  it('Parte A, visão por rodada: chega ao texto cifrado em 11 etapas; a rodada final não tem MixColumns', async () => {
    renderAt('/lab/aes');
    await screen.findByRole('heading', { name: 'Estado inicial' });
    for (let i = 0; i < 11; i++) next();
    expect(screen.getByRole('heading', { name: /Rodada 10 \(final, sem MixColumns\)/ })).toBeTruthy();
    expect(screen.queryByLabelText('Estado: MixColumns')).toBeNull();
    expect(stateText('Estado: AddRoundKey')).toBe('69c4e0d86a7b0430d8cdb78070b4c55a');
    expect(await screen.findByText(/Idêntico ao AES nativo/)).toBeTruthy();
  });

  it('Parte A: o botão de detalhamento abre a primeira operação da rodada na visão operação por operação', async () => {
    renderAt('/lab/aes');
    await screen.findByRole('heading', { name: 'Estado inicial' });
    next();
    next(); // rodada 1
    fireEvent.click(screen.getByRole('button', { name: /operações desta rodada uma a uma/ }));
    expect(await screen.findByRole('heading', { name: /Operação 2: Rodada 1: SubBytes/ })).toBeTruthy();
    expect(stateText()).toBe('63cab7040953d051cd60e0e7ba70e18c');
    next();
    expect(stateText()).toBe('6353e08c0960e104cd70b751bacad0e7');
    fireEvent.click(screen.getByRole('button', { name: /Voltar à visão por rodada/ }));
    expect(screen.getByRole('heading', { name: /Etapa 2: Rodada 1 de 10/ })).toBeTruthy();
  });

  it('Parte A, visão operação por operação: reproduz as primeiras operações do exemplo do FIPS 197, uma por etapa', async () => {
    renderAt('/lab/aes');
    await openDetail();
    expect(stateText()).toBe('00112233445566778899aabbccddeeff');
    next(); // AddRoundKey inicial
    expect(stateText()).toBe('00102030405060708090a0b0c0d0e0f0');
    next(); // SubBytes
    expect(stateText()).toBe('63cab7040953d051cd60e0e7ba70e18c');
    next(); // ShiftRows
    expect(stateText()).toBe('6353e08c0960e104cd70b751bacad0e7');
    next(); // MixColumns
    expect(stateText()).toBe('5f72641557f5bc92f7be3b291db9f91a');
    fireEvent.click(screen.getByRole('button', { name: /Etapa anterior/ }));
    expect(stateText()).toBe('6353e08c0960e104cd70b751bacad0e7');
  });

  it('Parte A, visão operação por operação: são 40 operações e o resultado confere com a Web Crypto', async () => {
    renderAt('/lab/aes');
    await openDetail();
    expect(screen.getByText(/Etapa 0 de 40/)).toBeTruthy();
    for (let i = 0; i < 40; i++) next(); // 1 AddRoundKey inicial + 9 rodadas de 4 operações + rodada final de 3
    expect(stateText()).toBe('69c4e0d86a7b0430d8cdb78070b4c55a');
    expect(await screen.findByText(/Idêntico ao AES nativo/)).toBeTruthy();
  });

  it('Parte A: nada avança sozinho', async () => {
    renderAt('/lab/aes');
    await screen.findByRole('heading', { name: 'Estado inicial' });
    expect((screen.getByLabelText('Execução automática (opcional)') as HTMLInputElement).checked).toBe(false);
    next();
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByText(/Etapa 1 de 11 · passo a passo/)).toBeTruthy();
  });

  it('Parte A: valida a chave hexadecimal', async () => {
    renderAt('/lab/aes');
    await screen.findByRole('heading', { name: 'Estado inicial' });
    fireEvent.change(screen.getByLabelText(/Chave AES-128/), { target: { value: 'xyz' } });
    expect((await screen.findAllByRole('alert')).some((a) => /32 dígitos hexadecimais/.test(a.textContent ?? ''))).toBe(true);
    expect(screen.getByText(/Corrija a chave e o bloco/)).toBeTruthy();
  });

  it('Parte B: o ECB mostra o vazamento de padrões, e Alice, Bob e Eva aparecem', async () => {
    renderAt('/lab/aes');
    await openPartB();
    expect(await screen.findByText(/blocos 1, 2 idênticos/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Painel de Alice' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Painel de Bob' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Painel de Eva' })).toBeTruthy();
  });

  it('Parte B: o GCM barra a adulteração de Eva', async () => {
    renderAt('/lab/aes');
    await openPartB();
    fireEvent.click(screen.getByRole('radio', { name: /GCM/ }));
    fireEvent.click(screen.getByLabelText(/Eva inverte 1 bit/));
    await screen.findByRole('button', { name: /Eva intercepta a cifra/ });
    await screen.findByText(/Estado inicial\. Pressione/);
    for (let i = 0; i < 9; i++) next();
    expect(screen.getAllByText(/Etiqueta de autenticação inválida/).length).toBeGreaterThan(0);
  });

  it('Parte B: no CTR, Eva altera exatamente um bit sem que Bob perceba', async () => {
    renderAt('/lab/aes');
    await openPartB();
    fireEvent.click(screen.getByRole('radio', { name: /^CTR$/ }));
    fireEvent.click(screen.getByLabelText(/Eva inverte 1 bit/));
    await screen.findByRole('button', { name: /Eva intercepta a cifra/ });
    expect((await screen.findAllByText(/um bit alterado/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/o CTR é maleável/).length).toBeGreaterThan(0);
  });

  it('Parte B: valida mensagem longa demais', async () => {
    renderAt('/lab/aes');
    await openPartB();
    fireEvent.change(screen.getByLabelText('Mensagem de Alice'), { target: { value: 'x'.repeat(200) } });
    expect((await screen.findAllByRole('alert')).some((a) => /máximo 160 bytes/.test(a.textContent ?? ''))).toBe(true);
    expect(screen.getByText(/Informe uma mensagem válida/)).toBeTruthy();
  });

  it('não tem violações de acessibilidade (partes A e B)', async () => {
    const { container } = renderAt('/lab/aes');
    await screen.findByRole('heading', { name: 'Estado inicial' });
    next();
    next();
    expect(await violations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /Todas as operações/ }));
    await screen.findByText(/Cada operação do AES é uma etapa/);
    next();
    expect(await violations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /Parte B/ }));
    await screen.findByText(/Estado inicial\. Pressione/);
    next();
    next();
    expect(await violations(container)).toEqual([]);
  });
});
