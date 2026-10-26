'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { lerPrefs, PREFS_PADRAO, type Prefs } from '@/lib/notifPrefs';

// Sino de notificações do vendedor.
// - Lista recente de /api/seller/notifications (perguntas, mensagens, pedidos registrados).
// - "Não lidas" = itens mais novos que o último "visto até", guardado NESTE navegador.
//   Sem tabela no banco nesta etapa: em outro aparelho o contador recomeça.
// - Atualiza a cada 60 s só com a aba visível.

const CHAVE = 'cb_sino_visto_ate';
const INTERVALO = 60000;
type Item = { id: string; tipo: 'pergunta' | 'mensagem' | 'pedido'; titulo: string; texto: string; href: string; em: string };
const ICONE: Record<Item['tipo'], string> = { pergunta: 'help', mensagem: 'chat', pedido: 'receipt' };

function lerVisto(): string {
  try { return localStorage.getItem(CHAVE) || ''; } catch { return ''; }
}
function gravarVisto(v: string) {
  try { localStorage.setItem(CHAVE, v); } catch {}
}
function quando(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

export default function SellerBell() {
  const [itens, setItens] = useState<Item[]>([]);
  const [visto, setVisto] = useState('');
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(PREFS_PADRAO);
  const caixa = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/seller/notifications', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) { setErro(true); return; }
      const d = await r.json();
      setItens(Array.isArray(d.itens) ? d.itens : []); setErro(false);
    } catch { setErro(true); }
  }, []);

  useEffect(() => {
    setVisto(lerVisto());
    setPrefs(lerPrefs());
    const aoPrefs = () => setPrefs(lerPrefs());
    window.addEventListener('cb-notif-prefs', aoPrefs);
    let t: ReturnType<typeof setInterval> | null = null;
    const iniciar = () => { if (t) return; carregar(); t = setInterval(carregar, INTERVALO); };
    const parar = () => { if (t) { clearInterval(t); t = null; } };
    const aoMudar = () => (document.visibilityState === 'visible' ? iniciar() : parar());
    aoMudar();
    document.addEventListener('visibilitychange', aoMudar);
    return () => { parar(); document.removeEventListener('visibilitychange', aoMudar); window.removeEventListener('cb-notif-prefs', aoPrefs); };
  }, [carregar]);

  // Fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);

  const visiveis = itens.filter((i) => prefs[i.tipo]);
  const naoLidas = visiveis.filter((i) => !visto || i.em > visto).length;

  function alternar() {
    const abrir = !aberto;
    setAberto(abrir);
    if (abrir && visiveis.length) { const v = visiveis[0].em; gravarVisto(v); setTimeout(() => setVisto(v), 1500); }
  }

  return (
    <div className="bell" ref={caixa}>
      <button type="button" className="bell-btn" onClick={alternar} aria-expanded={aberto} aria-haspopup="true"
        aria-label={naoLidas ? `Notificações: ${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'Notificações'}>
        <Icon name="bell" size={20} />
        {naoLidas > 0 && <span className="bell-dot" aria-hidden="true">{naoLidas > 9 ? '9+' : naoLidas}</span>}
      </button>
      {aberto && (
        <div className="bell-pop" role="dialog" aria-label="Notificações recentes">
          <div className="bell-head"><strong>Notificações</strong><small>últimos 7 dias</small></div>
          {erro && <p className="bell-vazio">Não foi possível atualizar agora.</p>}
          {!erro && visiveis.length === 0 && <p className="bell-vazio">Nada novo por aqui.</p>}
          <ul>
            {visiveis.map((i) => (
              <li key={i.id} className={!visto || i.em > visto ? 'nova' : ''}>
                <Link href={i.href} onClick={() => setAberto(false)}>
                  <span className="bell-ic" aria-hidden="true"><Icon name={ICONE[i.tipo]} size={16} /></span>
                  <span className="bell-txt"><b>{i.titulo}</b><span>{i.texto}</span><small>{quando(i.em)}</small></span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="bell-foot"><Link href="/vender/notificacoes" onClick={() => setAberto(false)}>Preferências de notificação</Link></div>
        </div>
      )}
    </div>
  );
}
