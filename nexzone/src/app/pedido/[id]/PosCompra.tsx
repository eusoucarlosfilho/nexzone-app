'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePixels, dispararCompraUmaVez } from '@/components/PixelsVenda';
import type { RastreioProduto } from '@/lib/rastreioVenda';
import Icon from '@/components/Icon';

// Depois do pagamento (Sprint 1):
//  • dispara a COMPRA nos pixels do vendedor (uma vez por pedido)
//  • leva para a página de obrigado do vendedor, se ele configurou (uma vez, com opção de ficar)
//  • quem comprou sem cadastro cria uma senha para acessar depois
export default function PosCompra({ pago, orderId, produtoId, titulo, valor, rastreio, senhaPendente, segurar = false }: {
  pago: boolean; orderId: string; produtoId: string; titulo: string; valor: number;
  rastreio: RastreioProduto | null; senhaPendente: boolean;
  segurar?: boolean; // há oferta pós-compra na tela (SQL 19): não leva para a página de obrigado ainda
}) {
  usePixels(rastreio);
  const obrigado = rastreio?.obrigadoUrl || '';
  const [contagem, setContagem] = useState<number | null>(null);
  const [senha, setSenha] = useState('');
  const [senhaOk, setSenhaOk] = useState(!senhaPendente);
  const [salvando, setSalvando] = useState(false);
  const [erroSenha, setErroSenha] = useState('');

  const destino = (() => {
    if (!obrigado) return '';
    try { const u = new URL(obrigado); u.searchParams.set('pedido', orderId); u.searchParams.set('produto', produtoId); return u.toString(); } catch { return ''; }
  })();

  // Compra nos pixels (espera os scripts carregarem)
  useEffect(() => {
    if (!pago || !rastreio) return;
    const t = setTimeout(() => dispararCompraUmaVez(rastreio, { valor, produtoId, titulo, pedidoId: orderId }), 900);
    return () => clearTimeout(t);
  }, [pago, rastreio, valor, produtoId, titulo, orderId]);

  // Página de obrigado: só na primeira vez que o pagamento aparece aqui, e só se não houver senha a criar
  useEffect(() => {
    if (!pago || !destino || !senhaOk || segurar) return;
    const chave = `cb_obrigado_${orderId}`;
    try { if (localStorage.getItem(chave)) return; localStorage.setItem(chave, '1'); } catch {}
    setContagem(6);
  }, [pago, destino, senhaOk, orderId, segurar]);
  useEffect(() => {
    if (contagem === null) return;
    if (contagem <= 0) { window.location.href = destino; return; }
    const t = setTimeout(() => setContagem((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [contagem, destino]);

  async function criarSenha() {
    setErroSenha('');
    if (senha.length < 8) { setErroSenha('Use pelo menos 8 caracteres.'); return; }
    setSalvando(true);
    try {
      const { error } = await createClient().auth.updateUser({ password: senha, data: { senha_definida: true } });
      if (error) { setErroSenha('Não foi possível salvar. Tente uma senha diferente.'); return; }
      setSenhaOk(true);
    } finally { setSalvando(false); }
  }

  if (!pago) return null;
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
      {!senhaOk && (
        <div className="card" style={{ border: '1.5px solid var(--orange)' }}>
          <strong style={{ fontFamily: 'Outfit', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="lock" size={18} /> Crie uma senha para acessar depois</strong>
          <p className="muted" style={{ fontSize: 13.5, margin: '4px 0 10px' }}>Sua conta foi criada com o seu e-mail na hora da compra. Com uma senha, você acessa este e outros pedidos de qualquer aparelho.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo de 8 caracteres"
              style={{ flex: '1 1 200px', height: 44, borderRadius: 12, border: '1.5px solid var(--border)', padding: '0 14px', fontSize: 15 }} />
            <button type="button" className="btn btn-pri" disabled={salvando} onClick={criarSenha}>{salvando ? 'Salvando…' : 'Salvar senha'}</button>
          </div>
          {erroSenha && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>{erroSenha}</div>}
          <button type="button" className="muted" style={{ background: 'none', border: 'none', fontSize: 12.5, marginTop: 8, cursor: 'pointer', textDecoration: 'underline', padding: 0 }} onClick={() => setSenhaOk(true)}>Agora não</button>
        </div>
      )}
      {senhaOk && destino && (
        <div className="card" style={{ background: 'var(--green-bg)', border: '1px solid #BFE8D5', textAlign: 'center' }}>
          <strong style={{ fontFamily: 'Outfit', fontSize: 16 }}>Próximo passo da sua compra</strong>
          <p className="muted" style={{ fontSize: 13.5, margin: '4px 0 12px' }}>
            {contagem !== null && contagem > 0 ? `Levando você em ${contagem} s… O acesso ao produto continua aqui e no seu e-mail.` : 'O vendedor preparou uma página com as próximas instruções.'}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="btn btn-pri" href={destino} rel="noopener">Continuar <Icon name="arrowRight" size={16} /></a>
            {contagem !== null && contagem > 0 && <button type="button" className="btn btn-ghost" onClick={() => setContagem(null)}>Ficar nesta página</button>}
          </div>
        </div>
      )}
    </div>
  );
}
