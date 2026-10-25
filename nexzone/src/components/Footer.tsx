import Link from 'next/link';

// supportEmail continua aceito por compatibilidade; o link "Suporte" agora abre a Central de Suporte (/suporte).
export default function Footer(_props: { supportEmail?: string }) {
  return (
    <footer className="ftr-wrap">
      <div className="ftr">
        <div>
          <div style={{ fontFamily: 'Outfit', fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>Comprei <span style={{ color: 'var(--orange-ink)' }}>Barato</span></div>
          <p style={{ marginTop: 6 }}>O marketplace de produtos digitais do Brasil.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div><Link href="/">Início</Link><Link href="/produtos">Explorar</Link><Link href="/seja-vendedor">Vender no Comprei Barato</Link><Link href="/minhas-compras">Minhas compras</Link></div>
          <div><Link href="/termos">Termos de uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/suporte">Suporte</Link></div>
        </div>
      </div>
    </footer>
  );
}
