// Arte promocional de um anúncio (feed 1080x1080 ou stories 1080x1920), com os dados reais dele.
// Usada por /api/divulgar/imagem/[id]. Sem dependência de banco: testável com dados de exemplo.
import { ImageResponse } from 'next/og';

const moeda = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

export function arteDivulgacao(d: { f: 'quadrado' | 'story'; titulo: string; preco: number; promo: number | null; loja: string; capa: string | null }, headers?: Record<string, string>) {
  const { f, preco, promo, loja, capa } = d;
  const max = d.f === 'story' ? 90 : 64;
  const t0 = String(d.titulo || '').trim();
  const titulo = t0.length > max ? t0.slice(0, max - 1).trimEnd() + '…' : t0;
  const temPromo = promo != null && promo > 0 && promo < preco;
  const W = 1080, H = f === 'story' ? 1920 : 1080, lado = f === 'story' ? 900 : 470;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', background: '#0B0B0C', color: '#fff', padding: f === 'story' ? '110px 90px' : '56px 70px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 800 }}><span style={{ color: '#fff' }}>Comprei</span><span style={{ color: '#FF7A00', marginLeft: 10 }}>Barato</span></div>
          <div style={{ display: 'flex', fontSize: 26, color: '#FFC83D', border: '2px solid #FFC83D', borderRadius: 999, padding: '8px 22px' }}>Pix · dinheiro protegido</div>
        </div>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginTop: 24, marginBottom: 8 }}>
          {capa
            ? <img src={capa} width={lado} height={lado} style={{ borderRadius: 36, objectFit: 'cover', border: '6px solid #FF7A00' }} />
            : <div style={{ width: lado, height: lado, borderRadius: 36, background: '#1C1C1F', border: '6px solid #FF7A00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 120, color: '#FF7A00' }}>CB</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: f === 'story' ? 36 : 18 }}>
          <div style={{ display: 'flex', fontSize: f === 'story' ? 62 : 44, fontWeight: 800, lineHeight: 1.15 }}>{titulo}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 22 }}>
            {temPromo && <span style={{ fontSize: 38, color: '#A1A1AA', textDecoration: 'line-through', marginRight: 22 }}>{moeda(preco)}</span>}
            <span style={{ fontSize: f === 'story' ? 96 : 72, fontWeight: 800, color: '#FF7A00' }}>{moeda(temPromo ? (promo as number) : preco)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, fontSize: 30, color: '#D4D4D8' }}>
            <span>Vendido por {loja}</span>
            <span style={{ background: '#FF7A00', color: '#0B0B0C', fontWeight: 800, borderRadius: 18, padding: '14px 30px' }}>{f === 'story' ? 'Toque no link' : 'compreibarato.com.br'}</span>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, headers },
  );
}
