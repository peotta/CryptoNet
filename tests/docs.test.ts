import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { docUrl, LABS } from '../src/labs/registry';
import { NIST_URLS } from '../src/labs/standards';

const dir = path.resolve(__dirname, '..', 'docs', 'laboratorios');
const read = (name: string) => fs.readFileSync(path.join(dir, name), 'utf8');
const available = LABS.filter((l) => l.status === 'available');

describe('documentação dos laboratórios (gerada por npm run docs:labs)', () => {
  it('todo laboratório disponível tem o seu documento', () => {
    for (const l of available) expect(fs.existsSync(path.join(dir, `${l.id}.md`)), `docs/laboratorios/${l.id}.md (rode npm run docs:labs)`).toBe(true);
  });
  it('o link do cartão aponta para o documento de cada laboratório', () => {
    for (const l of available) expect(docUrl(l)).toBe(`https://github.com/peotta/CryptoNet/blob/main/docs/laboratorios/${l.id}.md`);
  });
  it('o índice lista todos os laboratórios disponíveis', () => {
    const index = read('README.md');
    for (const l of available) expect(index, l.id).toContain(`(${l.id}.md)`);
  });
  it('não há documento sem laboratório correspondente', () => {
    const ids = new Set(available.map((l) => l.id));
    for (const f of fs.readdirSync(dir)) if (f !== 'README.md') expect(ids.has(f.replace(/\.md$/, '')), f).toBe(true);
  });
  it('cada documento tem um único H1, o crédito no rodapé e nenhum travessão', () => {
    for (const f of fs.readdirSync(dir)) {
      const text = read(f);
      expect(text.match(/^# /gm), f).toHaveLength(1);
      expect(text, f).toContain('CryptoNet é um projeto mantido pelo Prof. Dr. Laerte Peotta de Melo');
      expect(/[—–]/.test(text), `${f}: travessão ou meia-risca`).toBe(false);
    }
  });
  it('toda RFC citada tem link para o rfc-editor.org', () => {
    for (const f of fs.readdirSync(dir)) {
      const text = read(f).replace(/\[RFC \d+\]\(https:\/\/www\.rfc-editor\.org\/rfc\/rfc\d+\)/g, '');
      expect(text.match(/\bRFC \d+/g) ?? [], f).toEqual([]);
    }
  });
  it('toda FIPS e SP do NIST citada tem link para a página oficial', () => {
    for (const f of fs.readdirSync(dir)) {
      let text = read(f);
      for (const [name, url] of Object.entries(NIST_URLS)) text = text.split(`[${name}](${url})`).join('');
      expect(text.match(/\b(FIPS \d{3}(-\d)?|SP 800-\d+[A-Z]?)\b/g) ?? [], f).toEqual([]);
    }
  });
  it('não expõe valores aleatórios (hexadecimais longos)', () => {
    for (const f of fs.readdirSync(dir)) expect(/\b[0-9a-f]{32,}\b/.test(read(f)), f).toBe(false);
  });
});
