import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { coinbaseWallet, metaMask } from "wagmi/connectors";

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    metaMask(),
    coinbaseWallet({
      appName: "Proofund",
    }),
  ],
  transports: {
    [sepolia.id]: http(),
  },
});
