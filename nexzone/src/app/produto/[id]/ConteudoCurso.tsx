import Link from 'next/link';
import Icon from '@/components/Icon';
import { createAdminClient } from '@/lib/supabase/server';
import { carregarCurso } from '@/lib/curso-servidor';
import { duracaoTexto } from '@/lib/curso';

// Página do produto: grade do curso (só títulos) + aulas de prévia grátis. Nada de link de vídeo sai daqui.
export default async function ConteudoCurso({ productId }: { productId: string }) {
  let c: Awaited<ReturnType<typeof carregarCurso>> | null = null;
  try { c = await carregarCurso(createAdminClient(), productId); } catch { c = null; }
  if (!c || !c.sql18 || !c.config.ativo) return null;
  const modulos = c.modulos.map((m) => ({ ...m, aulas: m.aulas.filter((a) => a.publicada) })).filter((m) => m.aulas.length);
  if (!modulos.length) return null;
  const total = modulos.reduce((n, m) => n + m.aulas.length, 0);
  const minutos = modulos.reduce((n, m) => n + m.aulas.reduce((k, a) => k + (a.duracao_min || 0), 0), 0);
  const previa = modulos.flatMap((m) => m.aulas).find((a) => a.previa);
  return (
    <div className="pdp-sec">
      <style dangerouslySetInnerHTML={{ __html: `
        .pcc-res{display:flex;gap:14px;flex-wrap:wrap;color:var(--sub);font-weight:700;font-size:14px;margin:-4px 0 12px}
        .pcc-res span{display:inline-flex;gap:6px;align-items:center}
        .pcc details{border:1px solid var(--border);border-radius:14px;margin-bottom:8px;background:#fff;overflow:hidden}
        .pcc summary{cursor:pointer;padding:12px 14px;font-weight:800;display:flex;justify-content:space-between;gap:10px;list-style:none}
        .pcc summary::-webkit-details-marker{display:none}
        .pcc summary small{color:var(--sub);font-weight:700;white-space:nowrap}
        .pcc ul{list-style:none;margin:0;padding:0 14px 10px}
        .pcc li{display:flex;gap:8px;align-items:center;padding:7px 0;border-top:1px dashed var(--border);font-size:14px}
        .pcc li span{flex:1;min-width:0;overflow-wrap:anywhere}
        .pcc li small{color:var(--sub);font-weight:700}
        .pcc li a{font-weight:800;color:var(--orange-ink);font-size:12.5px;white-space:nowrap}
      ` }} />
      <h2>Conteúdo do curso</h2>
      <div className="pcc-res">
        <span><Icon name="package" size={15} /> {modulos.length} módulo{modulos.length === 1 ? '' : 's'}</span>
        <span><Icon name="play" size={14} /> {total} aula{total === 1 ? '' : 's'}</span>
        {minutos > 0 && <span><Icon name="clock" size={15} /> {duracaoTexto(minutos)}</span>}
        {c.config.certificado && <span><Icon name="award" size={15} /> Certificado de conclusão</span>}
      </div>
      <div className="pcc">
        {modulos.map((m, i) => (
          <details key={m.id} open={i === 0}>
            <summary><span>{i + 1}. {m.titulo}</span><small>{m.aulas.length} aula{m.aulas.length === 1 ? '' : 's'}</small></summary>
            <ul>
              {m.aulas.map((a) => (
                <li key={a.id}>
                  <Icon name={a.previa ? 'play' : 'lock'} size={13} color={a.previa ? 'var(--orange-ink)' : 'var(--muted)'} />
                  <span>{a.titulo}</span>
                  {a.previa ? <Link href={`/curso/${productId}?aula=${a.id}`}>Assistir grátis</Link> : a.duracao_min ? <small>{duracaoTexto(a.duracao_min)}</small> : null}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      {previa && <Link href={`/curso/${productId}?aula=${previa.id}`} className="btn btn-ghost btn-sm" style={{ marginTop: 6 }}><Icon name="play" size={15} /> Assistir a aula grátis</Link>}
    </div>
  );
}
