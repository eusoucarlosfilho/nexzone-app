import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/Icon';
import JourneyBadge from '@/components/JourneyBadge';
import { TIERS, computeJourney, getStoreRevenue, brl, brlCompact } from '@/lib/journey';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Jornada de faturamento — Comprei Barato' };

const CSS = `
.jn-hero{position:relative;overflow:hidden;border-radius:26px;padding:30px;display:flex;gap:28px;align-items:center;flex-wrap:wrap;
  background:radial-gradient(120% 140% at 0% 0%,#2A2550 0%,#16162A 55%,#0D0D1A 100%);color:#fff;box-shadow:0 22px 44px rgba(22,22,42,.18);animation:cb-up .55s var(--ease) both;}
.jn-hero::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.55;
  background-image:radial-gradient(1.4px 1.4px at 12% 20%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 30% 70%,#fff 50%,transparent 51%),
  radial-gradient(1.2px 1.2px at 55% 15%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 72% 60%,#fff 50%,transparent 51%),
  radial-gradient(1.6px 1.6px at 88% 25%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 92% 82%,#fff 50%,transparent 51%),
  radial-gradient(1.1px 1.1px at 45% 88%,#fff 50%,transparent 51%);}
.jn-hero > *{position:relative;}
.jn-kicker{font-size:12px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;color:#FFB36B;}
.jn-big{font-family:'Outfit';font-size:clamp(28px,5vw,40px);font-weight:900;letter-spacing:-1px;line-height:1.1;margin:6px 0 4px;}
.jn-sub{color:rgba(255,255,255,.72);font-size:14px;}
.jn-bar{height:14px;border-radius:50px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:18px;border:1px solid rgba(255,255,255,.12);}
.jn-bar .fill{height:100%;border-radius:50px;background:linear-gradient(90deg,#FF6B00,#FFC46B);transform-origin:left;animation:cb-growx 1.2s var(--ease) both;}
.jn-barlbl{display:flex;justify-content:space-between;gap:10px;font-size:12px;font-weight:800;color:rgba(255,255,255,.7);margin-top:8px;flex-wrap:wrap;}
.jn-line{position:relative;margin-top:26px;display:flex;flex-direction:column;gap:14px;}
.jn-line::before{content:"";position:absolute;left:39px;top:20px;bottom:20px;width:3px;border-radius:3px;background:var(--border2);}
.jn-step{position:relative;display:flex;gap:18px;align-items:center;background:#fff;border:1px solid #EDE6DF;border-radius:20px;padding:16px 18px;animation:cb-up .5s var(--ease) both;}
.jn-step.on{border-color:transparent;box-shadow:0 12px 28px rgba(22,22,42,.08);}
.jn-step.next{border:2px dashed var(--orange);}
.jn-step .bd{width:46px;display:flex;justify-content:center;flex-shrink:0;}
.jn-step h3{font-family:'Outfit';font-size:17px;font-weight:900;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.jn-step p{color:var(--sub);font-size:13.5px;margin-top:3px;}
.jn-meta{font-family:'Outfit';font-weight:900;font-size:15px;white-space:nowrap;text-align:right;}
.jn-pill{display:inline-flex;align-items:center;gap:5px;font-family:inherit;font-size:11px;font-weight:900;padding:4px 9px;border-radius:50px;letter-spacing:.2px;}
.jn-pill.placa{background:var(--yellow-bg);color:var(--yellow);}
.jn-pill.ok{background:var(--green-bg);color:var(--green);}
.jn-pill.go{background:var(--soft);color:var(--orange-ink);}
.jn-how{display:flex;gap:12px;align-items:flex-start;margin-top:22px;}
@media(max-width:620px){
  .jn-hero{padding:22px;gap:18px;justify-content:center;text-align:center;}
  .jn-barlbl{justify-content:center;}
  .jn-step{flex-wrap:wrap;gap:12px;padding:14px;}
  .jn-step .txt{flex:1 1 calc(100% - 70px);}
  .jn-meta{width:100%;text-align:left;padding-left:58px;}
  .jn-line::before{left:36px;}
}
@media (prefers-reduced-motion: reduce){.jn-hero,.jn-step,.jn-bar .fill{animation:none;}}
`;

