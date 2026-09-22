# ⚔️ Talishar Log Exporter (Firefox WebExtension)

Extensão de navegador para o Firefox desenvolvida com [WXT](https://wxt.dev/) e TypeScript para capturar logs de partidas, estatísticas de combate e anotações do [Talishar.net](https://talishar.net) (Flesh and Blood TCG), exportando para **Google Sheets** e **CSV formatado para Excel em Português do Brasil**.

---

## 🚀 Funcionalidades

- **Captura Automática de Partidas**: Identifica jogadores, heróis, contagem de turnos, resultado (Vitória/Derrota), quem iniciou a partida e log de ações em tempo real.
- **Métricas de Valor Médio por Turno**: Coleta o *Valor Médio por Turno* (*Avg Value per Turn*) do jogador e do oponente calculado pelo Talishar, com suporte a troca rápida de abas, detecção por contraste e campos 100% editáveis no modal.
- **Rastreamento de Equipamentos**: Identifica o equipamento completo utilizado por você e pelo oponente (cabeça, peitoral, braços, pernas e armas).
- **Anotação de Cores das Cartas (Pitch)**: Registra no log o pitch de cada carta jogada ou anunciada: `(1 - Vermelha)`, `(2 - Amarela)` e `(3 - Azul)`.
- **Rastreamento de Sideboard & Decks**: Detecta as cartas deixadas de fora do main deck durante a fase de sideboard no lobby ou inventário em jogo.
- **Log Completo Otimizado para IA**: Ao baixar o arquivo `.txt` do log de combate, os nicknames dos jogadores são automaticamente substituídos pelos nomes dos respectivos personagens/heróis, facilitando a ingestão por LLMs (ChatGPT, Claude, Gemini, etc.).
- **Exportação para Google Sheets**: Envio em 1 clique para sua planilha do Google via Webhook (Google Apps Script) com validação de URL, teste de conexão instantâneo e botão de acesso rápido à planilha.
- **Exportação em CSV (Excel PT-BR)**: Gera arquivos com cabeçalho UTF-8 BOM (`\uFEFF`) e delimitador ponto-e-vírgula (`;`), abrindo diretamente no Excel sem caracteres corrompidos.
- **Estrutura de Colunas Padronizada**:
  1. `Dia` | 2. `Jogador` | 3. `Deck` | 4. `Match` (herói do oponente) | 5. `Formato` | 6. `Resultado` | 7. `Iniciou` | 8. `Plataforma de Jogo` | 9. `Adversário` | 10. `Observações` | 11. `Turnos` | 12. `Meu Valor Médio/Turno` | 13. `Valor Médio/Turno Oponente` | 14. `Cartas Fora/Sideboard`
- **Modal de Notas Pós-Partida & Botão Flutuante**: Botão compacto no canto superior direito ao fim da partida que abre um modal para registrar aprendizados, erros e notas antes de salvar.

---

## 📦 Como Instalar no Firefox (Modo Desenvolvedor)

1. Clone ou acesse a pasta do projeto no WSL/Linux/Terminal.
2. Instale as dependências e faça o build:
   ```bash
   npm install
   npm run build
   ```
3. Abra o Firefox e digite na barra de endereços:
   ```text
   about:debugging#/runtime/this-firefox
   ```
4. Clique em **"Carregar extensão temporária..."** (Load Temporary Add-on...).
5. Navegue até a pasta do projeto e selecione o arquivo:
   ```text
   dist/firefox/manifest.json
   ```
6. Pronto! O ícone da extensão aparecerá na barra de ferramentas do seu Firefox.

---

## 📊 Como Configurar o Google Sheets

1. Abra uma nova planilha no [Google Sheets](https://sheets.new).
2. No menu superior, clique em **Extensões** > **Apps Script**.
3. Apague o código padrão e cole o conteúdo do arquivo [`google-apps-script/Code.gs`](./google-apps-script/Code.gs).
4. Clique no botão azul **Implantar** (Deploy) > **Nova implantação** (New deployment).
5. Clique na engrenagem ao lado esquerdo e selecione **App da Web** (Web app):
   - **Executar como**: `Eu` (sua conta)
   - **Quem tem acesso**: `Qualquer pessoa` (permite que a extensão envie os dados)
6. Clique em **Implantar**, autorize o script e copie a **URL do app da Web**.
7. Clique no ícone do **Talishar Log Exporter** no Firefox, cole a URL no campo de Webhook e clique em **Testar Conexão** e **Salvar**.

---

## 🧪 Testes Automatizados

O projeto possui uma suíte completa de testes unitários com Vitest:
```bash
npm test
```
Ou em modo contínuo:
```bash
npm run test:watch
```
Verificação de tipos:
```bash
npm run compile
```

---

## 🛠️ Arquitetura e Engenharia

- Guia de agentes e convenções: [`AGENTS.md`](./AGENTS.md)
- Glossário do domínio: [`CONTEXT.md`](./CONTEXT.md)
- Registros de decisão de arquitetura: [`docs/adr/`](./docs/adr/)
- Especificação e histórico de tickets: [`.scratch/talishar-log-capture/`](./.scratch/talishar-log-capture/)
