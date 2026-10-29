'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import AtivarCelular from './AtivarCelular';
import { gruposPara, opcaoLigada, type OpcaoNotif } from '@/lib/notifPreferencias';

// Central de notificações: liga e desliga, tipo por tipo, o que toca na tela do celular.
// O sino do site continua guardando tudo, para nada se perder.
export default function CentralNotificacoes() {
  const [d, setD] = useState<{ sql23: boolean; admin: boolean; vendedor: boolean } | null>(null);
  const [desligados, setDesligados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/notificacoes/preferencias', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      setD({ sql23: !!j.sql23, admin: !!j.admin, vendedor: !!j.vendedor });
      setDesligados(new Set(j.desligados || []));
    }).catch(() => setD({ sql23: false, admin: false, vendedor: false }));
  }, []);

  async function alternar(o: OpcaoNotif) {
    if (o.fixo) return;
    const ligar = !opcaoLigada(o, desligados);
    setSalvando(o.id);
    const antes = desligados;
    const novo = new Set(desligados); o.tipos.forEach((t) => (ligar ? novo.delete(t) : novo.add(t)));
    setDesligados(novo);
    try {
      const r = await fetch('/api/notificacoes/preferencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipos: o.tipos, celular: ligar }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setDesligados(antes); toast(j.error || 'Não foi possível salvar.', 'error'); return; }
      toast(ligar ? `"${o.rotulo}" ligado no celular.` : `"${o.rotulo}" desligado no celular. Continua no sino.`, 'success');
    } catch { setDesligados(antes); toast('Sem conexão. Tente de novo.', 'error'); }
    finally { setSalvando(null); }
  }

  return (
    <div className="cn">
      <style dangerouslySetInnerHTML={{ __html: `
        .cn-g{background:#fff;border:1px solid var(--border);border-radius:18px;padding:6px 18px;margin-bottom:16px}
        .cn-g h3{font-family:'Outfit';font-weight:800;font-size:16px;margin:12px 0 4px}
        .cn-o{display:flex;align-items:center;gap:14px;padding:13px 0;border-top:1px solid var(--border)}
        .cn-g h3+.cn-o{border-top:none}
        .cn-o .tx{flex:1;min-width:0}
        .cn-o b{display:block;font-size:14.5px;color:var(--text)}
        .cn-o small{display:block;font-size:12.5px;color:var(--muted);line-height:1.45;margin-top:2px}
        .cn-sw{position:relative;width:48px;height:28px;flex:none;border-radius:50px;border:none;cursor:pointer;background:#D9D4CE;transition:background .2s}
        .cn-sw::after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}
        .cn-sw.on{background:#FF6B00}
        .cn-sw.on::after{transform:translateX(20px)}
        .cn-sw:disabled{opacity:.6;cursor:default}
        .cn-aviso{background:#FFF1E6;border:1px solid #FFB067;border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:13.5px}
        .cn-lead{color:var(--muted);font-size:14px;margin:0 0 14px}
      ` }} />

      <AtivarCelular />
      <p className="cn-lead">Escolha o que toca na tela do celular. Tudo continua aparecendo no sino do site, então nada se perde quando você desliga.</p>

      {!d ? <p className="muted">Carregando…</p> : (
        <>
          {!d.sql23 && <div className="cn-aviso">A central ainda não está ativa no banco (falta rodar o SQL 23). Por enquanto todos os avisos ficam ligados.</div>}
          {gruposPara(d).map((g) => (
            <section key={g.id} className="cn-g" aria-label={g.titulo}>
              <h3>{g.titulo}</h3>
              {g.opcoes.map((o) => {
                const on = opcaoLigada(o, desligados);
                return (
                  <div key={o.id} className="cn-o">
                    <span className="tx"><b>{o.rotulo}</b><small>{o.descricao}</small></span>
                    <button type="button" role="switch" aria-checked={on} aria-label={o.rotulo}
                      className={`cn-sw ${on ? 'on' : ''}`} disabled={!!o.fixo || salvando === o.id || !d.sql23} onClick={() => alternar(o)} />
                  </div>
                );
              })}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
