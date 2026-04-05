/**
 * InvoiceList — заглушка для отображения RWA-инвойсов.
 * После `anchor build && yarn copy-idl` подключить useInvoiceProgram
 * и загружать аккаунты через program.account.invoiceAccount.all()
 */
export default function InvoiceList() {
  return (
    <div style={{ marginTop: 32 }}>
      <h2>RWA Invoices</h2>
      <p style={{ color: "#888" }}>
        Run <code>anchor build && yarn copy-idl</code> to load on-chain invoices.
      </p>
    </div>
  );
}
