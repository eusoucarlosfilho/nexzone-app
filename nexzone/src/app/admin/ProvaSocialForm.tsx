'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import Icon from '@/components/Icon';

// Controla a prova social da página inicial. Os números exibidos no site são SEMPRE os reais:
// aqui só se escolhe o que aparece e a partir de qual mínimo. Não há campo de número extra.
export default function ProvaSocialForm({ settings }: any) {
  const reais = settings.ps_reais || { lojas: 0, produtos: 0, vendas: 0 };
  const vendas7d: number = settings.ps_vendas_7d ?? 0;
  // mesmo critério do checkout: ligado no admin E chaves configuradas na Vercel
  const cartao: boolean = !!(settings.stripe?.enabled && settings.stripe?.secret_set && settings.stripe?.webhook_set);

  const [contadores, setContadores] = useState(settings.ps_mostrar_contadores !== false);
  const [minLojas, setMinLojas] = useState(String(settings.ps_min_lojas ?? 20));
  const [minProdutos, setMinProdutos] = useState(String(settings.ps_min_produtos ?? 30));
  const [mostrarVendas, setMostrarVendas] = useState(settings.ps_mostrar_vendas === true);
  const [minVendas, setMinVendas] = useState(String(settings.ps_min_vendas ?? 50));
  const [ultimas, setUltimas] = useState(settings.ps_mostrar_ultimas_vendas === true);
  const [selos, setSelos] = useState(settings.ps_selos !== false);
  const [busy, setBusy] = useState(false);

  const n = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  const fmt = (v: number) => Number(v).toLocaleString('pt-BR');

  // Prévia: o que a página inicial mostra com os valores da tela (antes de salvar)
  const aparece = {
    lojas: contadores && reais.lojas >= n(minLojas),
    produtos: contadores && reais.produtos >= n(minProdutos),
    vendas: contadores && mostrarVendas && reais.vendas >= n(minVendas),
  };
  const nenhum = !aparece.lojas && !aparece.produtos && !aparece.vendas;

  async function salvar() {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          ps_mostrar_contadores: contadores,
          ps_min_lojas: n(minLojas),
          ps_min_produtos: n(minProdutos),
          ps_mostrar_vendas: mostrarVendas,
          ps_min_vendas: n(minVendas),
          ps_mostrar_ultimas_vendas: ultimas,
          ps_selos: selos,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) toast('Prova social salva!', 'success');
      else toast(d.error || 'Erro ao salvar', 'error');
    } catch {
      toast('Falha de conexão', 'error');
    } finally {
      setBusy(false);
    }
  }

  const Real = ({ v, ok }: { v: number; ok: boolean }) => (
    <div style={{ textAlign: 'right', minWidth: 120 }}>
      <div style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 700 }}>Real agora</div>
      <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 20 }}>{fmt(v)}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: ok ? '#1FA463' : 'var(--sub)' }}>{ok ? 'Aparece no site' : 'Escondido'}</div>
    </div>
  );

  return (
    <div className="adm-card" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 12, background: 'var(--panel2)', border: '1px solid var(--bd2)', marginBottom: 18 }}>
        <Icon name="info" size={16} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          Os números exibidos no site são sempre os reais. Abaixo do mínimo, o contador fica escondido.
        </div>
      </div>

      <label style={chk}>
        <input type="checkbox" checked={contadores} onChange={(e) => setContadores(e.target.checked)} />
        <span><strong style={tit}>Mostrar contadores na página inicial</strong><br /><small style={hint}>Lojas e produtos (e vendas, se ligado abaixo), cada um só a partir do seu mínimo.</small></span>
      </label>

      <div style={{ ...box, opacity: contadores ? 1 : .55 }}>
        <div style={linha}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Mínimo de lojas para mostrar "X lojas"</label>
            <input type="number" min={0} step={1} value={minLojas} onChange={(e) => setMinLojas(e.target.value)} style={inp} disabled={!contadores} />
            <small style={hint}>Conta lojas com pelo menos 1 produto ativo à venda (loja suspensa não conta).</small>
          </div>
          <Real v={reais.lojas} ok={aparece.lojas} />
        </div>
        <div style={linha}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Mínimo de produtos para mostrar "X produtos"</label>
            <input type="number" min={0} step={1} value={minProdutos} onChange={(e) => setMinProdutos(e.target.value)} style={inp} disabled={!contadores} />
            <small style={hint}>Conta produtos ativos (aprovados e à venda).</small>
          </div>
          <Real v={reais.produtos} ok={aparece.produtos} />
        </div>
        <div style={{ ...linha, borderBottom: 'none', paddingBottom: 0 }}>
          <div style={{ flex: 1 }}>
            <label style={{ ...chk, marginBottom: 10 }}>
              <input type="checkbox" checked={mostrarVendas} onChange={(e) => setMostrarVendas(e.target.checked)} disabled={!contadores} />
              <span><strong style={tit}>Mostrar "X vendas realizadas"</strong><br /><small style={hint}>Pedidos reais com pagamento confirmado (pago ou entregue).</small></span>
            </label>
            <label style={lbl}>Mínimo de vendas</label>
            <input type="number" min={0} step={1} value={minVendas} onChange={(e) => setMinVendas(e.target.value)} style={inp} disabled={!contadores || !mostrarVendas} />
          </div>
          <Real v={reais.vendas} ok={aparece.vendas} />
        </div>
      </div>

      <label style={chk}>
        <input type="checkbox" checked={ultimas} onChange={(e) => setUltimas(e.target.checked)} />
        <span>
          <strong style={tit}>Avisos de compras recentes</strong><br />
          <small style={hint}>Aviso discreto "Alguém de SP comprou [produto] há 2 h". Usa só pedidos reais dos últimos 7 dias, sem nome nem e-mail do comprador. Se o estado não for conhecido, mostra só "Alguém comprou…". Sem vendas na semana, nada aparece.</small><br />
          <small style={{ ...hint, fontWeight: 800 }}>Vendas reais nos últimos 7 dias: {vendas7d >= 50 ? '50 ou mais' : fmt(vendas7d)}</small>
        </span>
      </label>

      <label style={chk}>
        <input type="checkbox" checked={selos} onChange={(e) => setSelos(e.target.checked)} />
        <span>
          <strong style={tit}>Faixa de selos</strong><br />
          <small style={hint}>"Entrega na hora", "{cartao ? 'Pix e cartão' : 'Pagamento via Pix'}", "Garantia em todas as compras", "Vendedores verificados".{!cartao && ' "Pix e cartão" só aparece quando o cartão estiver ligado e configurado (como no checkout).'}</small>
        </span>
      </label>

      <div style={{ ...box, marginTop: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Prévia dos contadores na página inicial</div>
        {nenhum ? (
          <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 14 }}>Novo marketplace · lojas verificadas</span>
        ) : (
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontFamily: 'Outfit', fontWeight: 900, fontSize: 18 }}>
            {aparece.produtos && <span>{fmt(reais.produtos)} <small style={hint}>produtos</small></span>}
            {aparece.lojas && <span>{fmt(reais.lojas)} <small style={hint}>{reais.lojas === 1 ? 'loja' : 'lojas'}</small></span>}
            {aparece.vendas && <span>{fmt(reais.vendas)} <small style={hint}>{reais.vendas === 1 ? 'venda realizada' : 'vendas realizadas'}</small></span>}
          </div>
        )}
      </div>

      <button className="adm-btn ap" disabled={busy} onClick={salvar} style={{ marginTop: 16 }}>{busy ? 'Salvando…' : 'Salvar prova social'}</button>
    </div>
  );
}

const lbl = { display: 'block', fontFamily: 'Outfit', fontWeight: 800, fontSize: 13, marginBottom: 8 } as const;
const inp = { display: 'block', width: '100%', maxWidth: 220, height: 42, borderRadius: 10, border: '1px solid var(--bd2)', padding: '0 12px', fontSize: 14, marginBottom: 6, background: 'var(--panel)', color: 'var(--tx)' } as const;
const hint = { color: 'var(--sub)', fontSize: 12 } as const;
const tit = { fontFamily: 'Outfit', fontSize: 14 } as const;
const chk = { display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16, cursor: 'pointer' } as const;
const box = { padding: 14, border: '1px solid var(--bd2)', borderRadius: 12, background: 'var(--panel2)', marginBottom: 18 } as const;
const linha = { display: 'flex', gap: 16, alignItems: 'center', paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--bd2)', flexWrap: 'wrap' } as const;
