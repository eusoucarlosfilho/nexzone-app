import BotaoImprimir from './BotaoImprimir';

// Certificado de conclusão (A4 deitado). Usado pelo aluno (/curso/[id]/certificado) e na verificação pública
// (/certificado/[codigo]). "Imprimir / salvar PDF" usa a impressão do navegador.
export default function CertificadoView({ c, loja, site, imprimir = true }: {
  c: { codigo: string; nome_aluno: string; titulo_curso: string; carga_horaria: number | null; emitido_em: string };
  loja: string; site: string; imprimir?: boolean;
}) {
  const data = new Date(c.emitido_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const verificar = `${site.replace(/\/+$/, '')}/certificado/${c.codigo}`;
  return (
    <div className="cert-wrap">
      <style dangerouslySetInnerHTML={{ __html: `
        .cert-wrap{max-width:1000px;margin:0 auto;padding:20px 16px 50px}
        .cert-acoes{display:flex;justify-content:flex-end;gap:8px;margin-bottom:14px;flex-wrap:wrap}
        .cert{position:relative;aspect-ratio:297/210;background:#fff;border-radius:18px;box-shadow:0 20px 50px rgba(22,22,42,.12);overflow:hidden;padding:clamp(18px,5%,56px);display:flex;flex-direction:column;justify-content:space-between;border:1px solid var(--border)}
        .cert::before{content:'';position:absolute;inset:clamp(8px,1.6%,16px);border:2px solid #FFCBA1;border-radius:12px;pointer-events:none}
        .cert::after{content:'';position:absolute;right:-12%;top:-30%;width:55%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#FFE6D2,transparent 70%);pointer-events:none}
        .cert-marca{font-family:'Outfit';font-weight:900;font-size:clamp(14px,2.2vw,22px);letter-spacing:-.5px;position:relative}
        .cert-marca span{color:#FF6B00}
        .cert-meio{position:relative;text-align:center}
        .cert-sobre{font-size:clamp(10px,1.4vw,14px);letter-spacing:4px;text-transform:uppercase;color:#8A8AA0;font-weight:800}
        .cert-nome{font-family:'Outfit';font-weight:900;font-size:clamp(22px,4.6vw,48px);letter-spacing:-1px;margin:clamp(6px,1.5vw,14px) 0;line-height:1.1;overflow-wrap:anywhere}
        .cert-txt{font-size:clamp(11px,1.7vw,17px);color:#3A3A52;max-width:80%;margin:0 auto;line-height:1.5}
        .cert-txt b{color:#16162A}
        .cert-rod{position:relative;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;font-size:clamp(9px,1.2vw,12.5px);color:#5A5A72}
        .cert-ass{border-top:1.5px solid #16162A;padding-top:6px;min-width:30%;text-align:center;font-weight:800;color:#16162A}
        .cert-cod{text-align:right;overflow-wrap:anywhere}
        .cert-cod b{font-family:'Outfit';color:#16162A;letter-spacing:1px}
        @media print{
          @page{size:A4 landscape;margin:0}
          body *{visibility:hidden}
          .cert,.cert *{visibility:visible}
          .cert{position:fixed;inset:0;border-radius:0;box-shadow:none;border:0;width:100vw;height:100vh;aspect-ratio:auto}
          nav.nz,.topbar,.cert-acoes{display:none!important}
        }
      ` }} />
      {imprimir && <div className="cert-acoes"><BotaoImprimir rotulo="Imprimir / salvar em PDF" /></div>}
      <div className="cert" role="img" aria-label={`Certificado de ${c.nome_aluno} — ${c.titulo_curso}`}>
        <div className="cert-marca">Comprei <span>Barato</span></div>
        <div className="cert-meio">
          <div className="cert-sobre">Certificado de conclusão</div>
          <div className="cert-nome">{c.nome_aluno}</div>
          <p className="cert-txt">
            concluiu o curso <b>{c.titulo_curso}</b>, oferecido por <b>{loja}</b>{c.carga_horaria ? <>, com carga horária de <b>{c.carga_horaria} hora{c.carga_horaria === 1 ? '' : 's'}</b></> : null}, em {data}.
          </p>
        </div>
        <div className="cert-rod">
          <div className="cert-ass">{loja}</div>
          <div className="cert-cod">Código de verificação<br /><b>{c.codigo}</b><br />{verificar.replace(/^https?:\/\//, '')}</div>
        </div>
      </div>
    </div>
  );
}
