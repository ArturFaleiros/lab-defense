# Lab Defense — Operação Circuito

Tower defense educacional de eletrônica (relés, bobinas, indutores, diodos…), separado do EMLab.
O progresso fica em um banco **PostgreSQL** e cada partida é **verificada pelo servidor**.

## Como rodar

| Situação | Comando |
|---|---|
| Desenvolvimento | `npm install`, depois `npm run dev:api` (API + PostgreSQL embutido) e `npm run dev` → http://localhost:5173 |
| Testes | `npm test` (engine, progressão, balanceamento, replay anti-trapaça e API com banco) |
| Build de produção | `npm run build` → `dist/` (site) e `api/*.js` (funções da Vercel) |

Variáveis de ambiente na Vercel: `DATABASE_URL` (obrigatória) e, opcionalmente, `DATABASE_CA` (certificado raiz do
Supabase, para verificar o TLS) e `ALLOWED_ORIGINS` (domínios extras, separados por vírgula).

## Como a trapaça é bloqueada

1. **O servidor é a fonte da verdade.** O navegador nunca grava progresso: envia intenções e recebe o perfil do servidor.
   Editar `localStorage`, variáveis ou requisições não altera EC, XP, fases ou unidades.
2. **Replay determinístico.** A simulação avança em passos fixos de 1/60 s com semente sorteada pelo servidor. O navegador
   registra só os comandos (posicionar, melhorar, vender, habilidade, onda…); ao final, o servidor re-simula a partida e
   concede a recompensa que **ele** calculou. Créditos/vidas alterados pelo console não existem no replay.
3. **Plausibilidade.** Partida mais rápida que a velocidade máxima (3×), log malformado, fase/dificuldade/unidade
   bloqueada, partida repetida ou expirada → recusada e registrada em auditoria.
4. **Sessão por nick.** Cookie `HttpOnly; Secure; SameSite=Strict` (o JavaScript da página não lê); o banco guarda só o
   hash SHA-256 do segredo. Para usar o nick em outro dispositivo há um código de acesso mostrado uma única vez.
5. **Limites e bloqueios.** Limite de requisições por IP/jogador, bloqueio de IP e de jogador, verificação de origem (CSRF).
6. **Navegador endurecido.** Sem source maps, código do app ofuscado, `console`/`debugger` removidos, React DevTools
   desligado em produção, nada exposto em `window`, CSP estrita e demais cabeçalhos de segurança (`vercel.json`).

Limite honesto: código que roda no navegador sempre pode ser lido por quem insiste (com ou sem IA). A ofuscação só
encarece isso; o que garante a integridade do progresso é a validação no servidor.

## Dados pessoais (LGPD)

O servidor registra **nick** e **endereço IP** (criação da conta, último acesso e histórico de IPs por jogador), usados
para segurança e prevenção de trapaças. O aviso aparece na tela de entrada. A função `labdefense.purge_old_ip_data()`
apaga registros de IP e eventos com mais de 180 dias.

## Estrutura

```
src/game/        jogo (dados, engine determinística, replay, progresso, render, áudio, telas)
src/game/net/    cliente da API
src/security/    endurecimento do navegador
server/          API (sessão por nick, perfil, partidas com re-simulação), acesso ao PostgreSQL, esquema SQL
scripts/         empacotamento das funções (build-api) e servidor local (dev-api)
```
