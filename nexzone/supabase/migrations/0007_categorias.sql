-- =====================================================================
-- 0007 — Novas categorias (20 no total, incluindo Jogos & Games)
-- Rodar no SQL Editor do Supabase, o script inteiro de uma vez, ANTES do deploy
-- do código. Idempotente: pode rodar de novo; não apaga nada.
--
-- A lista é a mesma de src/lib/categorias.ts (fonte única).
-- As 6 primeiras já existem: mesmos slugs e mesmos nomes (os produtos guardam
-- a categoria pelo NOME), então nada muda para os produtos já cadastrados.
-- =====================================================================
begin;
set local lock_timeout = '5s';

insert into public.categories (nome, slug, emoji) values
  ('IA & Ferramentas', 'ia-ferramentas', '🤖'),
  ('Templates & Planilhas', 'templates-planilhas', '📊'),
  ('Design', 'design', '🎨'),
  ('Automações', 'automacoes', '⚡'),
  ('Marketing Digital', 'marketing-digital', '📈'),
  ('Cursos & Ebooks', 'cursos-ebooks', '📚'),
  ('Jogos & Games', 'jogos-games', '🎮'),
  ('Programação & Código', 'programacao-codigo', '💻'),
  ('Vídeo & Edição', 'video-edicao', '🎬'),
  ('Música & Áudio', 'musica-audio', '🎵'),
  ('Fotografia & Presets', 'fotografia-presets', '📷'),
  ('Negócios & Finanças', 'negocios-financas', '💼'),
  ('Concursos & Educação', 'concursos-educacao', '🎓'),
  ('Idiomas', 'idiomas', '🗣️'),
  ('Saúde & Bem-estar', 'saude-bem-estar', '💚'),
  ('Culinária & Receitas', 'culinaria-receitas', '🍳'),
  ('Infantil & Família', 'infantil-familia', '🧸'),
  ('Religião & Espiritualidade', 'religiao-espiritualidade', '🙏'),
  ('Moda & Beleza', 'moda-beleza', '👗'),
  ('Artesanato & DIY', 'artesanato-diy', '✂️')
on conflict (slug) do update set nome = excluded.nome;

-- Conferência: as 20 categorias precisam existir
do $$
begin
  if (select count(*) from public.categories where slug in (
    'ia-ferramentas',
    'templates-planilhas',
    'design',
    'automacoes',
    'marketing-digital',
    'cursos-ebooks',
    'jogos-games',
    'programacao-codigo',
    'video-edicao',
    'musica-audio',
    'fotografia-presets',
    'negocios-financas',
    'concursos-educacao',
    'idiomas',
    'saude-bem-estar',
    'culinaria-receitas',
    'infantil-familia',
    'religiao-espiritualidade',
    'moda-beleza',
    'artesanato-diy'
  )) <> 20 then
    raise exception 'ABORTAR: nem todas as 20 categorias foram gravadas';
  end if;
end $$;

commit;
