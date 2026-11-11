# Modelo de dados do sistema real (migrações 001 a 010)

> Tirado das migrações em `migrations/`. Mudou uma tabela? Atualize este arquivo no mesmo PR (ADR-009). Chaves são UUID (`codigo`) salvo onde indicado.

## Pessoas e estrutura
| Tabela | Colunas principais | Observações |
|---|---|---|
| `usuarios` | nome, email, perfil (ADMIN/MANAGER/MEMBER), status, ativo, senha_hash, senioridade, área, cargo, data_entrada/saida, contato (telefone, linkedin, github, calendário), curso, semestre, bio | Nunca excluída (ADR-006); saída muda o status. Trainee existe sem login |
| `areas` | nome, area_pai_codigo, ativa | Hierárquica (subáreas) |
| `cargos`, `senioridades` | nome; senioridade tem valor_hora e ordem | Configuráveis (ADR-007). valor_hora ainda 0 (QA-01) |
| `historico_areas`, `historico_cargos` | anterior, novo, data_vigencia, registrado_por | Gravado ao trocar área/cargo |
| `habilidades` + `usuario_habilidades` | nome, tipo (`tecnologia`…) | Lista que cresce sem duplicar nomes |
| `refresh_tokens` | token_hash, expira_em, revogado_em | Sessões |

## Projetos e tarefas
| Tabela | Colunas principais | Observações |
|---|---|---|
| `projetos` | nome, descricao, datas, status, area, lider_codigo, prioridade, progresso, campos de cliente (reservados) | Ativos = Em andamento, Atenção, Bloqueado |
| `projeto_membros` | projeto, usuario, funcao, alocacao, data_entrada/saida | Membro vê só projetos de que participa ou participou |
| `tarefas` | projeto **ou** categoria (Inovação, Capacitação, Execução), titulo, datas, status, prioridade, iniciativa (só Inovação), concluida_por, criada_por | |
| `tarefa_responsaveis`, `tarefa_checklist_itens`, `tarefa_comentarios` | | |

## Documentos, Base, Iniciativas e Anexos
| Tabela | Colunas principais | Observações |
|---|---|---|
| `pastas` | nome, sigilo (todos / gestao / projeto), projeto_codigo | Gestão vê todas |
| `documentos` | pasta, nome, arquivo_url (link) | Link ou arquivo (anexo com dono `documento`) |
| `conhecimentos` + `conhecimento_projetos` | titulo, categoria, resumo, conteudo, autor, fonte, links, tags | Base de Inteligência |
| `iniciativas` + `iniciativa_projetos` + `iniciativa_conhecimentos` | titulo, tipo, frente, status, responsavel, criado_por, resultado, aprendizados | |
| `anexos` | dono_tipo (documento, conhecimento, iniciativa, capacitacao), dono_codigo, nome, tipo_mime, tamanho_bytes, arquivo (UUID no disco), enviado_por | **Sem chave estrangeira para o dono**: a aplicação apaga junto. `conferirAnexos` acha órfãos |

## Capacitações
| Tabela | Colunas principais | Observações |
|---|---|---|
| `capacitacoes` | titulo, descricao, data, hora (São Paulo), duracao_horas, instrutor, vagas, tipo (computacao/eletrica/mecanica), sala | |
| `capacitacao_inscricoes` | capacitacao, usuario, presente (nulo até a gestão marcar), inscrito_em | Horas contam só com presente = verdadeiro |
| `capacitacao_feedbacks` | capacitacao, usuario, nota 1–5, bom, melhorar | Só quem compareceu avalia |

## Controle
- `schema_migrations` (nome, aplicada_em): migrações já aplicadas. Nunca editar uma migração publicada; criar a próxima numerada.
- Removido: `checkins` (migração 010, 11/2026).
