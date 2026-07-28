export interface ReceiptExtraction {
  vendor: string;
  amount: number;
  currency: string;
  date: string;
  categorySuggestion: string | null;
}

export interface ScanReceiptResult {
  receiptUrl: string;
  extracted: ReceiptExtraction;
}

// Not the generic api/client.ts wrapper: file uploads need multipart/form-data
// with a browser-generated boundary, which requires leaving Content-Type
// unset (fetch sets it correctly from the FormData body) rather than the
// wrapper's fixed application/json header.
export async function scanReceipt(file: File): Promise<ScanReceiptResult> {
  const formData = new FormData();
  formData.append("receipt", file);

  const res = await fetch("/api/v1/receipts/scan", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const body: { data?: ScanReceiptResult; error?: { code: string; message: string } } = await res.json();

  if (!res.ok || !body.data) {
    throw new Error(body.error?.message ?? "Failed to scan receipt");
  }

  return body.data;
}
