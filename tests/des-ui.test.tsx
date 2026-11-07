// @vitest-environment jsdom
import axe from 'axe-core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { engines } from '../src/crypto/local/des';
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
  renderAt('/lab/des');
  fireEvent.click(await screen.findByRole('radio', { name }, { timeout: 15000 }));
};
const partB = async (scenario?: RegExp) => {
  await part(/Parte B/);
  if (scenario) fireEvent.click(screen.getByRole('radio', { name: scenario }));
  await ready();
};

describe('laboratório de DES e Triple DES', () => {
  it('está na categoria Simétrica', () => {
    renderAt('/categoria/simetrica');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: DES e Triple DES/ })).toHaveLength(1);
  });

  it('A.1: a primeira subchave confere com o exemplo clássico', async () => {
    renderAt('/lab/des');
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar: aplicar a PC-1' }, { timeout: 15000 }));
    expect(screen.getByText(/PC-1 \(permuted choice 1\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Próxima subchave/ }));
    const t = screen.getByRole('table', { name: 'Subchave 1 de 16' });
    expect(within(t).getByText('000110 110000 001011 101111 111111 000111 000001 110010')).toBeTruthy();
  });

  it('A.2: as 16 rodadas terminam em 85E813540F0AB405 e o OpenSSL é citado', async () => {
    renderAt('/lab/des');
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar: permutação inicial' }, { timeout: 15000 }));
    for (let i = 0; i < 18; i++) fireEvent.click(screen.getAllByRole('button', { name: /Rodada 1 →|Próxima rodada →|Trocar as metades →|Permutação final →/ })[0]);
    const t = screen.getByRole('table', { name: 'Bloco cifrado' });
    expect(within(t).getByText('10000101 11101000 00010011 01010100 00001111 00001010 10110100 00000101')).toBeTruthy();
    expect(screen.getByText(/Conferido com o exemplo clássico e com o OpenSSL/)).toBeTruthy();
  });

  it('A.3: a função f mostra uma caixa S por vez', async () => {
    renderAt('/lab/des');
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar: expandir R' }, { timeout: 15000 }));
    for (let i = 0; i < 2; i++) fireEvent.click((await screen.findAllByRole('button', { name: /Próxima etapa →|Caixa S1 →/ }))[0]);
    expect(screen.getByText(/Caixa S1: os 6 bits de entrada 011000/)).toBeTruthy(); // linha 0, coluna 12: valor 5
    expect(screen.getByText(/vale 5, ou 0101 em 4 bits/)).toBeTruthy();
  });

  it('A.3: a caixa S mostra a matriz 4 por 16 com a célula consultada', async () => {
    renderAt('/lab/des');
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar: expandir R' }, { timeout: 15000 }));
    for (let i = 0; i < 2; i++) fireEvent.click((await screen.findAllByRole('button', { name: /Próxima etapa →|Caixa S1 →/ }))[0]);
    const t = screen.getAllByRole('table', { name: 'Tabela da caixa S1, 4 linhas por 16 colunas' })[0];
    expect(within(t).getAllByText(/célula consultada/)).toHaveLength(1);
    expect(screen.getByRole('group', { name: /48 bits de E\(R\) ⊕ K em oito blocos/ })).toBeTruthy();
    expect(screen.getByRole('group', { name: /saída de 32 bits das caixas S/ })).toBeTruthy();
  });

  it('A.4: alternar os bits muda a linha, a coluna e a saída', async () => {
    renderAt('/lab/des');
    await screen.findByText(/A\.4 Caixas S em detalhe/, undefined, { timeout: 15000 });
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /^Entrada [01]{6}:/.test(el.textContent ?? '')).textContent).toContain('011011');
    fireEvent.click(screen.getByRole('button', { name: /Bit 1 \(linha\) vale 0/ }));
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /^Entrada [01]{6}:/.test(el.textContent ?? '')).textContent).toContain('111011');
    expect(screen.getAllByRole('table', { name: /Tabela da caixa S1/ }).length).toBeGreaterThan(0);
  });

  it('mostra a explicação da parte escolhida', async () => {
    renderAt('/lab/des');
    expect(await screen.findByText(/^Parte A: o DES por dentro$/, undefined, { timeout: 15000 })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Parte B/ }));
    expect(screen.getByText(/^Parte B: o DES em uso$/)).toBeTruthy();
    expect(screen.queryByText(/^Parte A: o DES por dentro$/)).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /Parte C/ }));
    expect(screen.getByText(/^Parte C: propriedades do DES$/)).toBeTruthy();
  }, 30000);

  it('valida a chave', async () => {
    renderAt('/lab/des');
    fireEvent.change(await screen.findByLabelText(/Chave \(8 bytes em hexadecimal\)/, undefined, { timeout: 15000 }), { target: { value: 'xyz' } });
    expect(screen.getAllByRole('alert').some((a) => /16 dígitos hexadecimais/.test(a.textContent ?? ''))).toBe(true);
  });

  it('Parte B: DES em CBC, Bob recupera a mensagem', async () => {
    await partB();
    for (let i = 0; i < 10; i++) next();
    const results = screen.getByRole('table', { name: 'Resultados da cifragem com DES em CBC' });
    expect(within(results).getAllByText('PAGAR R$ 1000,00 PARA BOB E CONFIRMAR').length).toBeGreaterThan(1);
  }, 60000);

  it('Parte B: Eva inverte um bit e o bloco seguinte recebe o mesmo bit invertido', async () => {
    await partB();
    fireEvent.click(screen.getByLabelText(/Eva inverte um bit da cifra/));
    await screen.findByRole('button', { name: /Eva inverte um bit do bloco cifrado 2/ }, { timeout: 15000 }).catch(() => undefined);
    await ready();
    const diffs = await screen.findByRole('table', { name: /Bits diferentes \(de 64\)/ });
    const rows = within(diffs).getAllByRole('row').slice(1);
    expect(within(rows[1]).getByText(/destruído/)).toBeTruthy();
    expect(within(rows[2]).getByText(/o mesmo bit que Eva inverteu/)).toBeTruthy();
    expect(within(rows[2]).getAllByRole('cell')[1].textContent).toBe('1');
  }, 60000);

  it('Parte B: a busca exaustiva acha a chave e projeta o tempo da chave inteira', async () => {
    await partB(/Eva testa todas as chaves/);
    fireEvent.change(screen.getByLabelText(/Bits da chave desconhecidos por Eva/), { target: { value: '8' } });
    await waitFor(() => expect(screen.getByRole('table', { name: 'Resultados da busca exaustiva contra o DES' })).toBeTruthy(), { timeout: 15000 });
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Resultados da busca exaustiva contra o DES' })).getByText(/2\^8 = 256 chaves/)).toBeTruthy(), { timeout: 15000 });
    const results = screen.getByRole('table', { name: 'Resultados da busca exaustiva contra o DES' });
    const key = within(results).getByText('Chave de Alice').parentElement!.textContent!.replace('Chave de Alice', '');
    const found = within(results).getByText('Chave encontrada por Eva').parentElement!.textContent!.replace('Chave encontrada por Eva', '');
    expect(found).toBe(key);
    expect(screen.getByText(/Projeção para a chave inteira de 56 bits/)).toBeTruthy();
    expect(screen.getByText(/mais de 240\.000\.000\.000/)).toBeTruthy();
  }, 60000);

  it('Parte B: com uma só chave, o Triple DES equivale ao DES', async () => {
    await partB(/Triple DES \(EDE\)/);
    fireEvent.change(screen.getByLabelText(/Opção de chaves/), { target: { value: 'igual' } });
    await waitFor(() => {
      const t = screen.getByRole('table', { name: 'Resultados da cifragem com Triple DES' });
      expect(within(t).getByText('Igual ao DES simples com K1?').parentElement!.textContent).toMatch(/Sim/);
    }, { timeout: 15000 });
  }, 60000);

  it('Parte C: avalanche, complemento e chaves fracas', async () => {
    await part(/Parte C/);
    const av = await screen.findByRole('table', { name: /Bits diferentes entre as duas execuções/ });
    expect(within(av).getByText('Rodada 16')).toBeTruthy();
    expect(within(av).getByText('Saída (depois da FP)')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Sim, para qualquer K e P')).toBeTruthy());
    const weak = await screen.findByRole('table', { name: /chave fraca ou semifraca/ });
    expect(within(weak).getByText(/Sim: a segunda cifragem desfaz a primeira/)).toBeTruthy();
    expect(within(weak).getByText('Subchaves distintas (de 16)').parentElement!.textContent).toMatch(/1$/);
  }, 60000);

  it('Parte C: as chaves fracas são calculadas uma vez por escolha, sem laço de renderização', async () => {
    const spy = vi.spyOn(engines.des, 'keySchedule');
    await part(/Parte C/);
    await screen.findByRole('table', { name: /chave fraca ou semifraca/ });
    await new Promise((r) => setTimeout(r, 500));
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2);
    spy.mockRestore();
  }, 60000);

  it('não tem violações de acessibilidade em nenhuma parte', async () => {
    renderAt('/lab/des');
    await screen.findByRole('button', { name: 'Iniciar: aplicar a PC-1' }, { timeout: 15000 });
    expect(await violations(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /Parte B/ }));
    await ready();
    next();
    expect(await violations(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /Parte C/ }));
    await screen.findByRole('table', { name: /Bits diferentes entre as duas execuções/ });
    expect(await violations(document.body)).toEqual([]);
  }, 90000);
});
