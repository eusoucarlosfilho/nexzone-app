import { NextResponse, type NextRequest } from 'next/server';
import { adminSeguro, negado } from '@/lib/ofertas/adminSeguro';
import { carregarBase } from '@/lib/admin/usuarios-servidor';
import { filtrar, paginar, type Filtro } from '@/lib/admin/usuarios';
import { intervalo, periodoValido } from '@/lib/admin/tempo';
import { ufValida } from '@/lib/brasil';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lista paginada no SERVIDOR (no máximo 50 por página). Exige adminSeguro (C1):
// perfil admin + id em ADMIN_USER_IDS. E-mails só saem por aqui.
export async function GET(req: NextRequest) {
  const a = await adminSeguro();
  if (!a.ok) return negado(a);
  const sp = req.nextUrl.searchParams;
  const base = await carregarBase();

  const f: Filtro = {};
  const per = sp.get('periodo');
  if (per && per !== 'todos') {
    const iv = intervalo(periodoValido(per), sp.get('de'), sp.get('ate'));
    f.de = iv.de; f.ate = iv.ate;
  }
  const tipo = sp.get('tipo');
  if (tipo === 'compradores' || tipo === 'vendedores' || tipo === 'admins') f.tipo = tipo;
  f.uf = ufValida(sp.get('uf'));
  f.cidade = (sp.get('cidade') || '').slice(0, 60) || null;
  f.canal = (sp.get('canal') || '').slice(0, 40) || null;
  const sit = sp.get('situacao');
  if (sit === 'ativo' || sit === 'restrito' || sit === 'bloqueado') f.situacao = sit;
  const prod = sp.get('produtos');
  if (prod === 'com' || prod === 'sem') f.produtos = prod;
  f.q = (sp.get('q') || '').slice(0, 80) || null;

  const lista = filtrar(base.linhas, f);
  const pg = paginar(lista, Number(sp.get('pagina') || 1), Number(sp.get('tamanho') || 20));

  // Opções dos filtros (agregadas, sem dados pessoais)
  const ufs = Array.from(new Set(base.linhas.map((l) => l.uf).filter(Boolean) as string[])).sort();
  const canais = Array.from(new Set(base.linhas.map((l) => l.origemCanal || 'Sem registro'))).sort();

  return NextResponse.json({
    ...pg,
    opcoes: { ufs, canais },
    disponibilidade: base.disponibilidade,
    geradoEm: base.geradoEm,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
