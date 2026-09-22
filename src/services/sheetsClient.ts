import type { MatchRecord } from '../types/match';

export interface SheetsResponse {
  success: boolean;
  rowNumber?: number;
  message?: string;
  error?: string;
}

/**
 * Sanitizes a URL string by trimming whitespace and stripping surrounding quotes.
 */
export function sanitizeUrl(url?: string): string {
  if (!url) return '';
  return url.trim().replace(/^["'`]+|["'`]+$/g, '');
}

/**
 * Validates a Webhook URL and returns informative diagnostics in Portuguese.
 */
export function validateWebhookUrl(url?: string): { valid: boolean; url: string; error?: string } {
  const clean = sanitizeUrl(url);
  if (!clean) {
    return {
      valid: false,
      url: '',
      error: 'URL do Webhook não configurada. Configure no popup da extensão.',
    };
  }

  try {
    const parsed = new URL(clean);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        valid: false,
        url: clean,
        error: 'A URL deve iniciar com https:// ou http://.',
      };
    }

    // Common pitfall 1: User pasted spreadsheet link
    if (parsed.hostname.includes('docs.google.com') && parsed.pathname.includes('/spreadsheets/')) {
      return {
        valid: false,
        url: clean,
        error:
          'Você informou o link da planilha do Google Docs, e não a URL do Webhook. Cole a URL da Implantação do Apps Script (terminada em /exec).',
      };
    }

    // Common pitfall 2: User pasted Apps Script code editor URL
    if (parsed.hostname.includes('script.google.com') && parsed.pathname.endsWith('/edit')) {
      return {
        valid: false,
        url: clean,
        error:
          'Você informou o link do editor do Apps Script (/edit). Vá em Implantar > Nova Implantação e copie a URL do Web App (/exec).',
      };
    }

    return { valid: true, url: clean };
  } catch {
    return {
      valid: false,
      url: clean,
      error: `A URL informada é inválida: "${clean}". Verifique se copiou a URL completa do Webhook (https://script.google.com/macros/s/.../exec).`,
    };
  }
}

/**
 * Sends a MatchRecord to the configured Google Apps Script Webhook.
 */
export async function sendMatchToSheets(
  match: MatchRecord,
  webhookUrl: string,
  timeoutMs: number = 15000
): Promise<SheetsResponse> {
  const validation = validateWebhookUrl(webhookUrl);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(validation.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(match),
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Servidor retornou status HTTP ${response.status}`,
      };
    }

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        return {
          success: false,
          error:
            'A URL informada retornou uma página HTML em vez de resposta do Webhook. Certifique-se de usar a URL de Implantação (.../exec).',
        };
      }
      data = { status: 'success' };
    }

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
    if (err?.name === 'AbortError') {
      return {
        success: false,
        error: `Tempo limite esgotado (${Math.round(timeoutMs / 1000)}s). O servidor do Google Sheets demorou para responder. Verifique sua conexão.`,
      };
    }
    const isNetworkError =
      err?.message === 'NetworkError when attempting to fetch resource.' ||
      err?.message?.includes('Failed to fetch');
    return {
      success: false,
      error: isNetworkError
        ? 'Erro de rede ou bloqueio de CORS ao tentar conectar. Certifique-se de que a Implantação no Apps Script está configurada com "Quem tem acesso" = "Qualquer pessoa" (Anyone).'
        : err?.message || 'Falha ao conectar com o Google Sheets',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Tests connection to the Google Apps Script Webhook by sending a PING payload.
 */
export async function testSheetsConnection(
  webhookUrl: string,
  timeoutMs: number = 12000
): Promise<SheetsResponse> {
  const validation = validateWebhookUrl(webhookUrl);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(validation.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ type: 'PING' }),
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Servidor retornou status HTTP ${response.status}`,
      };
    }

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        return {
          success: false,
          error:
            'A URL retornou uma página HTML e não a resposta do Webhook. Verifique se copiou a URL de Implantação (/exec) e se "Quem pode acessar" está como "Qualquer pessoa".',
        };
      }
      data = { status: 'success' };
    }

    if (data.status === 'error') {
      return {
        success: false,
        error: data.message || 'Erro reportado pelo script do Google Sheets',
      };
    }

    return {
      success: true,
      message: data.message || 'Conexão validada com sucesso!',
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        success: false,
        error: `Tempo limite esgotado (${Math.round(timeoutMs / 1000)}s). O Google Sheets demorou para responder. Verifique se copiou a URL correta (/exec) e se a Implantação está ativa como "Qualquer pessoa".`,
      };
    }
    const isNetworkError =
      err?.message === 'NetworkError when attempting to fetch resource.' ||
      err?.message?.includes('Failed to fetch');
    return {
      success: false,
      error: isNetworkError
        ? 'Erro de rede ou CORS ao conectar. Verifique se o Apps Script foi implantado como "App da Web" com acesso para "Qualquer pessoa" (Anyone).'
        : err?.message || 'Não foi possível conectar à URL informada.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
