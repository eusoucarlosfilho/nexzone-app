import Link from 'next/link';
import LinkRastreado from './v3/LinkRastreado';
import { BotaoInstalarApp } from './AppInstalavel';
import { lerEmpresa } from '@/lib/confianca-servidor';
import { formatarCnpj, whatsappLegivel } from '@/lib/confianca';

// supportEmail continua aceito por compatibilidade; o link "Suporte" abre a Central de Suporte (/suporte).
export default async function Footer(_props: { supportEmail?: string }) {
  const empresa = await lerEmpresa();
  const linhaEmpresa = [empresa.razao, empresa.cnpj && `CNPJ ${formatarCnpj(empresa.cnpj)}`, empresa.cidade].filter(Boolean).join(' · ');
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
            <Link href="/jogos">Jogos</Link>
            <Link href="/oferta-do-dia">Oferta do dia</Link>
            <Link href="/black-friday">Black November</Link>
            <Link href="/minhas-compras">Minhas compras</Link>
            <Link href="/favoritos">Favoritos</Link>
            <Link href="/notificacoes">Notificações</Link>
          </div>
          <div>
            <b>Ajuda</b>
            <Link href="/como-funciona">Como funciona</Link>
            <Link href="/ajuda">Perguntas frequentes</Link>
            <Link href="/suporte">Suporte</Link>
            <BotaoInstalarApp className="ftr-app" rotulo="Instalar o app" />
          </div>
          <div>
            <b>Comprei Barato</b>
            <LinkRastreado href="/seja-vendedor" evento="vendedor_cta" dados={{ origem: 'outro' }}>Vender no Comprei Barato</LinkRastreado>
            <Link href="/termos">Termos de uso</Link>
            <Link href="/privacidade">Privacidade</Link>
          </div>
        </nav>
      </div>
      {(linhaEmpresa || empresa.whatsapp || empresa.email) && (
        <div className="ftr" style={{ paddingTop: 0, fontSize: 12.5, color: 'var(--muted)', display: 'block' }}>
          {linhaEmpresa && <div>{linhaEmpresa}</div>}
          {(empresa.whatsapp || empresa.email) && (
            <div style={{ marginTop: 2 }}>
              {empresa.whatsapp && <a href={`https://wa.me/${empresa.whatsapp}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sub)' }}>WhatsApp {whatsappLegivel(empresa.whatsapp)}</a>}
              {empresa.whatsapp && empresa.email && ' · '}
              {empresa.email && <a href={`mailto:${empresa.email}`} style={{ color: 'var(--sub)' }}>{empresa.email}</a>}
            </div>
          )}
        </div>
      )}
    </footer>
  );
}
