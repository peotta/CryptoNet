// @vitest-environment jsdom
import axe from 'axe-core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/App';
import { headingsOf, slug } from '../src/docs/slug';
import { LABS } from '../src/labs/registry';

// O jsdom não tem layout de SVG: o Mermaid real só roda no navegador. Aqui ele é simulado.
const render_ = vi.fn(async (id: string, code: string) => ({ svg: `<svg id="${id}" role="presentation"><text>${code.split('\n')[0]}</text></svg>` }));
const initialize = vi.fn();
vi.mock('mermaid', () => ({ default: { initialize: (...a: unknown[]) => initialize(...a), render: (id: string, code: string) => render_(id, code) } }));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  render_.mockClear();
  initialize.mockClear();
});
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

const open = async (id = 'aes') => {
  renderAt(`/lab/${id}/documentacao`);
  return screen.findByRole('heading', { level: 1 }, { timeout: 15000 });
};

describe('âncoras e índice (funções puras)', () => {
  it('slug segue o padrão do GitHub, igual ao do gerador', () => {
    expect(slug('5.1.1 ECB com Eva alterando um bloco')).toBe('511-ecb-com-eva-alterando-um-bloco');
    expect(slug('Perguntas de fixação')).toBe('perguntas-de-fixação');
  });
  it('headingsOf ignora blocos de código', () => {
    const md = '# T\n## 1. A\n```text\n## fora\n```\n#### 2.1.1 B';
    expect(headingsOf(md).map((h) => [h.level, h.id])).toEqual([[2, '1-a'], [4, '211-b']]);
  });
});

describe('página de documentação (Markdown e Mermaid)', () => {
  it('mostra o documento do laboratório com o visual do site e os diagramas', async () => {
    const h1 = await open('aes');
    expect(h1.textContent).toBe('AES e modos de operação');
    expect(screen.getByRole('link', { name: 'CryptoNet Lab' })).toBeTruthy(); // cabeçalho do site
    expect(screen.getByRole('link', { name: 'Abrir o laboratório' }).getAttribute('href')).toBe('/lab/aes');
    const gh = screen.getByRole('link', { name: /Ver no GitHub/ });
    expect(gh.getAttribute('href')).toBe('https://github.com/peotta/CryptoNet/blob/main/docs/laboratorios/aes.md');
    expect(gh.getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('heading', { level: 2, name: '5. Cenários' })).toBeTruthy();
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
    // um diagrama por cenário (ECB, CBC, CTR e GCM), todos desenhados
    await waitFor(() => expect(screen.getAllByRole('img', { name: /Diagrama de sequência/ })).toHaveLength(4), { timeout: 10000 });
    await waitFor(() => expect(document.querySelectorAll('figure svg')).toHaveLength(4), { timeout: 10000 });
    expect(render_.mock.calls[0][1]).toMatch(/^sequenceDiagram/);
    // o Mermaid usa as cores padrão (como no GitHub) e roda em modo estrito
    const cfg = initialize.mock.calls[0][0] as { securityLevel: string; theme: string };
    expect(cfg.securityLevel).toBe('strict');
    expect(cfg.theme).toBe('default'); // cores padrão do Mermaid, como no GitHub
  }, 40000);

  it('o índice lateral leva ao título correspondente', async () => {
    await open('tls13');
    const toc = screen.getByRole('navigation', { name: 'Nesta página' });
    fireEvent.click(within(toc).getByRole('link', { name: '6. Perguntas de fixação' }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('6-perguntas-de-fixação');
  }, 40000);

  it('as âncoras do texto (lista de figuras) não trocam de página', async () => {
    await open('aes');
    const fig = screen.getByRole('link', { name: 'Figura 5.1.2' });
    fireEvent.click(fig);
    expect(document.activeElement?.id).toBe('512-cbc-com-eva-alterando-um-bloco');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('AES e modos de operação');
  }, 40000);

  it('o link de um documento para outro vira rota interna e os externos abrem em nova aba', async () => {
    await open('tls13');
    for (const a of screen.getAllByRole('link')) {
      const href = a.getAttribute('href') ?? '';
      if (/^https?:/.test(href)) {
        // links externos (RFCs, aplicação): nova aba e sem acesso ao opener
        if (href.includes('peotta.github.io') || href.includes('rfc-editor.org')) {
          expect(a.getAttribute('target')).toBe('_blank');
          expect(a.getAttribute('rel')).toContain('noopener');
        }
      } else {
        expect(href.endsWith('.md'), href).toBe(false); // nenhum link relativo quebrado para .md
      }
    }
    expect(screen.getAllByRole('link', { name: /RFC 9846/ }).length).toBeGreaterThan(0);
  }, 40000);

  it('há documentação para todos os laboratórios, e um id inexistente cai na página 404', async () => {
    for (const lab of LABS.filter((l) => l.status === 'available')) {
      renderAt(`/lab/${lab.id}/documentacao`);
      expect((await screen.findByRole('heading', { level: 1 }, { timeout: 15000 })).textContent).toBe(lab.title);
      cleanup();
    }
    renderAt('/lab/inexistente/documentacao');
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeTruthy();
  }, 120000);

  it('mostra o código quando o Mermaid falha', async () => {
    render_.mockRejectedValueOnce(new Error('falha'));
    await open('aes');
    expect(await screen.findByText(/Não foi possível desenhar o diagrama/, undefined, { timeout: 10000 })).toBeTruthy();
  }, 40000);

  it('o título da aba identifica a documentação', async () => {
    await open('rsa');
    expect(document.title).toBe('Documentação: RSA | CryptoNet Lab');
  }, 40000);

  it('não tem violações de acessibilidade', async () => {
    await open('aes');
    await waitFor(() => expect(document.querySelectorAll('figure svg')).toHaveLength(4), { timeout: 10000 });
    const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  }, 60000);
});
