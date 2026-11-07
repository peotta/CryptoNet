import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buscarSigla, comSecaoDeSiglas, GLOSSARIO, NAO_SIGLAS, siglasDoTexto } from '../src/docs/glossario';
import { LABS } from '../src/labs/registry';

const DIR = path.resolve(__dirname, '../docs/laboratorios');
// A cobertura obrigatória vale para as siglas que aparecem em pelo menos este número de documentos.
const MIN_DOCS = 2;

function docs(): Record<string, Map<string, number>> {
  const out: Record<string, Map<string, number>> = {};
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith('.md') || f === 'README.md') continue;
    out[f.slice(0, -3)] = siglasDoTexto(fs.readFileSync(path.join(DIR, f), 'utf8'));
  }
  return out;
}

describe('glossário de siglas', () => {
  it('toda entrada tem expansão e finalidade, sem travessão longo nem meia-risca', () => {
    for (const e of GLOSSARIO) {
      expect(e.sigla.trim(), 'sigla').not.toBe('');
      expect(e.expansao.trim(), e.sigla + ': expansão').not.toBe('');
      expect(e.serve.trim().length, e.sigla + ': para que serve').toBeGreaterThan(15);
      expect(JSON.stringify(e), e.sigla).not.toMatch(/[–—]/);
    }
  });

  it('não repete a mesma sigla no mesmo escopo', () => {
    const vistos = new Set<string>();
    for (const e of GLOSSARIO) {
      const chave = e.sigla + '|' + (e.escopo || ['*']).join(',');
      expect(vistos.has(chave), 'repetida: ' + chave).toBe(false);
      vistos.add(chave);
    }
  });

  it('os escopos citam laboratórios que existem, e as partes existem no glossário', () => {
    const ids = new Set(LABS.map((l) => l.id));
    const siglas = new Set(GLOSSARIO.map((e) => e.sigla));
    for (const e of GLOSSARIO) {
      for (const id of e.escopo || []) expect(ids.has(id), e.sigla + ': laboratório ' + id).toBe(true);
      for (const p of e.partes || []) expect(siglas.has(p), e.sigla + ': parte ' + p).toBe(true);
    }
  });

  it('uma sigla com mais de um sentido tem escopo em todas as entradas', () => {
    const por = new Map<string, number>();
    GLOSSARIO.forEach((e) => por.set(e.sigla, (por.get(e.sigla) || 0) + 1));
    for (const [s, n] of por) if (n > 1) for (const e of GLOSSARIO.filter((x) => x.sigla === s)) expect(e.escopo, s + ' ambígua exige escopo').toBeTruthy();
  });

  it('a busca prefere o sentido do laboratório e cai no geral', () => {
    expect(buscarSigla('AES', 'rsa')?.expansao).toBe('Advanced Encryption Standard');
    expect(buscarSigla('MD', 'dap')?.expansao).toBe('Mobile Device');
    expect(buscarSigla('XYZ')).toBeUndefined();
  });

  it('a seção é numerada, fica antes do rodapé e só traz as siglas do sentido do laboratório', () => {
    const base = '# T\n\n## 1. A\n\nUsa AES-GCM e KDC.\n\n---\n\n*CryptoNet é um projeto mantido pelo X*\n';
    const geral = comSecaoDeSiglas(base, 'aes');
    expect(geral).toMatch(/## 2\. Glossário/);
    expect(geral).toContain('**AES-GCM**');
    expect(geral).not.toContain('**KDC**');
    expect(geral.indexOf('## 2. Glossário')).toBeLessThan(geral.indexOf('---\n\n*CryptoNet'));
    expect(comSecaoDeSiglas(base, 'kerberos')).toContain('**KDC**');
  });

  it(`cobre as siglas usadas em ${MIN_DOCS} ou mais documentos`, () => {
    const porDoc = docs();
    const contagem = new Map<string, number>();
    for (const m of Object.values(porDoc)) for (const s of m.keys()) contagem.set(s, (contagem.get(s) || 0) + 1);
    const conhecidas = new Set(GLOSSARIO.map((e) => e.sigla));
    const faltam = [...contagem].filter(([s, n]) => n >= MIN_DOCS && !conhecidas.has(s) && !NAO_SIGLAS.has(s)).map(([s, n]) => s + ' (' + n + ')');
    expect(faltam, 'siglas sem entrada no glossário (ou acrescente a NAO_SIGLAS)').toEqual([]);
  });

  it('as exceções de NAO_SIGLAS não estão no glossário', () => {
    for (const s of NAO_SIGLAS) expect(GLOSSARIO.some((e) => e.sigla === s), s).toBe(false);
  });

  it('todo documento gerado com siglas do glossário tem a seção Glossário', () => {
    for (const l of LABS.filter((x) => x.status === 'available')) {
      const texto = fs.readFileSync(path.join(DIR, l.id + '.md'), 'utf8');
      expect(texto, l.id).toMatch(/^## \d+\. Glossário$/m);
    }
  });
});
