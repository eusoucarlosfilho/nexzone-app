'use client';
import { useEffect, useState } from 'react';
import { lerPrefs, gravarPrefs, PREFS_PADRAO, type Prefs, type TipoNotif } from '@/lib/notifPrefs';

// Preferências (neste navegador) + preparação para notificações no celular.
// O envio real (Web Push) NÃO está ativo nesta versão: o botão fica desabilitado e
// esta página NÃO pede permissão de notificação ao navegador.

type Ambiente = {
  ios: boolean; android: boolean; instalado: boolean;
  temNotification: boolean; permissao: string; temSW: boolean; temPush: boolean;
};

const ROTULOS: Record<TipoNotif, { t: string; d: string }> = {
  pergunta: { t: 'Perguntas sem resposta', d: 'Quando um comprador pergunta algo em um produto seu.' },
  mensagem: { t: 'Mensagens de clientes', d: 'Quando um comprador escreve na conversa de um pedido.' },
  pedido: { t: 'Pedidos registrados', d: 'Quando um pedido é registrado na sua loja. Confira sempre o status em Vendas antes de entregar.' },
};

function detectar(): Ambiente {
  const ua = navigator.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  const instalado = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  const temNotification = 'Notification' in window;
  return {
    ios, android: /android/i.test(ua), instalado,
    temNotification, permissao: temNotification ? Notification.permission : 'indisponível',
    temSW: 'serviceWorker' in navigator, temPush: 'PushManager' in window,
  };
}

const PERMISSAO: Record<string, string> = {
  default: 'ainda não perguntada', granted: 'permitida', denied: 'bloqueada', 'indisponível': 'não suportada neste navegador',
};

export default function NotificacoesClient() {
  const [prefs, setPrefs] = useState<Prefs>(PREFS_PADRAO);
  const [amb, setAmb] = useState<Ambiente | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => { setPrefs(lerPrefs()); setAmb(detectar()); }, []);

  function alternar(k: TipoNotif) {
    const novo = { ...prefs, [k]: !prefs[k] };
    setPrefs(novo); gravarPrefs(novo); setSalvo(true);
    setTimeout(() => setSalvo(false), 1800);
  }

  return (
    <div className="ntf">
      <section className="card ntf-card" aria-labelledby="ntf-painel">
        <h2 id="ntf-painel" className="aud-h2">No painel <span className="ntf-tag ok">ativo</span></h2>
        <p className="muted">O sino no topo do painel mostra os avisos dos últimos 7 dias. Escolha o que deve aparecer:</p>
        <ul className="ntf-prefs">
          {(Object.keys(ROTULOS) as TipoNotif[]).map((k) => (
            <li key={k}>
              <label>
                <input type="checkbox" checked={prefs[k]} onChange={() => alternar(k)} />
                <span><b>{ROTULOS[k].t}</b><small>{ROTULOS[k].d}</small></span>
              </label>
            </li>
          ))}
        </ul>
        <p className="aud-nota" aria-live="polite">{salvo ? 'Preferência salva.' : 'As preferências ficam salvas neste navegador. Em outro aparelho, escolha de novo.'}</p>
      </section>

      <section className="card ntf-card" aria-labelledby="ntf-cel">
        <h2 id="ntf-cel" className="aud-h2">No celular <span className="ntf-tag prep">em preparação</span></h2>
        <p className="muted">Em breve você poderá receber avisos no celular mesmo com o site fechado. Enquanto isso, deixe o painel aberto ou instale o atalho abaixo.</p>
        <button type="button" className="btn btn-pri" disabled aria-disabled="true">Ativar notificações no celular (em breve)</button>

        {amb && (
          <ul className="ntf-amb" aria-label="Compatibilidade deste aparelho">
            <li><span>App instalado na tela de início</span><b>{amb.instalado ? 'sim' : 'não'}</b></li>
            <li><span>Permissão de notificação</span><b>{PERMISSAO[amb.permissao] ?? amb.permissao}</b></li>
            <li><span>Suporte a notificações em segundo plano</span><b>{amb.temSW && amb.temPush ? 'sim' : amb.ios && !amb.instalado ? 'só com o app instalado' : 'não'}</b></li>
          </ul>
        )}

        <div className="ntf-guias">
          <details open={amb?.ios}>
            <summary>iPhone e iPad</summary>
            <ol>
              <li>Precisa do iOS 16.4 ou mais recente.</li>
              <li>Abra o Comprei Barato no <b>Safari</b>.</li>
              <li>Toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</li>
              <li>Abra o painel pelo ícone criado. No iPhone, as notificações só funcionam pelo app instalado.</li>
              <li>Quando o recurso for liberado, toque em &quot;Ativar notificações no celular&quot; e permita.</li>
            </ol>
          </details>
          <details open={amb?.android}>
            <summary>Android</summary>
            <ol>
              <li>Abra o Comprei Barato no <b>Chrome</b>.</li>
              <li>Toque no menu <b>⋮</b> e em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li>
              <li>Quando o recurso for liberado, toque em &quot;Ativar notificações no celular&quot; e permita.</li>
            </ol>
          </details>
          <details>
            <summary>Como desativar depois</summary>
            <p>Nas configurações do navegador ou do celular, em Notificações, desative o Comprei Barato. Você também poderá desativar por esta página.</p>
          </details>
        </div>
      </section>
    </div>
  );
}
