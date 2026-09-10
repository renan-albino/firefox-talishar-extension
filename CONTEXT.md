# Domain Context: Firefox Talishar Log Exporter

Glossário ubíquo e conceitos centrais do domínio da extensão. Não contém detalhes de implementação voláteis.

---

## Termos do Domínio

### Match (Partida)
Uma sessão de jogo de Flesh and Blood (FaB) disputada na plataforma web Talishar.net entre dois jogadores. Possui estado de início, turnos intermediários e um estado de encerramento (vitória, derrota ou concessão).

### Match Log (Log da Partida)
A sequência cronológica de mensagens de texto e eventos gerados pelo Talishar durante os turnos (ações de cartas, cálculo de dano, custos de pitch, efeitos de gatilho e passagem de turno).

### Match Notes (Notas da Partida)
Observações, anotações de erros e aprendizados informados pelo usuário através de um modal após o encerramento da partida, antes do salvamento/exportação final.

### Average Turn Value (Valor Médio por Turno)
Métrica de desempenho calculada/exibida pelo Talishar que indica o valor médio gerado ou bloqueado por turno por cada um dos dois jogadores ao longo do confronto.

### Deck Adjustments / Sideboard (Ajustes de Deck)
A relação de cartas adicionadas ou deixadas de fora do deck principal (main deck) durante a fase de sideboard/equipamento, com atenção especial a formatos em que o deck principal possui composição ajustada (ex: menos de 60 cartas no Blitz ou regras específicas).

### Local CSV (CSV Local)
Arquivo delimitado exportado localmente no formato compatível com Excel e ferramentas de planilhas configuradas em Português do Brasil (`\uFEFF` UTF-8 com BOM, delimitador ponto-e-vírgula `;` e campos de texto entre aspas).

### Sheets Webhook (Webhook de Planilha)
Ponto de extremidade HTTP (Google Apps Script Web App) associado a uma planilha do Google Sheets do usuário, capaz de receber requisições POST com os dados consolidados da partida e inseri-los automaticamente em uma nova linha.
