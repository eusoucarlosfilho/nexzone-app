import Link from 'next/link';
import LinkRastreado from './v3/LinkRastreado';

// supportEmail continua aceito por compatibilidade; o link "Suporte" abre a Central de Suporte (/suporte).
export default function Footer(_props: { supportEmail?: string }) {
  return (
    <footer className="ftr-wrap">
      <div className="ftr">
        <div className="ftr-marca">
          <div style={{ fontFamily: 'Outfit', fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>Comprei <span style={{ color: 'var(--orange-ink)' }}>Barato</span></div>
          <p style={{ marginTop: 6 }}>Marketplace de produtos digitais: prompts, planilhas, templates, cursos, e-books, design, automações e mais.</p>
        </div>
        <nav className="ftr-cols" aria-label="Rodapé">
          <div>
            <b>Comprar</b>
            <Link href="/produtos">Explorar produtos</Link>
            <Link href="/minhas-compras">Minhas compras</Link>
            <Link href="/favoritos">Favoritos</Link>
            <Link href="/notificacoes">Notificações</Link>
          </div>
          <div>
            <b>Ajuda</b>
            <Link href="/como-funciona">Como funciona</Link>
            <Link href="/ajuda">Perguntas frequentes</Link>
            <Link href="/suporte">Suporte</Link>
          </div>
          <div>
            <b>Comprei Barato</b>
            <LinkRastreado href="/seja-vendedor" evento="vendedor_cta" dados={{ origem: 'outro' }}>Vender no Comprei Barato</LinkRastreado>
            <Link href="/termos">Termos de uso</Link>
            <Link href="/privacidade">Privacidade</Link>
          </div>
        </nav>
      </div>
    </footer>
  );
}
