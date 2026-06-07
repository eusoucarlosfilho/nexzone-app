-- Seed: categorias + uma loja âncora + produtos legítimos (cunha)
-- Rode depois da migration. Ajuste o owner para o seu user id real.

insert into public.categories (nome, slug, emoji) values
  ('IA & Ferramentas','ia-ferramentas','🤖'),
  ('Templates & Planilhas','templates-planilhas','📊'),
  ('Design','design','🎨'),
  ('Automações','automacoes','⚡'),
  ('Marketing Digital','marketing-digital','📈'),
  ('Cursos & Ebooks','cursos-ebooks','📚')
on conflict (slug) do nothing;

-- Exemplo de loja + produtos (troque '<SEU_USER_ID>' pelo uuid do seu auth.users):
-- insert into public.stores (owner, nome, slug, categoria, status, nivel)
-- values ('<SEU_USER_ID>','Minha Loja','minha-loja','IA & Ferramentas','verificado','top');
