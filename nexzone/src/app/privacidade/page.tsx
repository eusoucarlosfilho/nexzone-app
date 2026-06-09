import Nav from '@/components/Nav';

export const metadata = { title: 'Política de Privacidade — NexZone' };

export default function PrivacidadePage() {
  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 760 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 30, fontWeight: 900 }}>Política de Privacidade</h1>
        <p className="muted" style={{ marginBottom: 8 }}>Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        <div style={{ background: 'var(--soft)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--sub)', marginBottom: 24 }}>
          ⚠️ Este é um modelo inicial em conformidade com a LGPD. Recomendamos revisão por um advogado.
        </div>

        <div style={{ color: 'var(--sub)', fontSize: 15, lineHeight: 1.75 }}>
          <h2 style={h2}>1. Quais dados coletamos</h2>
          <p>Coletamos os dados necessários para o funcionamento da Plataforma: dados de cadastro (e-mail e identificação da conta), dados de loja (para Vendedores), dados de transação (pedidos, valores, status) e dados técnicos de navegação.</p>

          <h2 style={h2}>2. Para que usamos</h2>
          <p>Utilizamos os dados para: criar e gerenciar sua conta; processar pagamentos e entregas; prevenir fraudes; oferecer suporte; cumprir obrigações legais; e melhorar a Plataforma.</p>

          <h2 style={h2}>3. Base legal (LGPD)</h2>
          <p>O tratamento se baseia na execução do contrato (uso da Plataforma), no cumprimento de obrigação legal, no legítimo interesse e, quando aplicável, no seu consentimento.</p>

          <h2 style={h2}>4. Compartilhamento</h2>
          <p>Compartilhamos dados apenas com parceiros necessários à operação, como o provedor de pagamento (Mercado Pago) e a infraestrutura de hospedagem e banco de dados, sempre limitado à finalidade. Não vendemos seus dados.</p>

          <h2 style={h2}>5. Cookies</h2>
          <p>Utilizamos cookies e tecnologias similares para autenticação, segurança e melhoria da experiência.</p>

          <h2 style={h2}>6. Seus direitos</h2>
          <p>Nos termos da LGPD, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e informações sobre compartilhamento dos seus dados, bem como revogar consentimento.</p>

          <h2 style={h2}>7. Segurança</h2>
          <p>Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo controles de acesso e armazenamento seguro. Arquivos de produtos ficam em área privada, liberados apenas a quem efetuou a compra.</p>

          <h2 style={h2}>8. Retenção</h2>
          <p>Mantemos os dados pelo tempo necessário às finalidades descritas e ao cumprimento de obrigações legais.</p>

          <h2 style={h2}>9. Contato e Encarregado</h2>
          <p>Para exercer seus direitos ou tirar dúvidas sobre privacidade, utilize o canal de suporte informado na Plataforma.</p>

          <h2 style={h2}>10. Alterações</h2>
          <p>Esta Política pode ser atualizada periodicamente. A versão vigente estará sempre disponível nesta página.</p>
        </div>
      </div>
    </>
  );
}
const h2 = { fontFamily: 'Outfit', fontWeight: 800, fontSize: 18, color: 'var(--text)', margin: '22px 0 6px' } as const;
