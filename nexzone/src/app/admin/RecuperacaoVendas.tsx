'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import FilaRecuperacao from './FilaRecuperacao';
import type { ItemFila } from '@/lib/filaRecuperacao';

// Admin › Pedidos: o robô de recuperação (lembretes automáticos) e o botão para chamar quem ficou para trás.
// Fica recolhido num botão que mostra quantos há para recuperar; clicou, abre o painel completo com a fila (histórico por cliente).
type Status = { sql24: boolean; minutos: number; roboEm: string | null; whatsapp: { ativo: boolean; conectado: boolean }; antigos: { pedidos: number; carrinhos: number }; lembretes24h: number; fila?: ItemFila[]; sql26?: boolean; proximos?: { quem: string; produto: string }[] };

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
  const [aberto, setAberto] = useState(false);
  const [versao, setVersao] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/recuperacao?fila=1', { cache: 'no-store' });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setS(j); setMin(String(j.minutos)); setVersao((v) => v + 1);
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
    const nomes = (s?.proximos || []).map((p) => `• ${p.quem} (${p.produto})`).join('\n');
    if (!confirm(`Mandar lembrete para ${Math.min(12, total)} de ${total} clientes que ficaram para trás nos últimos 7 dias?\n\n${nomes}\n\nQuem desistiu ou foi chamado à mão nas últimas 24 h fica de fora. Sai pelo WhatsApp conectado (só quem aceitou avisos) e por e-mail.`)) return;
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
  // com a fila carregada, conta quem ainda está para chamar (sem quem desistiu ou já foi contatado)
  const paraChamar = s.fila ? s.fila.filter((i) => i.situacao === 'novo' || i.situacao === 'lembrado').length : antigosTotal;
  const ponto = (ok: boolean) => <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: ok ? '#3DDC97' : '#FF5C5C', marginRight: 7 }} />;

  const alerta = !roboOk || !(s.whatsapp.ativo && s.whatsapp.conectado);
  return (
    <div className="adm-card" id="recuperacao" style={{ marginBottom: 18, padding: aberto ? 22 : 0, overflow: 'hidden', scrollMarginTop: 80 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .rv-top{width:100%;display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:none;border:0;color:var(--tx);cursor:pointer;text-align:left;font-family:inherit}
        .rv-top:hover .rv-tit{color:var(--or2)}
        .rv-tit{font-family:'Outfit';font-weight:800;font-size:17px;transition:color .15s}
        .rv-qt{display:inline-flex;align-items:center;gap:6px;background:var(--grad);color:#fff;border-radius:50px;padding:5px 12px;font-weight:900;font-size:13px;animation:rvPulse 1.8s ease-in-out infinite}
        .rv-ok{color:var(--sub);font-size:13px;font-weight:700}
        .rv-av{color:#FFB020;font-size:12.5px;font-weight:800}
        .rv-sv{margin-left:auto;color:var(--sub);font-size:13px;font-weight:800;white-space:nowrap}
        @keyframes rvPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,122,20,.55)}50%{box-shadow:0 0 0 7px rgba(255,122,20,0)}}
        @media (prefers-reduced-motion:reduce){.rv-qt{animation:none}}
      ` }} />
      <button type="button" className="rv-top" onClick={() => setAberto(!aberto)} aria-expanded={aberto} style={{ padding: aberto ? '0 0 14px' : '16px 22px' }}>
        <span className="rv-tit">Recuperação de vendas</span>
        {paraChamar > 0
          ? <span className="rv-qt">{paraChamar} para recuperar</span>
          : <span className="rv-ok">{ponto(true)}Ninguém para trás nos últimos 7 dias</span>}
        {alerta && <span className="rv-av">⚠ {!roboOk ? 'Robô parado' : 'WhatsApp desconectado'}</span>}
        <span className="rv-sv">{aberto ? 'Fechar ▲' : paraChamar ? 'Abrir e chamar ▼' : 'Ver detalhes ▼'}</span>
      </button>
      {aberto && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, fontSize: 13.5, marginBottom: 14 }}>
        <div>{ponto(!!roboOk)}<b>Robô automático</b><br /><small style={{ color: 'var(--sub)' }}>{!s.sql24 ? 'Desligado: falta rodar o SQL 24.' : roboOk ? `Rodando · última volta ${ha(s.roboEm)}` : `Parado${s.roboEm ? ` · última volta ${ha(s.roboEm)}` : ''}. Confira o SQL 24.`}</small></div>
        <div>{ponto(s.whatsapp.ativo && s.whatsapp.conectado)}<b>WhatsApp de avisos</b><br /><small style={{ color: 'var(--sub)' }}>{!s.whatsapp.ativo ? 'Desligado. Só o e-mail sai.' : s.whatsapp.conectado ? 'Conectado. As mensagens saem por ele.' : 'Ligado, mas desconectado. Escaneie o QR Code de novo.'}</small>{!(s.whatsapp.ativo && s.whatsapp.conectado) && <><br /><a href="/admin?aba=torpedos" style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--or2)' }}>{s.whatsapp.ativo ? 'Reconectar o WhatsApp →' : 'Ligar e conectar o WhatsApp →'}</a></>}<small></small></div>
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
      {antigosTotal > 0 && <small style={{ display: 'block', marginTop: 8, color: 'var(--sub)' }}>{s.antigos.pedidos} Pix não pagos e {s.antigos.carrinhos} carrinhos dos últimos 7 dias. Vai de 12 em 12, com intervalo, para não bloquearem o número. Quem desistiu ou já foi chamado à mão nas últimas 24 h fica de fora.</small>}
      {s.fila && <FilaRecuperacao key={versao} itens={s.fila} sql26={!!s.sql26} onMudou={carregar} />}
      <small style={{ display: 'block', marginTop: 8, color: 'var(--sub)' }}>Cada vendedor também tem este painel em Vendas, só com os clientes da loja dele. Aqui você vê a plataforma inteira para acompanhar e ajudar quando precisar.</small>
      </>}
    </div>
  );
}
