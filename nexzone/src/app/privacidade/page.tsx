import Nav from '@/components/Nav';
import Icon from '@/components/Icon';

export const metadata = { title: 'Política de Privacidade — Comprei Barato' };

export default function PrivacidadePage() {
  return (
    <>
      <Nav />
      <div className="page" style={{ maxWidth: 760 }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 30, fontWeight: 900 }}>Política de Privacidade</h1>
        <p className="muted" style={{ marginBottom: 8 }}>Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        <div style={{ background: 'var(--soft)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--sub)', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Icon name="alert" size={16} style={{ marginTop: 1, flexShrink: 0 }} /><span>Este é um modelo inicial em conformidade com a LGPD. Recomendamos revisão por um advogado.</span>
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

          <h2 style={h2}>5.1 Estatísticas de audiência</h2>
          <p>Para entender como a Plataforma é usada, registramos de forma anônima as páginas visitadas, o tipo de aparelho (celular, computador ou tablet) e a região aproximada da conexão (cidade/estado informados pela rede, sem endereço IP e sem coordenadas). Usamos um identificador aleatório guardado no seu navegador, que não revela quem você é. Também podemos registrar, de forma anônima, etapas do cadastro (por exemplo, &ldquo;formulário aberto&rdquo; ou &ldquo;erro de senha fraca&rdquo;), cliques em produtos e buscas, sem guardar o que você digita em campos pessoais. Não fazemos gravação de tela.</p>
          <p>Quando você chega por um link de campanha, guardamos apenas os parâmetros de campanha (utm_source, utm_medium, utm_campaign e utm_content) e o domínio do site de origem, nunca o endereço completo. Esses dados são vistos somente de forma agregada pela administração.</p>

          <h2 style={h2}>5.2 Estado e cidade informados por você</h2>
          <p>No cadastro e em &ldquo;Minha conta&rdquo; você pode, se quiser, informar estado e cidade. É opcional e serve só para estatísticas agregadas de onde vêm nossos clientes. Não pedimos endereço nem a localização do aparelho, e você pode remover a informação a qualquer momento em &ldquo;Minha conta&rdquo;.</p>

          <h2 style={h2}>6. Seus direitos</h2>
          <p>Nos termos da LGPD, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e informações sobre compartilhamento dos seus dados, bem como revogar consentimento.</p>

          <h2 style={h2}>7. Segurança</h2>
          <p>Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo controles de acesso e armazenamento seguro. Arquivos de produtos ficam em área privada, liberados apenas a quem efetuou a compra.</p>

          <h2 style={h2}>8. Retenção</h2>
          <p>Mantemos os dados pelo tempo necessário às finalidades descritas e ao cumprimento de obrigações legais. Os registros anônimos de audiência têm prazo próprio de retenção, definido pela administração e limitado ao necessário para comparar períodos.</p>

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
