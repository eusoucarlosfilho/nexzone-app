'use client';
import { TIPOS_ANUNCIO, PLANOS, TIPOS_CADASTRO, type TipoAnuncio, type Plano } from '@/lib/taxas';
import Icon from '@/components/Icon';

// Campos do modelo marketplace (SQL 21): tipo do anúncio + jogo, e o plano de visibilidade.
// Usados no cadastro e na edição do produto.

const ICONE: Record<TipoAnuncio, string> = { conta: 'user', item: 'gift', moeda: 'money', giftcard: 'key', servico: 'rocket', digital: 'file' };

export function CamposTipoJogo({ tipo, jogo, onTipo }: { tipo: TipoAnuncio; jogo: string; onTipo: (t: TipoAnuncio) => void; onJogo: (j: string) => void }) {
  const info = TIPOS_ANUNCIO.find((t) => t.id === tipo);
  return (
    <div className="ca">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <input type="hidden" name="tipo_anuncio" value={tipo} />
      {/* só Produto digital e Serviço; um anúncio antigo com outro tipo mostra o tipo dele para não mudar sozinho */}
      <div className="ca-tipos" role="radiogroup" aria-label="O que você vai vender">
        {(TIPOS_CADASTRO.includes(tipo) ? TIPOS_CADASTRO : [...TIPOS_CADASTRO, tipo]).map((id) => {
          const t = TIPOS_ANUNCIO.find((x) => x.id === id);
          if (!t) return null;
          return (
            <button type="button" key={t.id} role="radio" aria-checked={tipo === t.id} className={tipo === t.id ? 'on' : ''} onClick={() => onTipo(t.id)}>
              <Icon name={ICONE[t.id]} size={18} /><span>{t.nome}</span>
            </button>
          );
        })}
      </div>
      {info && <p className="ca-dica"><Icon name="info" size={14} /> {info.dica}</p>}
      {/* o jogo não é mais pedido aqui; o valor que o anúncio já tinha é mantido */}
      <input type="hidden" name="jogo" value={jogo} readOnly />
      {tipo === 'conta' && (
        <div role="note" className="ca-alerta"><Icon name="shield" size={15} /><span><b>Venda de conta:</b> entregue pelo chat do pedido e oriente o comprador a trocar e-mail e senha na hora. O valor fica retido por mais tempo (proteção contra recuperação da conta).</span></div>
      )}
    </div>
  );
}

export function EscolhaPlano({ valor, onPlano, pcts, ativos, nome = 'plano' }: { valor: Plano; onPlano: (p: Plano) => void; pcts: { basico: number; destaque: number; topo: number }; ativos: boolean; nome?: string }) {
  const fmt = (n: number) => `${String(n).replace('.', ',')}%`;
  return (
    <div className="ca">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <input type="hidden" name={nome} value={ativos ? valor : 'basico'} />
      {!ativos && <p className="ca-dica"><Icon name="rocket" size={14} /> Lançamento: enquanto a vitrine está sendo montada, todos os anúncios ficam no plano Básico ({fmt(pcts.basico)}) e aparecem para todo mundo. Destaque e Topo serão liberados em breve.</p>}
      <div className="ca-planos" role="radiogroup" aria-label="Plano do anúncio">
        {PLANOS.map((p) => {
          const bloqueado = !ativos && p.id !== 'basico';
          const sel = (ativos ? valor : 'basico') === p.id;
          return (
            <button type="button" key={p.id} role="radio" aria-checked={sel} disabled={bloqueado} className={`${sel ? 'on' : ''} ${p.id}`} onClick={() => onPlano(p.id)}>
              <span className="ca-pn">{p.nome}{bloqueado && <small> · em breve</small>}</span>
              <b>{fmt(pcts[p.id])}</b>
              <span className="ca-pr">{p.resumo}</span>
            </button>
          );
        })}
      </div>
      <p className="ui-help">A taxa do plano é descontada só quando você vende. Você pode trocar de plano quando quiser, sem nova revisão.</p>
    </div>
  );
}

const CSS = `
.ca-grupo{margin-bottom:10px}
.ca-gt{display:block;font-size:11.5px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;color:var(--muted);margin:0 0 6px}
.ca-tipos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ca-tipos button{display:flex;align-items:center;gap:8px;min-height:52px;padding:10px 12px;border-radius:14px;border:1.5px solid var(--border2);background:#fff;color:var(--text);font-weight:800;font-size:13.5px;cursor:pointer;text-align:left;font-family:inherit}
.ca-tipos button svg{color:var(--orange-ink);flex:none}
.ca-tipos button.on{border-color:var(--orange);background:var(--soft);box-shadow:0 0 0 3px rgba(255,107,0,.12)}
.ca-dica{display:flex;gap:6px;align-items:flex-start;color:var(--sub);font-size:12.5px;margin:10px 0 0;line-height:1.45}
.ca-dica svg{flex:none;margin-top:2px;color:var(--orange-ink)}
.ca-alerta{display:flex;gap:8px;align-items:flex-start;background:#FFF6E5;border:1px solid #FFD98A;color:#6B4600;border-radius:12px;padding:10px 12px;font-size:12.5px;line-height:1.45;margin-top:10px}
.ca-alerta svg{flex:none;margin-top:1px}
.ca-planos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
.ca-planos button{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:14px;border-radius:16px;border:1.5px solid var(--border2);background:#fff;color:var(--text);cursor:pointer;text-align:left;font-family:inherit;min-height:120px}
.ca-planos button:disabled{opacity:.55;cursor:not-allowed}
.ca-planos button.on{border-color:var(--orange);background:var(--soft);box-shadow:0 0 0 3px rgba(255,107,0,.12)}
.ca-planos button.topo.on{background:linear-gradient(135deg,#FFF2E8,#FFE3CC)}
.ca-pn{font-family:Outfit;font-weight:900;font-size:15px}
.ca-pn small{font-family:inherit;font-weight:700;color:var(--muted);font-size:11.5px}
.ca-planos b{font-family:Outfit;font-size:24px;font-weight:900;color:#E85F00;line-height:1.1}
.ca-pr{color:var(--sub);font-size:12px;line-height:1.4}
@media(max-width:620px){.ca-tipos{grid-template-columns:repeat(2,minmax(0,1fr))}.ca-planos{grid-template-columns:minmax(0,1fr)}.ca-planos button{min-height:0}}
`;
