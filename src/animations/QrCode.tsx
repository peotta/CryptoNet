import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

interface Props {
  /** Texto codificado no QR (ISO/IEC 18004, modo byte, correção de erros L). */
  text: string;
  /** Título curto, usado como nome acessível. */
  title: string;
  /** Lado em pixels; a matriz é redimensionada para caber. */
  size?: number;
}

/** Matriz de módulos de um QR code, em SVG. Os módulos escuros formam um único caminho. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'L');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

export function QrCode({ text, title, size = 168 }: Props) {
  const matrix = useMemo(() => qrMatrix(text), [text]);
  const n = matrix.length;
  const quiet = 2; // zona silenciosa reduzida (a norma pede 4 módulos; a moldura da tela já isola o código)
  const path = matrix.flatMap((row, r) => row.flatMap((dark, c) => (dark ? [`M${c + quiet} ${r + quiet}h1v1h-1z`] : []))).join('');
  const total = n + quiet * 2;
  return (
    <figure className="m-0 inline-block text-center">
      <svg role="img" aria-label={`${title}: QR code com ${n} por ${n} módulos`} width={size} height={size} viewBox={`0 0 ${total} ${total}`} shapeRendering="crispEdges" className="rounded-md border border-line">
        <rect width={total} height={total} fill="#ffffff" />
        <path d={path} fill="#000000" />
      </svg>
      <figcaption className="mt-1 text-sm text-muted">
        {title} ({n} × {n} módulos, {text.length} caracteres)
      </figcaption>
    </figure>
  );
}
