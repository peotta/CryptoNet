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

// color-contrast depende de layout real e não é avaliável no jsdom; as cores foram escolhidas com contraste AA.
async function violations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

const slot = (party: string, key: string) => screen.getByTestId(`slot-${party}-${key}`);
const next = () => fireEvent.click(screen.getByRole('button', { name: /Próxima etapa/ }));

describe('página inicial e categorias', () => {
  it('mostra título, subtítulo e laboratórios', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: 'CryptoNet Lab' })).toBeTruthy();
    expect(screen.getByText('Laboratório Virtual de Criptografia e Protocolos Seguros')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: RSA/ }).length).toBe(1);
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: Diffie-Hellman/ }).length).toBe(1);
    expect(screen.getByText('Laboratórios futuros')).toBeTruthy();
  });
  it('não tem violações de acessibilidade', async () => {
    const { container } = renderAt('/');
    expect(await violations(container)).toEqual([]);
  });
  it('separa as categorias simétrica e assimétrica', () => {
    renderAt('/categoria/simetrica');
    expect(screen.getByRole('heading', { level: 1, name: 'Criptografia Simétrica' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'AES' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'RSA' })).toBeNull();
    cleanup();
    renderAt('/categoria/assimetrica');
    expect(screen.getByRole('heading', { name: 'RSA' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Diffie-Hellman' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'AES' })).toBeNull();
  });
  it('rotas inexistentes exibem página de erro', () => {
    renderAt('/lab/nao-existe');
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeTruthy();
  });
});

describe('laboratório Diffie-Hellman', () => {
  it('avança, retrocede e reinicia reconstruindo o estado correto', async () => {
    renderAt('/lab/diffie-hellman');
    await screen.findByRole('heading', { level: 1, name: /Diffie-Hellman/ });
    await screen.findByText(/Estado inicial/);

    expect(within(slot('alice', 'A')).getByText('ainda não definido')).toBeTruthy();
    next(); // 1 parâmetros
    next(); // 2 segredos
    expect(within(slot('alice', 'a')).getByText('6')).toBeTruthy();
    expect(within(slot('bob', 'b')).getByText('15')).toBeTruthy();
    next(); // 3 valores públicos
    expect(within(slot('alice', 'A')).getByText('8')).toBeTruthy();
    expect(within(slot('bob', 'B')).getByText('19')).toBeTruthy();
    next(); // 4 troca
    expect(screen.getAllByTestId('transit-message')).toHaveLength(2);
    expect(within(slot('bob', 'Arec')).getByText('8')).toBeTruthy();
    expect(within(slot('alice', 'Brec')).getByText('19')).toBeTruthy();
    next(); // 5 segredo
    expect(within(slot('alice', 'K')).getByText('2')).toBeTruthy();
    expect(within(slot('bob', 'K')).getByText('2')).toBeTruthy();
    next(); // 6 comparação
    expect(screen.getByText(/Segredo compartilhado estabelecido com sucesso/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Etapa anterior/ })); // volta à 5
    expect(screen.queryByText(/Segredo compartilhado estabelecido com sucesso/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Etapa anterior/ })); // volta à 4
    expect(within(slot('alice', 'K')).getByText('ainda não definido')).toBeTruthy();
    expect(within(slot('alice', 'Brec')).getByText('19')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(within(slot('alice', 'A')).getByText('ainda não definido')).toBeTruthy();
    expect(screen.queryAllByTestId('transit-message')).toHaveLength(0);
  });

  it('a linha do tempo permite saltar para uma etapa', async () => {
    renderAt('/lab/diffie-hellman');
    await screen.findByText(/Estado inicial/);
    fireEvent.click(screen.getByRole('button', { name: /Cálculo do segredo compartilhado/ }));
    expect(within(slot('bob', 'K')).getByText('2')).toBeTruthy();
  });

  it('o alternador de explicações matemáticas oculta e exibe o painel', async () => {
    renderAt('/lab/diffie-hellman');
    await screen.findByText(/Estado inicial/);
    next();
    next();
    next();
    expect(screen.getByText('Explicação matemática da etapa')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Mostrar explicações matemáticas'));
    expect(screen.queryByText('Explicação matemática da etapa')).toBeNull();
  });

  it('valida entradas inválidas e bloqueia a animação', async () => {
    renderAt('/lab/diffie-hellman');
    await screen.findByText(/Estado inicial/);
    fireEvent.change(screen.getByLabelText(/Segredo privado de Alice/), { target: { value: '1' } });
    expect((await screen.findAllByRole('alert')).some((a) => /2 ≤ a ≤ p - 2/.test(a.textContent ?? ''))).toBe(true);
    expect(screen.getByText(/Corrija os parâmetros acima/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Segredo privado de Alice/), { target: { value: 'abc' } });
    expect(screen.getAllByRole('alert').some((a) => /apenas dígitos/.test(a.textContent ?? ''))).toBe(true);
  });

  it('o cenário MITM mostra segredos diferentes e Eve no centro', async () => {
    renderAt('/lab/diffie-hellman');
    await screen.findByText(/Estado inicial/);
    fireEvent.click(screen.getByRole('radio', { name: /homem do meio/ }));
    for (let i = 0; i < 7; i++) next();
    expect(screen.getByText(/Ataque bem-sucedido/)).toBeTruthy();
    expect(slot('alice', 'K').textContent).not.toBe(slot('bob', 'K').textContent);
    expect(slot('eve', 'KAE')).toBeTruthy();
  });

  it('não tem violações de acessibilidade', async () => {
    const { container } = renderAt('/lab/diffie-hellman');
    await screen.findByText(/Estado inicial/);
    next();
    next();
    next();
    next();
    expect(await violations(container)).toEqual([]);
  });
});

describe('laboratório RSA', () => {
  it('executa a cifragem didática com o exemplo clássico', async () => {
    renderAt('/lab/rsa');
    await screen.findByText(/Estado inicial/);
    for (let i = 0; i < 5; i++) next(); // até a cifragem de Alice
    expect(within(slot('alice', 'c')).getByText('2790')).toBeTruthy();
    for (let i = 0; i < 4; i++) next();
    expect(within(slot('bob', 'mrec')).getByText('65')).toBeTruthy();
    expect(screen.getAllByText(/Mensagem original recuperada/).length).toBeGreaterThan(0);
  });

  it('identifica o modo didático como inseguro', async () => {
    renderAt('/lab/rsa');
    await screen.findByText(/Estado inicial/);
    expect(screen.getByText('RSA didático sem padding: inseguro para aplicações reais')).toBeTruthy();
  });

  it('valida primos compostos e expoentes não coprimos', async () => {
    renderAt('/lab/rsa');
    await screen.findByText(/Estado inicial/);
    fireEvent.change(screen.getByLabelText('Primo p'), { target: { value: '60' } });
    expect((await screen.findAllByRole('alert')).some((a) => /não é primo/.test(a.textContent ?? ''))).toBe(true);
    fireEvent.change(screen.getByLabelText('Primo p'), { target: { value: '61' } });
    fireEvent.change(screen.getByLabelText('Expoente público e'), { target: { value: '6' } });
    expect((await screen.findAllByRole('alert')).some((a) => /não é coprimo/.test(a.textContent ?? ''))).toBe(true);
  });

  it('a adulteração da cifra fica evidente no resultado', async () => {
    renderAt('/lab/rsa');
    await screen.findByText(/Estado inicial/);
    fireEvent.click(screen.getByLabelText(/Adulterar a cifra em trânsito/));
    await screen.findByText(/Estado inicial/);
    for (let i = 0; i < 9; i++) next();
    expect(screen.getAllByText(/Sem padding não existe verificação de integridade/).length).toBeGreaterThan(0);
  });

  it('não tem violações de acessibilidade', async () => {
    const { container } = renderAt('/lab/rsa');
    await screen.findByText(/Estado inicial/);
    next();
    next();
    expect(await violations(container)).toEqual([]);
  });
});
