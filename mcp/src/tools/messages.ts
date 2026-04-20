import { z } from 'zod';
import { MessageFilter } from '@florinszilagyi/anaf-ts-sdk';
import type { EfacturaClient } from '@florinszilagyi/anaf-ts-sdk';
import { McpToolError, formatToolError } from '../errors.js';
import type { ToolResult } from './types.js';

const FILTER_MAP: Record<string, MessageFilter> = {
  sent: MessageFilter.InvoiceSent,
  received: MessageFilter.InvoiceReceived,
  errors: MessageFilter.InvoiceErrors,
  buyer: MessageFilter.BuyerMessage,
};

export const listMessagesInputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(60)
    .optional()
    .describe('Number of days to query (1-60). Mutually exclusive with start_time/end_time/page.'),
  start_time: z.number().int().optional().describe('Start Unix timestamp in ms (paginated mode)'),
  end_time: z.number().int().optional().describe('End Unix timestamp in ms (paginated mode)'),
  page: z.number().int().min(1).optional().describe('Page number (paginated mode)'),
  filter: z.enum(['sent', 'received', 'errors', 'buyer']).optional().describe('Message category filter'),
});

export type ListMessagesInput = z.infer<typeof listMessagesInputSchema>;

export interface MessagesDeps {
  efactura: Pick<EfacturaClient, 'getMessages' | 'getMessagesPaginated'>;
}

export async function handleListMessages(input: ListMessagesInput, deps: MessagesDeps): Promise<ToolResult> {
  try {
    const filtru = input.filter ? FILTER_MAP[input.filter] : undefined;
    const paginated = input.start_time !== undefined && input.end_time !== undefined && input.page !== undefined;
    const simple = input.days !== undefined;

    if (!paginated && !simple) {
      throw new McpToolError({
        code: 'BAD_USAGE',
        message: 'Provide either `days` (1-60) OR (`start_time`, `end_time`, `page`) together.',
        category: 'user_input',
      });
    }

    const response = paginated
      ? await deps.efactura.getMessagesPaginated({
          startTime: input.start_time as number,
          endTime: input.end_time as number,
          pagina: input.page as number,
          filtru,
        })
      : await deps.efactura.getMessages({ zile: input.days as number, filtru });

    return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
  } catch (err) {
    const wrapped =
      err instanceof McpToolError
        ? err
        : new McpToolError({
            code: 'MESSAGES_FAILED',
            message: err instanceof Error ? err.message : String(err),
            category: 'anaf_api',
          });
    return {
      content: [{ type: 'text', text: formatToolError(wrapped) }],
      isError: true,
    };
  }
}

export const LIST_MESSAGES_TOOL_DEFINITION = {
  name: 'anaf_list_messages',
  description:
    'List e-Factura messages for the active company. Use `days` (1-60) for simple listing or `start_time`+`end_time`+`page` for paginated queries. Optional filter: sent | received | errors | buyer. Requires ANAF auth.',
  inputSchema: listMessagesInputSchema,
};
