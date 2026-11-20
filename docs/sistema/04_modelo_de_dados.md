# Modelo de dados do sistema real (migrações 001 a 010)

> Tirado das migrações em `migrations/`. Mudou uma tabela? Atualize este arquivo no mesmo PR (ADR-009). Chaves são UUID (`codigo`) salvo onde indicado.

## Pessoas e estrutura
| Tabela | Colunas principais | Observações |
|---|---|---|
| `usuarios` | nome, email, perfil (ADMIN/MANAGER/MEMBER), status, ativo, senha_hash, senioridade, área, cargo, data_entrada/saida, contato (telefone, linkedin, github, calendário), foto (`<uuid>.webp`, arquivo em `anexos/fotos/`), curso, ingresso (AAAA/1 ou AAAA/2), bio | Nunca excluída (ADR-006); saída muda o status. Trainee existe sem login |
| `areas` | nome, area_pai_codigo, ativa | Hierárquica (subáreas) |
| `cargos`, `senioridades` | nome; senioridade tem valor_hora e ordem | Configuráveis (ADR-007). valor_hora ainda 0 (QA-01) |
| `historico_areas`, `historico_cargos` | anterior, novo, data_vigencia, registrado_por | Gravado ao trocar área/cargo |
| `refresh_tokens` | token_hash, expira_em, revogado_em | Sessões |

## Projetos e tarefas
| Tabela | Colunas principais | Observações |
|---|---|---|
| `projetos` | nome, descricao, datas, status, area, lider_codigo, prioridade, progresso, campos de cliente (reservados) | Ativos = Em andamento, Atenção, Bloqueado |
| `projeto_membros` | projeto, usuario, funcao, alocacao, data_entrada/saida | Membro vê só projetos de que participa ou participou |
| `tarefas` | projeto **ou** categoria (Inovação, Capacitação, Execução), titulo, datas, status, prioridade, concluida_por, criada_por, coluna_codigo | De projeto: sempre numa coluna do próprio projeto (FK composta `coluna_codigo + projeto_codigo`, NO ACTION, com índice `idx_tarefas_coluna` nas duas colunas; avulsa fica sem). Checks: coluna só com projeto; `status = 'concluida'` se e só se há `data_conclusao` (migração 015) |
| `colunas_projeto` | projeto_codigo, nome (até 40), cor (8 da paleta), ordem, papel (`entrada`, `meio`, `concluida`) | Kanban do projeto (migração 015). Uma `entrada` e uma `concluida` por projeto, nome único sem diferenciar maiúsculas e nunca vazio (check `colunas_projeto_nome_preenchido`); some com o projeto. O status da tarefa vem do papel da coluna |
| `tarefa_responsaveis`, `tarefa_checklist_itens`, `tarefa_comentarios` | | |

## Biblioteca e Anexos
| Tabela | Colunas principais | Observações |
|---|---|---|
| `biblioteca_itens` | titulo, conteudo, links, tags, projeto_codigo, sigilo (todos / gestao / projeto), autor | Substituiu `pastas`, `documentos`, `conhecimentos`, `iniciativas` e as ligações (migração 012). Sigilo `projeto` exige projeto |
| `anexos` | dono_tipo (biblioteca, capacitacao), dono_codigo, nome, tipo_mime, tamanho_bytes, arquivo (UUID no disco), enviado_por | **Sem chave estrangeira para o dono**: a aplicação apaga junto. `conferirAnexos` acha órfãos |

## Capacitações
| Tabela | Colunas principais | Observações |
|---|---|---|
| `capacitacoes` | titulo, descricao, data, hora (São Paulo), duracao_horas, instrutor, vagas, tipo (computacao/eletrica/mecanica), sala | |
| `capacitacao_inscricoes` | capacitacao, usuario, presente (nulo até a gestão marcar), inscrito_em | Horas contam só com presente = verdadeiro |
| `capacitacao_feedbacks` | capacitacao, usuario, nota 1–5, bom, melhorar | Só quem compareceu avalia |

## Controle
- `schema_migrations` (nome, aplicada_em): migrações já aplicadas. Nunca editar uma migração publicada; criar a próxima numerada.
- Removido: `checkins` (migração 010, 11/2026).
