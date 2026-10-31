'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { toast } from '@/lib/toast';
import { trackEvento } from '@/lib/rastreio-cliente';
import { ROTULO_STATUS, textoConvite, type StatusIndicacao } from '@/lib/indicacao';

const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');

export default function IndicacoesCliente() {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/indicacao', { cache: 'no-store' }).then((r) => r.json().then((j) => ({ ok: r.ok, j }))).then(({ ok, j }) => (ok ? setD(j) : setErro(j.error || 'Falha ao carregar.'))).catch(() => setErro('Sem conexão.'));
  }, []);
  if (erro) return <div className="card"><p className="muted" style={{ margin: 0 }}>{erro}</p></div>;
  if (!d) return <div className="card"><p className="muted" style={{ margin: 0 }}>Carregando…</p></div>;
  if (!d.sql37) return <div className="card"><p className="muted" style={{ margin: 0 }}>O programa de indicação ainda não está disponível.</p></div>;

  const ativo = d.cfg?.ativo && d.cfg?.pontos > 0;
  const copiar = async () => { try { await navigator.clipboard.writeText(d.link); toast('Link copiado!', 'success'); } catch { toast('Copie o link manualmente.', 'error'); } trackEvento('indicacao_compartilhar', { canal: 'copiar' }); };
  const whats = () => { trackEvento('indicacao_compartilhar', { canal: 'whatsapp' }); window.open(`https://wa.me/?text=${encodeURIComponent(textoConvite(d.link))}`, '_blank', 'noopener'); };
  const outras = async () => {
    trackEvento('indicacao_compartilhar', { canal: 'outro' });
    if (navigator.share) { try { await navigator.share({ title: 'Comprei Barato', text: textoConvite(''), url: d.link }); } catch {} } else copiar();
  };

  return (
    <div className="ind">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="ind-link">
        <small>Seu link pessoal</small>
        <div className="ind-url"><span>{d.link}</span><button type="button" onClick={copiar}><Icon name="copy" size={16} /> Copiar</button></div>
        <div className="ind-btns">
          <button type="button" className="btn btn-pri" onClick={whats}><Icon name="phone" size={16} /> Enviar no WhatsApp</button>
          <button type="button" className="btn btn-ghost" onClick={outras}><Icon name="share" size={16} /> Outras redes</button>
        </div>
        {d.bloqueado && <p className="ind-alerta">Seu link está em análise pela equipe e, por enquanto, não gera recompensas.</p>}
        <p className="ind-regra">
          {ativo
            ? <>Você ganha <b>{fmt(d.cfg.pontos)} CB Points</b> quando um amigo <b>novo</b> fizer a primeira compra{d.cfg.minimo > 0 ? <> de pelo menos <b>R$ {Number(d.cfg.minimo).toFixed(2).replace('.', ',')}</b></> : ''}. Os pontos são liberados {d.cfg.prazoDias} dia(s) depois da compra, se ela não for reembolsada.{d.cfg.fim ? ` Campanha válida até ${dia(d.cfg.fim)}.` : ''}</>
            : <>As recompensas por indicação estão pausadas no momento. Seu link continua funcionando e as visitas aparecem aqui.</>}
        </p>
      </section>

      <section className="ind-nums" aria-label="Seus números">
        <div><b>{fmt(d.visitas)}</b><small>visitas pelo seu link</small></div>
        <div><b>{fmt(d.cadastros)}</b><small>amigos cadastrados</small></div>
        <div><b>{fmt(d.compras)}</b><small>primeiras compras</small></div>
        <div><b>{fmt(d.pontosPendentes)}</b><small>pontos em liberação</small></div>
        <div className="ok"><b>{fmt(d.pontosLiberados)}</b><small>pontos liberados</small></div>
      </section>

      <section className="card">
        <h2 className="ind-h">Histórico</h2>
        {!d.historico.length ? <p className="muted" style={{ margin: 0 }}>Nenhum amigo cadastrado pelo seu link ainda.</p> : (
          <ul className="ind-hist">
            {d.historico.map((h: any) => (
              <li key={h.n}><span><b>Amigo #{h.n}</b><small>cadastro em {dia(h.criado_em)}</small></span>
                <span className={`ind-st s-${h.status}`}>{ROTULO_STATUS[h.status as StatusIndicacao] || h.status}{h.status === 'pendente' && h.libera_em ? ` · libera em ${dia(h.libera_em)}` : ''}{h.status === 'liberada' && h.pontos ? ` · +${fmt(h.pontos)}` : ''}</span></li>
            ))}
          </ul>
        )}
        <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>Por privacidade, os amigos aparecem sem nome. Não vale indicar a si mesmo nem criar contas para ganhar pontos: indicações suspeitas são analisadas e podem ser canceladas. Veja seus pontos em <Link href="/cb-points">CB Points</Link>.</p>
      </section>
    </div>
  );
}

const CSS = `
.ind{display:flex;flex-direction:column;gap:14px}
.ind-link{background:#0B0B0C;color:#fff;border-radius:18px;padding:20px}
.ind-link small{color:#FFC83D;font-weight:800;text-transform:uppercase;letter-spacing:.6px;font-size:12px}
.ind-url{display:flex;gap:8px;align-items:center;background:#1C1C1F;border-radius:12px;padding:6px 6px 6px 14px;margin:8px 0 12px}
.ind-url span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.ind-url button{display:flex;gap:6px;align-items:center;border:0;background:#FF7A00;color:#0B0B0C;font-weight:800;border-radius:10px;padding:9px 14px;cursor:pointer}
.ind-btns{display:flex;gap:8px;flex-wrap:wrap}.ind-btns .btn-ghost{color:#fff!important;background:transparent!important;border:1px solid #52525B!important}
.ind-regra{color:#D4D4D8;font-size:13px;line-height:1.55;margin:12px 0 0}.ind-regra b{color:#fff}
.ind-alerta{background:#3B2A10;color:#FFC83D;border-radius:10px;padding:8px 12px;font-size:13px;margin:12px 0 0}
.ind-nums{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.ind-nums div{background:#fff;border:1px solid var(--line,#e4e4e7);border-radius:14px;padding:12px}
.ind-nums b{display:block;font-family:Outfit;font-size:24px}.ind-nums small{color:var(--muted,#71717a);font-size:12px}.ind-nums .ok b{color:#16A34A}
.ind-h{font-family:Outfit;font-size:18px;font-weight:900;margin:0 0 10px}
.ind-hist{list-style:none;margin:0;padding:0}.ind-hist li{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line,#e4e4e7)}
.ind-hist small{display:block;color:var(--muted,#71717a);font-size:12px}
.ind-st{font-size:12px;font-weight:800;border-radius:999px;padding:4px 10px;background:#F4F4F5;text-align:right}
.ind-st.s-pendente{background:#FFF1E6;color:#B45309}.ind-st.s-liberada{background:#E8F7EE;color:#15803D}.ind-st.s-estornada,.ind-st.s-cancelada{background:#FEE2E2;color:#B91C1C}
@media(max-width:700px){.ind-nums{grid-template-columns:repeat(2,1fr)}}
`;
