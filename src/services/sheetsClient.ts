import type { MatchRecord } from '../types/match';

export interface SheetsResponse {
  success: boolean;
  rowNumber?: number;
  message?: string;
  error?: string;
}

/**
 * Sends a MatchRecord to the configured Google Apps Script Webhook.
 */
export async function sendMatchToSheets(
  match: MatchRecord,
  webhookUrl: string
): Promise<SheetsResponse> {
  const trimmedUrl = webhookUrl?.trim();
  if (!trimmedUrl) {
    return {
      success: false,
      error: 'URL do Webhook não configurada. Configure no popup da extensão.',
    };
  }

  try {
    const response = await fetch(trimmedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(match),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Servidor retornou status HTTP ${response.status}`,
      };
    }

    const data = await response.json().catch(() => ({ status: 'success' }));
    if (data.status === 'error') {
      return {
        success: false,
        error: data.message || 'Erro reportado pelo Google Apps Script',
      };
    }

    return {
      success: true,
      rowNumber: data.rowNumber,
      message: 'Partida gravada no Google Sheets com sucesso!',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Falha ao conectar com o Google Sheets',
    };
  }
}

/**
 * Tests connection to the Google Apps Script Webhook by sending a PING payload.
 */
export async function testSheetsConnection(webhookUrl: string): Promise<SheetsResponse> {
  const trimmedUrl = webhookUrl?.trim();
  if (!trimmedUrl) {
    return {
      success: false,
      error: 'Por favor, insira a URL do Webhook antes de testar.',
    };
  }

  try {
    const response = await fetch(trimmedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ type: 'PING' }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Servidor retornou status HTTP ${response.status}`,
      };
    }

    const data = await response.json().catch(() => ({ status: 'success' }));
    return {
      success: true,
      message: data.message || 'Conexão validada com sucesso!',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Não foi possível conectar à URL informada.',
    };
  }
}
