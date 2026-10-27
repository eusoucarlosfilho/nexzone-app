'use client';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { ICONE_TIPO, quandoFoi, type Notificacao } from '@/lib/notificacoesCentral';

// Sino de notificações do usuário (SQL 17), no topo do site.
// Um único "carregador" é compartilhado por todos os sinos da página (computador + celular),
// então a página faz no máximo 1 consulta a cada 45 s, e só com a aba visível.

type Estado = { carregado: boolean; sql17: boolean; itens: Notificacao[]; naoLidas: number; erro: boolean };
let estado: Estado = { carregado: false, sql17: true, itens: [], naoLidas: 0, erro: false };
const ouvintes = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let buscando: Promise<void> | null = null;
const INTERVALO = 45000;

function publicar(p: Partial<Estado>) { estado = { ...estado, ...p }; ouvintes.forEach((f) => f()); }

export function atualizarNotificacoes(): Promise<void> {
  if (buscando) return buscando;
  buscando = (async () => {
    try {
      const r = await fetch('/api/notificacoes?limite=12', { credentials: 'include', cache: 'no-store' });
      if (r.status === 401) { publicar({ carregado: true, sql17: false, itens: [], naoLidas: 0 }); return; }
      if (!r.ok) { publicar({ carregado: true, erro: true }); return; }
      const d = await r.json();
      publicar({ carregado: true, erro: false, sql17: d.sql17 !== false, itens: d.itens ?? [], naoLidas: d.naoLidas ?? 0 });
      window.dispatchEvent(new CustomEvent('cb-notificacoes', { detail: { naoLidas: d.naoLidas ?? 0 } }));
    } catch { publicar({ carregado: true, erro: true }); }
    finally { buscando = null; }
  })();
  return buscando;
}

export async function marcarLidas(ids: number[] | 'todas') {
  // otimista: some o número na hora
  const agora = new Date().toISOString();
  const set = ids === 'todas' ? null : new Set(ids);
  const itens = estado.itens.map((i) => (!i.lida_em && (!set || set.has(i.id)) ? { ...i, lida_em: agora } : i));
  const baixa = ids === 'todas' ? estado.naoLidas : estado.itens.filter((i) => !i.lida_em && set!.has(i.id)).length;
  publicar({ itens, naoLidas: Math.max(0, estado.naoLidas - baixa) });
  try {
    const r = await fetch('/api/notificacoes', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids === 'todas' ? { acao: 'ler_todas' } : { acao: 'ler', ids }),
    });
    const d = await r.json().catch(() => ({}));
    if (typeof d.naoLidas === 'number') publicar({ naoLidas: d.naoLidas });
    window.dispatchEvent(new CustomEvent('cb-notificacoes', { detail: { naoLidas: estado.naoLidas } }));
  } catch { /* na próxima atualização acerta */ }
}

function assinar(f: () => void) {
  ouvintes.add(f);
  if (ouvintes.size === 1) {
    const iniciar = () => { if (!timer) { atualizarNotificacoes(); timer = setInterval(atualizarNotificacoes, INTERVALO); } };
    const parar = () => { if (timer) { clearInterval(timer); timer = null; } };
    const aoMudar = () => (document.visibilityState === 'visible' ? iniciar() : parar());
    (assinar as any).aoMudar = aoMudar;
    document.addEventListener('visibilitychange', aoMudar);
    window.addEventListener('focus', atualizarNotificacoes);
    aoMudar();
  }
  return () => {
    ouvintes.delete(f);
    if (ouvintes.size === 0) {
      if (timer) { clearInterval(timer); timer = null; }
      document.removeEventListener('visibilitychange', (assinar as any).aoMudar);
      window.removeEventListener('focus', atualizarNotificacoes);
    }
  };
}
const ESTADO_SERVIDOR: Estado = { carregado: false, sql17: true, itens: [], naoLidas: 0, erro: false };
export function useNotificacoes(): Estado {
  return useSyncExternalStore(assinar, () => estado, () => ESTADO_SERVIDOR);
}

export default function NotificacoesSino({ className = '', fallback = null, somenteFallback = false }: { className?: string; fallback?: ReactNode; somenteFallback?: boolean }) {
  const s = useNotificacoes();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!aberto) return;
    atualizarNotificacoes();
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);

  // Sem o SQL 17: mostra o sino antigo (se houver) ou nada
  if (s.carregado && !s.sql17) return <>{fallback}</>;
  if (somenteFallback) return null; // o sino novo já aparece no topo do site

  function abrirItem(n: Notificacao) {
    setAberto(false);
    if (!n.lida_em) marcarLidas([n.id]);
    if (n.link) router.push(n.link);
    else router.push('/notificacoes');
  }

  const n = s.naoLidas;
  return (
    <div className={`bell nsino ${className}`} ref={caixa}>
      <button type="button" className="bell-btn" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-haspopup="true"
        aria-label={n ? `Notificações: ${n} não lida${n > 1 ? 's' : ''}` : 'Notificações'} title="Notificações">
        <Icon name="bell" size={20} />
        {n > 0 && <span className="bell-dot" aria-hidden="true">{n > 99 ? '99+' : n}</span>}
      </button>
      {aberto && (
        <div className="bell-pop" role="dialog" aria-label="Notificações">
          <div className="bell-head">
            <strong>Notificações</strong>
            {n > 0
              ? <button type="button" className="nsino-all" onClick={() => marcarLidas('todas')}>Marcar todas como lidas</button>
              : <small>{s.carregado ? 'tudo em dia' : ''}</small>}
          </div>
          {!s.carregado && <p className="bell-vazio">Carregando…</p>}
          {s.carregado && s.erro && s.itens.length === 0 && <p className="bell-vazio">Não foi possível atualizar agora.</p>}
          {s.carregado && !s.erro && s.itens.length === 0 && (
            <div className="nsino-vazio"><Icon name="bell" size={26} /><b>Nada por aqui ainda</b><span>Suas vendas, compras, mensagens e avisos da equipe aparecem aqui.</span></div>
          )}
          <ul>
            {s.itens.map((i) => (
              <li key={i.id} className={i.lida_em ? '' : 'nova'}>
                <button type="button" className="nsino-item" onClick={() => abrirItem(i)}>
                  <span className={`bell-ic t-${i.tipo}`} aria-hidden="true"><Icon name={ICONE_TIPO[i.tipo] || 'bell'} size={16} /></span>
                  <span className="bell-txt"><b>{i.titulo}</b>{i.texto && <span>{i.texto}</span>}<small>{quandoFoi(i.created_at)}</small></span>
                  {!i.lida_em && <i className="nsino-ponto" aria-label="não lida" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="bell-foot nsino-foot">
            <Link href="/notificacoes" onClick={() => setAberto(false)}>Ver todas as notificações</Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Número de não lidas, para o menu do celular */
export function ContadorNotificacoes() {
  const s = useNotificacoes();
  if (!s.naoLidas) return null;
  return <span className="mm-badge">{s.naoLidas > 99 ? '99+' : s.naoLidas}</span>;
}
