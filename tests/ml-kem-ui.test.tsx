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
// Texto do campo sem o rótulo (o valor vem depois do nome do campo).
const valueOf = (party: string, key: string) => slot(party, key).textContent ?? '';
const next = () => fireEvent.click(screen.queryByRole('button', { name: 'Iniciar' }) ?? screen.getByRole('button', { name: /Próxima etapa/ }));
const ready = () => screen.findByText(/Estado inicial\. Pressione/, undefined, { timeout: 15000 });
const open = async (part?: RegExp) => {
  renderAt('/lab/ml-kem');
  if (part) {
    fireEvent.click(await screen.findByRole('radio', { name: part }, { timeout: 10000 }));
  } else {
    await screen.findByRole('radio', { name: /A: LWE/ }, { timeout: 10000 });
  }
  await ready();
};

describe('laboratório de ML-KEM e criptografia pós-quântica', () => {
  it('está na categoria Pós-quântica, com link no menu', () => {
    renderAt('/categoria/posquantica');
    expect(screen.getByRole('heading', { level: 1, name: 'Criptografia Pós-Quântica' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: ML-KEM e reticulados/ })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Pós-quântica' }).getAttribute('href')).toBe('/categoria/posquantica');
  });

  it('Parte A: com ruído a álgebra falha e a força bruta vence; sem ruído o Gauss basta', async () => {
    await open();
    for (let i = 0; i < 15; i++) next(); // todas as etapas (inclui a leitura por Eva)
    const results = screen.getByRole('table', { name: 'Resultados do LWE didático' });
    expect(within(results).getByText(/^falhou \(resíduo/)).toBeTruthy();
    expect(within(results).getByText(/achou s após/)).toBeTruthy();
    expect(within(slot('eva', 'bit')).getByText('1')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Sem ruído/ }));
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Resultados do LWE didático' })).getByText('achou s')).toBeTruthy(), { timeout: 10000 });
  }, 60000);

  it('Parte A: valida a semente', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Semente \(1 a 99999\)/), { target: { value: '0' } });
    expect(screen.getAllByRole('alert').some((a) => /1 a 99999/.test(a.textContent ?? ''))).toBe(true);
    expect(await screen.findByText(/Corrija os parâmetros/, undefined, { timeout: 5000 })).toBeTruthy();
  }, 30000);

  it('Parte B: Alice e Bob chegam à mesma chave e Eva fica sem ela', async () => {
    await open(/B: ML-KEM/);
    for (let i = 0; i < 9; i++) next(); // até Bob receber ek
    expect(within(slot('bob', 'ek')).queryByText('ainda não definido')).toBeNull();
    expect(within(slot('alice', 'K')).getByText('ainda não definido')).toBeTruthy();
    for (let i = 0; i < 13; i++) next(); // até o veredito
    const hexOf = (party: string) => /[0-9a-f]{16}/.exec(valueOf(party, 'K'))?.[0];
    expect(hexOf('alice')).toBeDefined();
    expect(hexOf('alice')).toBe(hexOf('bob'));
    expect(within(slot('eva', 'K')).getByText('ainda não definido')).toBeTruthy();
    expect(screen.getAllByText(/Alice e Bob chegaram à mesma chave/).length).toBeGreaterThan(0);
    const results = screen.getByRole('table', { name: 'Resultados do ML-KEM' });
    expect(within(results).getByText(/Sim \(c′ = c\)/)).toBeTruthy();
    expect(within(results).getByText(/limite q\/4 = 832/)).toBeTruthy();
  }, 60000);

  it('Parte B: Eva inverte um bit e Alice recebe uma chave diferente, sem erro', async () => {
    await open(/B: ML-KEM/);
    fireEvent.click(screen.getByLabelText(/Eva inverte um bit/));
    await screen.findByRole('button', { name: /Eva inverte um bit do texto cifrado/ }, { timeout: 15000 });
    await ready();
    for (let i = 0; i < 22; i++) next();
    const results = screen.getByRole('table', { name: 'Resultados do ML-KEM' });
    expect(within(results).getByText(/Não: rejeição implícita/)).toBeTruthy();
    expect(within(results).getByText(/Não: a adulteração foi neutralizada/)).toBeTruthy();
    const hexOf = (party: string) => /[0-9a-f]{16}/.exec(valueOf(party, 'K'))?.[0];
    expect(hexOf('alice')).toBeDefined();
    expect(hexOf('alice')).not.toBe(hexOf('bob'));
    expect(screen.queryByRole('alert')).toBeNull();
  }, 60000);

  it('Parte B: troca o conjunto de parâmetros e mostra os tamanhos da FIPS 203', async () => {
    await open(/B: ML-KEM/);
    expect(screen.getByText(/Chave de encapsulamento: 1184 bytes\. Chave de desencapsulamento: 2400 bytes\. Texto cifrado: 1088 bytes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /ML-KEM-1024/ }));
    await waitFor(() => expect(screen.getByText(/Chave de encapsulamento: 1568 bytes\. Chave de desencapsulamento: 3168 bytes\. Texto cifrado: 1568 bytes/)).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: /ML-KEM-512/ }));
    await waitFor(() => expect(screen.getByText(/Chave de encapsulamento: 800 bytes\. Chave de desencapsulamento: 1632 bytes\. Texto cifrado: 768 bytes/)).toBeTruthy());
  }, 60000);

  it('Parte B: novas sementes geram outras sementes', async () => {
    await open(/B: ML-KEM/);
    const before = screen.getByTestId('seeds').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Sortear novas sementes' }));
    await waitFor(() => expect(screen.getByTestId('seeds').textContent).not.toBe(before));
  }, 30000);

  it('Parte C: tabela de tamanhos e o modo híbrido', async () => {
    renderAt('/lab/ml-kem');
    fireEvent.click(await screen.findByRole('radio', { name: /C: tamanhos/ }, { timeout: 10000 }));
    const t = screen.getByRole('table', { name: /o que cada lado envia/ });
    const hybrid = within(t).getByRole('row', { name: /X25519 \+ ML-KEM-768/ });
    expect(within(hybrid).getByText('1216')).toBeTruthy();
    expect(within(hybrid).getByText('1120')).toBeTruthy();
    expect(within(t).getByRole('row', { name: /^X25519 \(ECDH\)/ })).toBeTruthy();
    expect(screen.getByText(/Colher agora, decifrar depois/)).toBeTruthy();
  }, 30000);

  it('não tem violações de acessibilidade em nenhuma parte', async () => {
    await open();
    next();
    expect(await violations(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /B: ML-KEM/ }));
    await ready();
    next();
    expect(await violations(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /C: tamanhos/ }));
    expect(await violations(document.body)).toEqual([]);
  }, 90000);
});
