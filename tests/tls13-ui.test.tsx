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
const open = async (scenario?: string) => {
  renderAt('/lab/tls13');
  if (scenario) fireEvent.click(await screen.findByRole('radio', { name: scenario }));
  await ready();
};
const MITM = /homem do meio/;

describe('laboratório do handshake do TLS 1.3', () => {
  it('está disponível na categoria Assimétrica', () => {
    renderAt('/categoria/assimetrica');
    expect(screen.getAllByRole('link', { name: /Abrir laboratório\s*: Handshake do TLS 1\.3/ })).toHaveLength(1);
  });

  it('mostra o cronograma de chaves com o Early Secret da RFC 8448', async () => {
    await open();
    const table = screen.getByRole('table', { name: /Cronograma de chaves do TLS 1\.3/ });
    expect(within(table).getByText('33ad0a1c607ec03b09e6cd9893680ce210adf300aa1f2660e1b22e10f170f92a')).toBeTruthy();
    expect(within(table).getAllByRole('row')).toHaveLength(10);
  }, 30000);

  it('a animação passo a passo: Alice, Bob e Eva, uma operação por vez', async () => {
    await open();
    next(); // Alice gera o par efêmero
    expect(within(slot('alice', 'x')).queryByText('ainda não definido')).toBeNull();
    next(); // ClientHello
    expect(within(slot('eva', 'seen')).queryByText('ainda não definido')).toBeNull(); // Eva vê a chave pública
    next(); // Bob gera
    next(); // ServerHello
    expect(within(slot('alice', 'S')).getByText('ainda não definido')).toBeTruthy();
    next(); // Alice calcula o segredo
    expect(within(slot('alice', 'S')).queryByText('ainda não definido')).toBeNull();
    expect(within(slot('bob', 'S')).getByText('ainda não definido')).toBeTruthy();
    next(); // Bob calcula
    expect(within(slot('bob', 'S')).queryByText('ainda não definido')).toBeNull();
    expect(within(slot('eva', 'S')).getByText('ainda não definido')).toBeTruthy(); // Eva não tem o segredo
    next(); // Eva tenta
    expect(within(slot('eva', 'S')).getByText('ainda não definido')).toBeTruthy();
  }, 40000);

  it('percorre o handshake normal até o veredito: Eva não obtém nada', async () => {
    await open();
    for (let i = 0; i < 24; i++) next();
    expect(screen.getAllByText(/sigilo adiante/).length).toBeGreaterThan(0);
    expect(within(slot('bob', 'mrec')).getByText(/GET \/saldo/)).toBeTruthy();
    expect(within(slot('eva', 'P')).getByText('ainda não definido')).toBeTruthy();
  }, 60000);

  it('homem do meio com verificação: Alice interrompe o handshake', async () => {
    await open('Eva no meio do caminho (homem do meio)');
    expect(screen.getByLabelText(/Alice verifica o certificado/)).toBeTruthy();
    for (let i = 0; i < 40 && !screen.queryAllByText(/Finished de Eva estava correto/).length; i++) {
      const btn = screen.queryByRole('button', { name: /Próxima etapa|Iniciar/ }) as HTMLButtonElement | null;
      if (!btn || btn.disabled) break;
      fireEvent.click(btn);
    }
    expect(screen.getAllByText(/CertificateVerify inválido/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/O handshake é interrompido/).length).toBeGreaterThan(0);
  }, 60000);

  it('homem do meio sem verificação: Eva lê a mensagem', async () => {
    await open('Eva no meio do caminho (homem do meio)');
    fireEvent.click(screen.getByLabelText(/Alice verifica o certificado/));
    await screen.findByText(/Eva leu:/, undefined, { timeout: 15000 });
    expect(screen.getByText(/Eva leu: "GET \/saldo\?conta=12345"/)).toBeTruthy();
    expect(screen.getAllByText(MITM).length).toBeGreaterThan(0);
  }, 60000);

  it('valida o nome do servidor e a mensagem', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Nome do servidor/), { target: { value: 'a b' } });
    expect((await screen.findAllByRole('alert', undefined, { timeout: 10000 })).some((a) => /Nome do servidor inválido/.test(a.textContent ?? ''))).toBe(true);
  }, 40000);

  it('um novo handshake troca as chaves efêmeras', async () => {
    await open();
    const before = screen.getByText('Early Secret').closest('tr')!.nextElementSibling!.textContent;
    const shared = () => within(screen.getByRole('table', { name: /Cronograma/ })).getByText('Segredo ECDHE').closest('tr')!.lastElementChild!.textContent;
    const s1 = shared();
    fireEvent.click(screen.getByRole('button', { name: /Novo handshake/ }));
    await new Promise((r) => setTimeout(r, 800));
    expect(shared()).not.toBe(s1);
    expect(before).toBeTruthy();
  }, 40000);

  it('não tem violações de acessibilidade', async () => {
    await open();
    next();
    next();
    expect(await violations(document.body)).toEqual([]);
  }, 40000);
});