export default async function JornadaPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: store } = await supabase.from('stores').select('id, nome').eq('owner', user.id).maybeSingle();

  if (!store) {
    return (
      <div>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900 }}>Jornada de faturamento</h1>
        <p className="muted" style={{ marginTop: 6 }}>Cadastre seu primeiro produto para criar sua loja e começar a jornada rumo às estrelas.</p>
        <Link href="/vender/produtos" className="btn btn-pri" style={{ marginTop: 18, display: 'inline-block' }}>Cadastrar meu primeiro produto</Link>
      </div>
    );
  }

  const { faturamento, vendas, marcos } = await getStoreRevenue(supabase, store.id);
  const j = computeJourney(faturamento, vendas);
  const conquistadosIds = new Set(j.conquistados.map((t) => t.id));
  const pct = Math.round(j.progresso * 100);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 900, letterSpacing: '-.6px' }}>Jornada de faturamento</h1>
        <p className="muted">Rumo às estrelas: cada selo marca uma nova fase da sua loja.</p>
      </div>

      <section className="jn-hero" aria-label="Seu selo atual">
        <JourneyBadge tierId={j.atual?.id ?? 'estreia'} size={140} locked={!j.atual} animate={!!j.atual} />
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div className="jn-kicker">{j.atual ? `Selo atual: ${j.atual.nome}` : 'Sua jornada começa aqui'}</div>
          <div className="jn-big">Você faturou {brl(faturamento)}</div>
          <div className="jn-sub">{vendas} {vendas === 1 ? 'venda paga' : 'vendas pagas'} · {j.conquistados.length} de {TIERS.length} selos conquistados</div>

          {j.proximo ? (
            <>
              <div className="jn-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
                aria-label={`Progresso até o selo ${j.proximo.nome}`}>
                <div className="fill" style={{ width: `${j.proximo.id === 'estreia' ? 0 : Math.max(2, pct)}%` }} />
              </div>
              <div className="jn-barlbl">
                <span>
                  {j.proximo.id === 'estreia'
                    ? 'Faça sua primeira venda para conquistar o selo Estreia'
                    : `Faltam ${brl(j.falta)} para o selo ${j.proximo.nome}`}
                </span>
                {j.proximo.id !== 'estreia' && <span>{pct}%</span>}
              </div>
            </>
          ) : (
            <div className="jn-barlbl" style={{ marginTop: 16, color: '#F5D77A' }}>Você conquistou todos os selos. Lenda é pouco.</div>
          )}
        </div>
      </section>

      <h2 style={{ fontFamily: 'Outfit', fontSize: 19, fontWeight: 900, marginTop: 30 }}>Todos os selos</h2>
      <ol className="jn-line" style={{ listStyle: 'none', padding: 0 }}>
        {TIERS.map((t, i) => {
          const on = conquistadosIds.has(t.id);
          const next = j.proximo?.id === t.id;
          const quando = marcos[t.id];
          return (
            <li key={t.id} className={`jn-step ${on ? 'on' : ''} ${next ? 'next' : ''}`} style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="bd"><JourneyBadge tierId={t.id} size={46} locked={!on} /></div>
              <div className="txt" style={{ flex: 1, minWidth: 0 }}>
                <h3>
                  {t.nome}
                  {on && <span className="jn-pill ok"><Icon name="check" size={12} /> Conquistado</span>}
                  {next && <span className="jn-pill go"><Icon name="rocket" size={12} /> Próximo</span>}
                  {t.placa && <span className="jn-pill placa"><Icon name="award" size={12} /> Placa física em breve</span>}
                </h3>
                <p>{t.descricao}</p>
                {on && quando && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Conquistado em {new Date(quando).toLocaleDateString('pt-BR')}</p>}
              </div>
              <div className="jn-meta" style={{ color: on ? 'var(--green)' : 'var(--muted)' }}>
                {t.id === 'estreia' ? '1ª venda' : brlCompact(t.meta)}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="card jn-how">
        <Icon name="info" size={20} style={{ color: 'var(--orange-ink)', marginTop: 2 }} />
        <div>
          <strong style={{ fontFamily: 'Outfit' }}>Como o faturamento é contado</strong>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Somamos o valor total (bruto) de todas as vendas pagas da sua loja. Pedidos pendentes, cancelados e reembolsados não entram na conta.
            Se uma venda for reembolsada, o valor dela sai do total.
          </p>
        </div>
      </div>
    </div>
  );
}
