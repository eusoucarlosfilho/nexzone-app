'use client';
import Icon from '@/components/Icon';

// Caixa do order bump no checkout (e na prévia do construtor).
// Só apresentação: o valor cobrado continua vindo do servidor (products.bump_valor).
export type BumpExibicao = {
  titulo: string; valor: number; precoDe?: number | null;
  chamada?: string | null; texto?: string | null; imagem?: string | null; descricao?: string | null;
};
const money = (v: number) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

export default function BumpOferta({ bump, marcado, onToggle, cor }: { bump: BumpExibicao; marcado: boolean; onToggle: (v: boolean) => void; cor: string }) {
  const de = bump.precoDe && bump.precoDe > bump.valor ? bump.precoDe : null;
  return (
    <label style={{ display: 'block', margin: '14px 0', border: `2px dashed ${cor}`, borderRadius: 14, cursor: 'pointer', background: marcado ? 'var(--green-bg)' : 'var(--soft)', overflow: 'hidden', transition: 'background .2s' }}>
      <div style={{ background: cor, color: '#fff', fontFamily: 'Outfit', fontWeight: 900, fontSize: 13, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={marcado} onChange={(e) => onToggle(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#fff', flexShrink: 0 }} />
        <span>{bump.chamada || `Sim! Quero adicionar ${bump.titulo}`}</span>
        <Icon name="arrowLeft" size={16} style={{ marginLeft: 'auto', flexShrink: 0 }} />
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '12px', alignItems: 'flex-start' }}>
        {bump.imagem && <img src={bump.imagem} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />}
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.45 }}>
          <strong style={{ fontFamily: 'Outfit', display: 'block', fontSize: 14.5, marginBottom: 2 }}>{bump.titulo}</strong>
          <span style={{ color: '#3A3A52', whiteSpace: 'pre-wrap' }}>{bump.texto || bump.descricao || 'Oferta especial só nesta compra.'}</span>
          <span style={{ display: 'block', marginTop: 6 }}>
            {de && <s className="muted" style={{ marginRight: 6 }}>{money(de)}</s>}
            <strong style={{ color: cor, fontSize: 15 }}>+ {money(bump.valor)}</strong>
            {de && <span style={{ marginLeft: 6, fontSize: 11.5, fontWeight: 900, background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 50, padding: '2px 8px' }}>-{Math.round((1 - bump.valor / de) * 100)}%</span>}
          </span>
        </span>
      </div>
    </label>
  );
}
