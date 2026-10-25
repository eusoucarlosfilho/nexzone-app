# Testes automáticos (sem banco e sem rede)

Rode `npm test`. O comando:

1. compila as regras puras de `src/lib` para `testes/.build`;
2. roda os testes destes arquivos:
   - `ofertas.test.js`: validação de URL e redirecionamento, CSV, validação de ofertas, mistura de nativos e parceiros;
   - `audiencia.test.js`: períodos, canais, máscara e oportunidades.

Os testes não acessam o Supabase nem a internet.
