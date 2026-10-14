# Ponytail + perfil auditor permanente — instalação (2026-10-14)

Missão: instalar/integrar o Ponytail (repo oficial `DietrichGebert/ponytail`,
pacote npm `@dietrichgebert/ponytail` v5.2.0 MIT, verificado via `npm view`)
como ferramenta do auditor permanente de todo o SISWEB. ETAPA 0 (relatório
pré-instalação, sem alterações) concluída e aprovada pelo usuário antes.

## O que foi feito

- `opencode.json`: adicionada chave `"plugin": ["@dietrichgebert/ponytail"]`
  (sintaxe OpenCode v1 — ambiente roda 1.19.0; `"plugins"` é da v2 e falharia).
  Aditivo: providers/MCPs intactos. Backup prévio em
  `C:\Users\Nelson\AppData\Local\Temp\opencode\opencode.json.pre-ponytail-2026-10-14`
  (fora do repo e fora do deploy; `opencode.json` é gitignored).
- `.agents/skills/ponytail-sisweb-auditor/SKILL.md` (novo, local-only, gitignored
  como `/.agents/`): perfil `PONYTAIL_SISWEB_AUDITOR` — precedência
  Constitution > Auditor.md > Cérebro > Zen > docs oficiais > Ponytail; mapa de
  módulos com nomes reais (`admin-dashboard.html` e `admin-status-center.html`
  NÃO existem); modo de execução em 7 passos; proibições; prioridades.
- Rollback: remover a chave `"plugin"` (ou restaurar backup) + sessão nova.
  Nenhum código/dado/Firebase tocado.

## Verificação

- [x] `node -e JSON.parse(opencode.json)` OK; `plugin` resolvido no JSON
- [x] Pacote oficial confirmado no npm (v5.2.0, MIT)
- [x] `npm run lint` / `typecheck` / `test` verdes (sem regressão)
- [x] Ativação efetiva (comandos `/ponytail*`) — confirmada na sessão nova 2026-10-14 (skill `ponytail-help` carregada; níveis lite/full/ultra operacionais)
- [ ] Piloto ETAPA 1 (`/ponytail-review` em diff limpo) — liberado após commit fiscal desta sessão; executar a seguir

## File list

- `opencode.json` (edit: +1 chave)
- `.agents/skills/ponytail-sisweb-auditor/SKILL.md` (novo)
- `docs/stories/2026-10-14-ponytail-instalacao-perfil-auditor.md` (este arquivo)

## Riscos anotados (pré-existentes, não introduzidos)

- `opencode.json` contém `apiKey` em texto plano (era assim antes; avaliar mover para env).
- `validate:structure` / `validate:agents` citados no AGENTS.md não existem como scripts npm.
- Working tree sujo há dias viesa qualquer review de diff — commit/stash antes do piloto.
