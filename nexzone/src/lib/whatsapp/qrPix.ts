// Gera a imagem PNG (base64 puro) do QR Code a partir do código Pix copia e cola. SÓ SERVIDOR.
import QRCode from 'qrcode';

export async function qrPixPng(codigo: string): Promise<string | null> {
  const c = String(codigo || '').trim();
  if (!c || c.length > 1000) return null;
  try {
    const url = await QRCode.toDataURL(c, { errorCorrectionLevel: 'M', margin: 3, width: 600, color: { dark: '#000000', light: '#FFFFFF' } });
    return url.replace(/^data:image\/png;base64,/, '');
  } catch {
    return null;
  }
}
