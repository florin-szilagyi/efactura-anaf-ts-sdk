/**
 * UBL (Universal Business Language) Module
 *
 * This module provides functionality for generating UBL 2.1 XML invoices
 * compliant with Romanian CIUS-RO specification for ANAF e-Factura.
 */

export { buildInvoiceXml, buildUblInvoiceXml } from './InvoiceBuilder';

// Re-export types for convenience
export type {
  InvoiceInput,
  InvoiceLine,
  Party,
  Address,
  UblInvoiceInput,
  UblParty,
  UblAddress,
  UblInvoiceLine,
} from '../types';
