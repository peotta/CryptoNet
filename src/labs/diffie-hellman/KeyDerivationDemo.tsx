import { useState } from 'react';
import { toHex } from '../../crypto/encoding';
import type { DhSession } from '../../crypto/diffieHellman';
import { aesGcmDecrypt, aesGcmEncrypt, hkdfSha256 } from '../../crypto/kdf';
import { bitLength } from '../../crypto/bigmath';
import { Callout, primaryButtonClass } from '../../components/ui';

interface Output {
  keyAlice: string;
  keyBob: string;
  iv: string;
  ciphertext: string;
  decrypted: string;
}

const INFO = 'CryptoNet Lab dh-demo v1';

/** Extensão da etapa 7: HKDF-SHA-256 e AES-256-GCM reais sobre o segredo calculado. */
export function KeyDerivationDemo({ session }: { session: DhSession }) {
  const [text, setText] = useState('Mensagem protegida por AES-GCM.');
  const [out, setOut] = useState<Output | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      // Cada lado deriva a chave a partir do SEU segredo calculado (K_A e K_B).
      const kA = await hkdfSha256(session.kAlice, INFO);
      const kB = await hkdfSha256(session.kBob, INFO);
      const sealed = await aesGcmEncrypt(kA, text);
      const decrypted = await aesGcmDecrypt(kB, sealed);
      setOut({ keyAlice: toHex(kA), keyBob: toHex(kB), iv: toHex(sealed.iv), ciphertext: toHex(sealed.ciphertext), decrypted });
    } catch (e) {
      setOut(null);
      setError(e instanceof Error ? `Falha: ${e.message}` : 'Falha na operação criptográfica.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Callout variant="danger" title="Didático: a chave derivada é fraca">
        <p>
          O segredo K deste grupo tem no máximo {bitLength(session.p)} bits de entropia: qualquer chave derivada dele pode ser recuperada por busca exaustiva. HKDF e AES-GCM
          abaixo são reais, mas o conjunto <strong>não é seguro</strong> com estes parâmetros. Em produção, o K viria de um grupo de 2048 bits ou mais, ou de ECDH (X25519).
        </p>
      </Callout>
      <div>
        <label htmlFor="dh-msg" className="mb-1 block text-base font-semibold">
          Mensagem de Alice para Bob
        </label>
        <input id="dh-msg" value={text} onChange={(e) => setText(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-lg" />
      </div>
      <button type="button" className={primaryButtonClass} onClick={run} disabled={busy || text.length === 0 || !session.match}>
        Derivar chave (HKDF) e cifrar com AES-GCM
      </button>
      {error && (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      )}
      {out && (
        <dl className="space-y-2 rounded-xl border border-line bg-surface p-4 text-base">
          <div>
            <dt className="font-semibold">Chave derivada por Alice, HKDF-SHA-256(K_A) com 256 bits</dt>
            <dd className="break-all font-mono">{out.keyAlice}</dd>
          </div>
          <div>
            <dt className="font-semibold">Chave derivada por Bob, HKDF-SHA-256(K_B)</dt>
            <dd className="break-all font-mono">
              {out.keyBob} {out.keyAlice === out.keyBob ? '(idêntica à de Alice)' : '(DIFERENTE)'}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Vetor de inicialização (IV) de 96 bits, aleatório</dt>
            <dd className="break-all font-mono">{out.iv}</dd>
          </div>
          <div>
            <dt className="font-semibold">Texto cifrado AES-256-GCM (inclui a etiqueta de autenticação de 128 bits)</dt>
            <dd className="break-all font-mono">{out.ciphertext}</dd>
          </div>
          <div>
            <dt className="font-semibold">Bob decifra com a sua chave</dt>
            <dd className="text-lg font-semibold text-k-secret">{out.decrypted}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
