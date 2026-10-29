'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

// Admin › Pedidos: o robô de recuperação (lembretes automáticos) e o botão para chamar quem ficou para trás.
type Status = { sql24: boolean; minutos: number; roboEm: string | null; whatsapp: { ativo: boolean; conectado: boolean }; antigos: { pedidos: number; carrinhos: number }; lembretes24h: number };

const ha = (iso: string | null) => {
  if (!iso) return null;
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 1 ? 'agora há pouco' : min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : `há ${Math.round(min / 1440)} dias`;
};

export default function RecuperacaoVendas() {
  const [s, setS] = useState<Status | null>(null);
  const [min, setMin] = useState('5');
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/recuperacao', { cache: 'no-store' });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setS(j); setMin(String(j.minutos));
    } catch { /* card some sem quebrar a aba */ }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    setSalvando(true);
    try {
      const r = await fetch('/api/admin/recuperacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'minutos', minutos: Number(min) }) });
      const j = await r.json().catch(() => ({}));
      toast(r.ok ? `1º lembrete: ${j.minutos} minutos depois do Pix.` : j.error || 'Não foi possível salvar.', r.ok ? 'success' : 'error');
    } finally { setSalvando(false); }
  }

  async function antigos() {
    const total = (s?.antigos.pedidos || 0) + (s?.antigos.carrinhos || 0);
    if (!confirm(`Mandar lembrete para até 12 dos ${total} clientes que ficaram para trás nos últimos 7 dias? Sai pelo WhatsApp conectado (só quem aceitou avisos) e por e-mail.`)) return;
    setEnviando(true);
    try {
      const r = await fetch('/api/admin/recuperacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'antigos' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) toast(j.error || 'Não foi possível enviar.', 'error');
      else toast(`${j.enviados} lembretes enviados${j.restantes ? `. Faltam ${j.restantes}: clique de novo daqui a alguns minutos.` : '. Ninguém ficou para trás.'}`, 'success');
      carregar();
    } finally { setEnviando(false); }
  }

  if (!s) return null;
  const roboOk = s.sql24 && s.roboEm && Date.now() - new Date(s.roboEm).getTime() < 10 * 60000;
  const antigosTotal = s.antigos.pedidos + s.antigos.carrinhos;
  const ponto = (ok: boolean) => <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: ok ? '#3DDC97' : '#FF5C5C', marginRight: 7 }} />;

  return (
    <div className="adm-card" style={{ marginBottom: 18 }}>
      <h3 className="adm-ct" style={{ marginBottom: 10 }}>Recuperação de vendas</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, fontSize: 13.5, marginBottom: 14 }}>
        <div>{ponto(!!roboOk)}<b>Robô automático</b><br /><small style={{ color: 'var(--sub)' }}>{!s.sql24 ? 'Desligado: falta rodar o SQL 24.' : roboOk ? `Rodando · última volta ${ha(s.roboEm)}` : `Parado${s.roboEm ? ` · última volta ${ha(s.roboEm)}` : ''}. Confira o SQL 24.`}</small></div>
        <div>{ponto(s.whatsapp.ativo && s.whatsapp.conectado)}<b>WhatsApp de avisos</b><br /><small style={{ color: 'var(--sub)' }}>{!s.whatsapp.ativo ? 'Desligado em Admin › WhatsApp. Só o e-mail sai.' : s.whatsapp.conectado ? 'Conectado. As mensagens saem por ele.' : 'Ligado, mas desconectado. Escaneie o QR Code de novo.'}</small></div>
        <div>{ponto(true)}<b>{s.lembretes24h} lembretes</b> nas últimas 24 h<br /><small style={{ color: 'var(--sub)' }}>Pix, carrinho e antigos</small></div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--sub)', margin: '0 0 12px', lineHeight: 1.55 }}>
        Como funciona: quando o cliente gera o Pix, recebe na hora o link e o código no WhatsApp. Se não pagar, recebe um lembrete depois do tempo abaixo e outro em 24 h.
        Quem se identificou no checkout e não gerou o Pix recebe o lembrete de carrinho. Quando paga, recebe a confirmação com o acesso e o caminho para falar com o vendedor no chat do pedido.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13.5, fontWeight: 700 }}>1º lembrete depois de
          <input type="number" min={3} max={120} value={min} onChange={(e) => setMin(e.target.value)} style={{ width: 70, margin: '0 6px', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--bd2)', background: 'var(--panel2)', color: 'var(--tx)' }} />minutos
        </label>
        <button className="adm-btn rp" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        <button className="adm-btn ap" disabled={enviando || !antigosTotal} onClick={antigos} style={{ marginLeft: 'auto' }}>
          {enviando ? 'Enviando… (até 1 min)' : antigosTotal ? `Chamar quem ficou para trás (${antigosTotal})` : 'Ninguém para trás nos últimos 7 dias'}
        </button>
      </div>
      {antigosTotal > 0 && <small style={{ display: 'block', marginTop: 8, color: 'var(--sub)' }}>{s.antigos.pedidos} Pix não pagos e {s.antigos.carrinhos} carrinhos dos últimos 7 dias. Vai de 12 em 12, com intervalo, para não bloquearem o número.</small>}
    </div>
  );
}
