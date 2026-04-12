import { InvoiceInput } from './types';
import { AnafValidationError } from './errors';
import { buildInvoiceXml } from './ubl/InvoiceBuilder';
import { tryCatch } from './tryCatch';

/**
 * UBL XML Builder for ANAF e-Factura
 *
 * Handles generation of UBL 2.1 XML invoices that comply with Romanian CIUS-RO
 * specification for ANAF e-Factura.
 *
 * @example
 * ```typescript
 * const builder = new UblBuilder();
 *
 * const xml = builder.generateInvoiceXml({
 *   invoiceNumber: 'INV-2024-001',
 *   issueDate: new Date(),
 *   supplier: {
 *     registrationName: 'Company SRL',
 *     companyId: 'RO12345678',
 *     vatNumber: 'RO12345678',
 *     address: {
 *       street: 'Str. Example 1',
 *       city: 'Bucharest',
 *       postalZone: '010101'
 *     }
 *   },
 *   customer: {
 *     registrationName: 'Customer SRL',
 *     companyId: 'RO87654321',
 *     address: {
 *       street: 'Str. Customer 2',
 *       city: 'Cluj-Napoca',
 *       postalZone: '400001'
 *     }
 *   },
 *   lines: [
 *     {
 *       description: 'Product/Service',
 *       quantity: 1,
 *       unitPrice: 100,
 *       taxPercent: 19
 *     }
 *   ],
 *   isSupplierVatPayer: true
 * });
 * ```
 */
export class UblBuilder {
  /**
   * Generate UBL invoice XML
   *
   * Create a UBL 2.1 XML invoice that complies with Romanian CIUS-RO
   * specification for ANAF e-Factura.
   *
   * @param invoiceData Invoice data
   * @returns UBL XML string ready for upload
   * @throws {AnafValidationError} If invoice data is invalid
   */
  public generateInvoiceXml(invoiceData: InvoiceInput): string {
    const { data, error } = tryCatch(() => {
      return buildInvoiceXml(invoiceData);
    });

    if (error) {
      throw new AnafValidationError(`Failed to generate invoice XML: ${error.message}`);
    }

    return data;
  }
}
