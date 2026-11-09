/**
 * Smart Salon LK - LankaQR & POS Billing Utilities
 * Compliant with Central Bank of Sri Lanka (CBSL) LankaQR / EMVCo Standard Specifications.
 */

export interface LankaQRParams {
  merchantId: string;
  merchantName: string;
  merchantCity: string;
  amountLkr: number;
  referenceId: string;
  accountNumber?: string;
}

/**
 * Format an EMVCo TLV (Tag-Length-Value) element
 */
function formatTlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

/**
 * Compute CRC16 CCITT checksum (EMVCo Tag 63)
 */
function computeCrc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generate standard EMVCo payload string for LankaQR dynamic scan
 */
export function generateLankaQrPayload(params: LankaQRParams): string {
  const payloadFormat = formatTlv('00', '01'); // Version 01
  const pointOfInitiation = formatTlv('01', '12'); // 12: Dynamic QR (Amount fixed by merchant)

  // Tag 26: Merchant Account Information for LankaQR
  const lankaQrSubTlv =
    formatTlv('00', 'LK.GOV.CBSL.LANKAQR') +
    formatTlv('01', params.accountNumber || '800123456789') +
    formatTlv('02', params.merchantId);
  const merchantAccountInfo = formatTlv('26', lankaQrSubTlv);

  const merchantCategoryCode = formatTlv('52', '7230'); // 7230: Barber and Beauty Shops
  const transactionCurrency = formatTlv('53', '144'); // 144: Sri Lankan Rupee (LKR)
  const transactionAmount = formatTlv('54', params.amountLkr.toFixed(2));
  const countryCode = formatTlv('58', 'LK'); // Sri Lanka
  const merchantName = formatTlv('59', params.merchantName.substring(0, 25));
  const merchantCity = formatTlv('60', params.merchantCity.substring(0, 15));

  // Tag 62: Additional Data Field (Reference / Invoice ID)
  const refSubTlv = formatTlv('01', params.referenceId);
  const additionalData = formatTlv('62', refSubTlv);

  const payloadWithoutCrc =
    payloadFormat +
    pointOfInitiation +
    merchantAccountInfo +
    merchantCategoryCode +
    transactionCurrency +
    transactionAmount +
    countryCode +
    merchantName +
    merchantCity +
    additionalData +
    '6304';

  const crc = computeCrc16(payloadWithoutCrc);
  return payloadWithoutCrc + crc;
}

/**
 * Barcode value generator for paper receipts / screen scanning
 */
export function generateBarcodeValue(invoiceNumber: string): string {
  return invoiceNumber.replace(/[^A-Za-z0-9]/g, '');
}

