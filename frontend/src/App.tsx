import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import WalletStatus from "./components/WalletStatus";
import KycOnboarding from "./components/KycOnboarding";
import InvoiceList from "./components/InvoiceList";

export default function App() {
  const { publicKey } = useWallet();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>RWA Platform</h1>
      <WalletMultiButton />

      {publicKey && (
        <>
          <WalletStatus wallet={publicKey.toBase58()} />
          <KycOnboarding wallet={publicKey.toBase58()} />
          <InvoiceList />
        </>
      )}
    </div>
  );
}
