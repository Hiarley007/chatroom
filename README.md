# ChatRoom
 
App de mensagens em tempo real: entre em salas públicas, converse e veja quem
está online e quem está digitando — tudo atualizando sozinho, sem precisar
puxar a tela para atualizar.
 
## Funcionalidades
 
- Cadastro e login (e-mail e senha)
- **Perfil automático**: nome e cor do avatar são criados sozinhos no cadastro
- Lista de salas públicas, com contagem de participantes
- Criar uma sala (com emoji e descrição) e entrar/sair de salas
- **Mensagens em tempo real** (Supabase Realtime): aparecem em todos os
  aparelhos abertos na mesma sala, sem precisar atualizar
- Envio **otimista**: a mensagem aparece na hora, e é confirmada depois
- **Presença**: contador de quem está online na sala agora
- **"Fulano está digitando..."**: aviso efêmero, que não grava nada no banco
- Pedidos de amizade e convites para salas com notificação no e-mail cadastrado
- Apagar a própria mensagem; editar o nome exibido no Perfil
 
## Tecnologias
React Native · Expo · Expo Router · TypeScript · Supabase (Auth, Postgres,
RLS, **Realtime**: `postgres_changes`, Presence e Broadcast) · TanStack Query ·
React Hook Form · Zod · Jest · PGlite (testes do banco)
 
## Como executar
 
1. Instale as dependências: `npm install`
2. Crie um projeto no [Supabase](https://supabase.com), execute
   `supabase/schema.sql` no SQL Editor e aplique os arquivos em
   `supabase/migrations` em ordem cronológica.
3. Configure os secrets SMTP da Edge Function no Supabase:
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM`.
   Depois publique a função com `supabase functions deploy notify-friend-request`.
   O remetente em `SMTP_FROM` precisa estar autorizado pelo seu provedor SMTP.
4. Em **Database → Replication**, confirme que a tabela `messages` está
   marcada para o Realtime (o próprio `schema.sql` já faz isso, mas vale
   conferir no painel).
5. Copie `.env.example` para `.env` e preencha a URL e a chave pública do
   projeto.
6. Inicie o app: `npx expo start` e abra no Expo Go.
 
## Testes
 
| Comando            | O que testa                                                  |
| ------------------ | ------------------------------------------------------------ |
| `npm test`         | Tudo: app (Jest) e banco (PGlite)                            |
| `npm run test:app` | Agrupamento de mensagens, avatar e o indicador de digitação  |
| `npm run test:db`  | RLS, o gatilho de perfil e a política de participação em salas |
 
O teste do banco usa o PGlite (Postgres real dentro do Node), com o mesmo
`schema.sql` do Supabase, sem Docker — inclusive o gatilho que cria o perfil
automaticamente.
 
## Arquitetura
 
```
app/         rotas (Expo Router)
src/
  components/  interface: balão de mensagem, avatar, cartão de sala...
  context/     sessão do usuário
  hooks/       salas, mensagens (com Realtime), presença, digitação
  services/    acesso ao Supabase
  utils/       agrupamento de mensagens, avatar, indicador — cobertos por testes
supabase/
  schema.sql   banco, RLS, o gatilho de perfil e a função is_room_member
  tests/       testes do banco
```
 
## Autor
 
**Seu Nome**
 
- LinkedIn: https://www.linkedin.com/in/hiarley-morais-bbb360352/
- GitHub: https://github.com/Hiarley007
