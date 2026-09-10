/**
 * Google Apps Script Webhook para Talishar Log Exporter
 *
 * Como instalar na sua planilha do Google:
 * 1. Abra a sua planilha no Google Sheets (https://sheets.new).
 * 2. No menu superior, clique em "Extensões" (Extensions) > "Apps Script".
 * 3. Apague o código padrão e cole todo este arquivo.
 * 4. Clique no botão azul "Implantar" (Deploy) > "Nova implantação" (New deployment).
 * 5. Clique no ícone de engrenagem à esquerda e selecione "App da Web" (Web app).
 * 6. Configurações:
 *    - Descrição: Webhook Talishar
 *    - Executar como (Execute as): "Eu" (Me)
 *    - Quem pode acessar (Who has access): "Qualquer pessoa" (Anyone)
 * 7. Clique em "Implantar", autorize o acesso à sua conta e copie a "URL do app da Web".
 * 8. Cole a URL no popup da extensão do Firefox!
 */

function setupHeaders(sheet) {
  var headers = [
    'ID da Partida',
    'Data/Hora',
    'Jogador',
    'Herói',
    'Oponente',
    'Herói Oponente',
    'Resultado',
    'Turnos',
    'Meu Valor Médio/Turno',
    'Valor Médio/Turno Oponente',
    'Cartas Fora/Sideboard',
    'Notas',
    'Log Resumido'
  ];
  sheet.appendRow(headers);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#2b2b36');
  headerRange.setFontColor('#ffffff');
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();

    if (sheet.getLastRow() === 0) {
      setupHeaders(sheet);
    }

    var data = JSON.parse(e.postData.contents);

    // Se for teste de conexão (Ping)
    if (data.type === 'PING') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Conexão com Google Sheets realizada com sucesso!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var row = [
      data.id || '',
      data.timestamp || new Date().toISOString(),
      (data.player && data.player.name) || '',
      (data.player && data.player.hero) || '',
      (data.opponent && data.opponent.name) || '',
      (data.opponent && data.opponent.hero) || '',
      data.result || '',
      data.turnsCount || 0,
      (data.player && data.player.avgTurnValue !== undefined) ? data.player.avgTurnValue : '',
      (data.opponent && data.opponent.avgTurnValue !== undefined) ? data.opponent.avgTurnValue : '',
      (data.sideboardCards && data.sideboardCards.length > 0) ? data.sideboardCards.join(', ') : '-',
      data.notes || '',
      (data.rawLogs && data.rawLogs.length > 0) ? data.rawLogs.slice(0, 10).join(' | ') : ''
    ];

    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      rowNumber: sheet.getLastRow()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Webhook do Talishar Log Exporter está ativo e pronto para receber dados via POST.');
}
