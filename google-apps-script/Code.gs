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

function formatDate(isoString) {
  if (!isoString) return '';
  try {
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    var day = ('0' + d.getDate()).slice(-2);
    var month = ('0' + (d.getMonth() + 1)).slice(-2);
    var year = d.getFullYear();
    return day + '/' + month + '/' + year;
  } catch (e) {
    return isoString;
  }
}

function translateResult(res) {
  if (res === 'win') return 'Vitória';
  if (res === 'loss') return 'Derrota';
  if (res === 'draw') return 'Empate';
  return res || 'Desconhecido';
}

function setupHeaders(sheet) {
  var headers = [
    'Dia',
    'Jogador',
    'Deck',
    'Match',
    'Formato',
    'Resultado',
    'Iniciou',
    'Plataforma de Jogo',
    'Adversário',
    'Observações',
    'Turnos',
    'Meu Valor Médio/Turno',
    'Valor Médio/Turno Oponente',
    'Cartas Fora/Sideboard'
  ];
  sheet.appendRow(headers);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#2b2b36');
  headerRange.setFontColor('#ffffff');
}

function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = {};
      }
    }

    // Se for teste de conexão (Ping) - responde instantaneamente sem carregar a planilha
    if (data.type === 'PING') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Conexão com Google Sheets realizada com sucesso!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();

    if (sheet.getLastRow() === 0) {
      setupHeaders(sheet);
    }

    var playerHero = (data.player && data.player.hero) || '-';
    var oppHero = (data.opponent && data.opponent.hero) || '-';
    var matchTitle = oppHero;
    var wentFirstText = data.wentFirst === undefined ? '-' : (data.wentFirst ? 'Sim' : 'Não');
    var opponentName = (data.opponent && (data.opponent.name || data.opponent.hero)) || 'Oponente';

    var row = [
      formatDate(data.timestamp),
      (data.player && data.player.name) || 'Jogador',
      playerHero,
      matchTitle,
      data.format || 'CC',
      translateResult(data.result),
      wentFirstText,
      data.platform || 'Talishar',
      opponentName,
      data.notes || '',
      data.turnsCount || 0,
      (data.player && data.player.avgTurnValue !== undefined) ? data.player.avgTurnValue : '',
      (data.opponent && data.opponent.avgTurnValue !== undefined) ? data.opponent.avgTurnValue : '',
      (data.sideboardCards && data.sideboardCards.length > 0) ? data.sideboardCards.join(', ') : '-'
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
  try {
    // Se for requisição de teste/ping via GET
    if (e && e.parameter && (e.parameter.type === 'PING' || e.parameter.ping === '1')) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Conexão com Google Sheets validada com sucesso!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetUrl = ss.getUrl();
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<meta http-equiv="refresh" content="0;url=' + sheetUrl + '">' +
      '<title>Redirecionando...</title></head>' +
      '<body style="font-family:sans-serif;text-align:center;padding-top:50px;background:#181822;color:#fff;">' +
      '<h2>Abrindo sua planilha do Google Sheets...</h2>' +
      '<p><a href="' + sheetUrl + '" style="color:#38bdf8;">Clique aqui caso não seja redirecionado automaticamente</a></p>' +
      '</body></html>'
    );
  } catch (err) {
    return ContentService.createTextOutput('Webhook do Talishar Log Exporter está ativo e pronto para receber dados via POST.');
  }
}
