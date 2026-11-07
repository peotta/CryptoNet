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
const valueOf = (party: string, key: string) => slot(party, key).textContent ?? '';
const next = () => fireEvent.click(screen.queryByRole('button', { name: 'Iniciar' }) ?? screen.getByRole('button', { name: /Próxima etapa/ }));
const ready = () => screen.findByText(/Estado inicial\. Pressione/, undefined, { timeout: 15000 });
const open = async (part?: RegExp) => {
  renderAt('/lab/dap');
  await screen.findByRole('radio', { name: /A: provisionamento da chave/ }, { timeout: 10000 });
  if (part) fireEvent.click(screen.getByRole('radio', { name: part }));
  await ready();
};
const steps = (n: number) => {
  for (let i = 0; i < n; i++) next();
};

describe('laboratório do DAP', () => {
  it('está na categoria própria do DAP, com link no menu', () => {
    renderAt('/categoria/dap');
    expect(screen.getByRole('heading', { level: 1, name: 'DAP: Autorização de Transações' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: DAP/ })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'DAP' }).getAttribute('href')).toBe('/categoria/dap');
  });

  it('Parte A: o MD guarda k, Eva vê só k1 e o QR 001 aparece depois do envio', async () => {
    await open();
    expect(screen.queryByTestId('qr-footer')).toBeNull();
    steps(4); // até Bob exibir o QR de k1
    const qr = screen.getByTestId('qr-footer');
    expect(within(qr).getByRole('img', { name: /QR de k1 .*QR code com \d+ por \d+ módulos/ })).toBeTruthy();
    expect(screen.getByTestId('qr-text').textContent).toMatch(/^099;001;1;[A-Z0-9]{20};[A-Za-z0-9+/=]{88};[0-9A-F]{8}$/);
    expect(within(slot('eva', 'k1')).queryByText('ainda não definido')).toBeNull(); // Eva vê k1 na tela do UC
    expect(within(slot('eva', 'k2')).getByText('ainda não definido')).toBeTruthy();
    steps(6); // até o veredito da fase
    expect(/[0-9a-f]{6}…[0-9a-f]{6}/.exec(valueOf('alice', 'k'))?.[0]).toBeDefined();
    expect(within(slot('bob', 'k')).getByText('ainda não definido')).toBeTruthy(); // a recomposição de k no e-Bank é da ativação
    const results = screen.getByRole('table', { name: 'Resultados do provisionamento da chave' });
    expect(within(results).getByText('Sim')).toBeTruthy();
    expect(screen.getAllByText(/Chave provisionada/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('radio', { name: /Chave correta/ })).toBeNull(); // cenários da ativação ficam na outra aba
  }, 60000);

  it('Parte A: Eva troca k1 e o MD não percebe', async () => {
    await open();
    fireEvent.click(screen.getByRole('radio', { name: /Eva troca k1 no UC/ }));
    await screen.findByText(/Não: o MD e o e-Bank divergem/, undefined, { timeout: 10000 });
    await ready();
    steps(11);
    expect(screen.getAllByText(/O MD aceitou o QR trocado/).length).toBeGreaterThan(0);
  }, 60000);

  it('Parte B: as chaves coincidem e o MD é habilitado', async () => {
    await open(/B: ativação/);
    steps(2); // ponto de partida e recomposição de k no e-Bank
    const hexOf = (party: string) => /[0-9a-f]{6}…[0-9a-f]{6}/.exec(valueOf(party, 'k'))?.[0];
    expect(hexOf('alice')).toBeDefined();
    expect(hexOf('alice')).toBe(hexOf('bob'));
    steps(12); // até o veredito
    expect(within(slot('bob', 'res')).getByText('MD habilitado')).toBeTruthy();
    const results = screen.getByRole('table', { name: 'Resultados da ativação' });
    expect(within(results).getByText('Iguais')).toBeTruthy();
    expect(within(results).getByText('MD habilitado')).toBeTruthy();
    expect(screen.getAllByText(/Ativação concluída/).length).toBeGreaterThan(0);
  }, 60000);

  it('Parte B: com a chave divergente a ativação falha na etiqueta', async () => {
    await open(/B: ativação/);
    fireEvent.click(screen.getByRole('radio', { name: /Chave divergente/ }));
    await screen.findByText('Diferentes', undefined, { timeout: 10000 });
    const results = screen.getByRole('table', { name: 'Resultados da ativação' });
    expect(within(results).getByText("y' ≠ y: o MD rejeita")).toBeTruthy();
    expect(within(results).getByText('MD não habilitado')).toBeTruthy();
    await ready();
    steps(9);
    expect(screen.getAllByText(/Eva trocou k1/).length).toBeGreaterThan(0);
    expect(within(slot('alice', 'rhat')).getByText('ainda não definido')).toBeTruthy();
  }, 60000);

  it('Parte B: valida os tempos informados', async () => {
    await open(/B: ativação/);
    fireEvent.change(screen.getByLabelText(/Segundos até o código chegar/), { target: { value: '5' } });
    expect(await screen.findByText(/depois da leitura do QR/, undefined, { timeout: 5000 })).toBeTruthy();
  }, 30000);

  it('Parte C: o MD mostra a transação e Alice e Bob terminam com o código certo', async () => {
    await open(/C: autorização/);
    steps(9); // até o QR do desafio ser enviado
    const qr = screen.getByTestId('qr-footer');
    expect(within(qr).getByRole('img', { name: /QR do desafio/ })).toBeTruthy();
    steps(3); // y', validação e tela
    expect(valueOf('alice', 'tela')).toContain('MARIA SILVA');
    expect(valueOf('alice', 'tela')).toContain('R$ 1.500,00');
    steps(3); // r_hat, digitação e conferência
    const rhat = /\d{6}/.exec(valueOf('alice', 'rhat'))?.[0];
    expect(rhat).toBeDefined();
    expect(valueOf('eva', 'rhat')).toContain(rhat!);
    expect(within(slot('eva', 'K')).getByText('desconhecida')).toBeTruthy();
    expect(screen.getAllByText(/Transação autorizada/).length).toBeGreaterThan(0);
    const results = screen.getByRole('table', { name: 'Resultados da transação' });
    expect(within(results).getByText('Transação executada')).toBeTruthy();
    expect(within(results).getByText(/y confere/)).toBeTruthy();
  }, 60000);

  it('Parte C: Eva altera o QR e o MD descarta o desafio sem decifrar o código', async () => {
    await open(/C: autorização/);
    fireEvent.click(screen.getByRole('radio', { name: /Eva altera o QR/ }));
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Resultados da transação' })).getByText("y' ≠ y: rejeitado")).toBeTruthy(), { timeout: 10000 });
    await ready();
    steps(11); // até a verificação da etiqueta
    expect(screen.getAllByText(/Erro de integridade ou autenticidade/).length).toBeGreaterThan(0);
    expect(within(slot('alice', 'rhat')).getByText('ainda não definido')).toBeTruthy();
    expect(within(slot('alice', 'tela')).getByText('ainda não definido')).toBeTruthy();
  }, 60000);

  it('Parte C: valida o valor e o favorecido', async () => {
    await open(/C: autorização/);
    fireEvent.change(screen.getByLabelText(/Valor em reais/), { target: { value: 'abc' } });
    expect(await screen.findByText(/Informe o valor em reais/, undefined, { timeout: 5000 })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Valor em reais/), { target: { value: '10,00' } });
    fireEvent.change(screen.getByLabelText(/Favorecido/), { target: { value: 'A;B' } });
    expect(await screen.findByText(/aceita só letras/, undefined, { timeout: 5000 })).toBeTruthy();
  }, 30000);

  it('Parte C: novos valores trocam as sementes', async () => {
    await open(/C: autorização/);
    const before = screen.getByTestId('dap-seeds').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Sortear novos valores' }));
    await waitFor(() => expect(screen.getByTestId('dap-seeds').textContent).not.toBe(before));
  }, 30000);

  it('o tamanho do texto da animação pode ser fixado e é lembrado', async () => {
    localStorage.clear();
    await open();
    const select = screen.getByLabelText('Tamanho do texto') as HTMLSelectElement;
    expect(select.value).toBe('auto');
    fireEvent.change(select, { target: { value: '1.5' } });
    const zoomed = () => Array.from(document.querySelectorAll<HTMLElement>('div')).some((d) => d.style.zoom === '1.5');
    await waitFor(() => expect(zoomed()).toBe(true));
    expect(localStorage.getItem('cryptonet:tamanho-do-texto')).toBe('1.5');
    cleanup();
    await open();
    expect((screen.getByLabelText('Tamanho do texto') as HTMLSelectElement).value).toBe('1.5');
    localStorage.clear();
  }, 30000);

  it('não tem violações de acessibilidade em nenhuma parte', async () => {
    await open();
    steps(4);
    expect(await violations(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole('radio', { name: /C: autorização/ }));
    await ready();
    steps(9);
    expect(await violations(document.body)).toEqual([]);
  }, 90000);
});
