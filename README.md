# Proofund

Proofund es una dApp de crowdfunding sobre Ethereum Sepolia. Cada campaña se
despliega como un contrato independiente: las aportaciones quedan custodiadas
on-chain y solo pueden retirarse por el creador si la campaña alcanza su meta.
Si la campaña falla, se cancela o queda sin resolver tras el periodo de gracia,
los contribuyentes pueden reclamar su reembolso.

## Características

- Creación de campañas con objetivo en ETH, fecha límite, imagen y metadatos en IPFS.
- Conexión de wallet con MetaMask o Coinbase Wallet mediante wagmi/viem.
- Exploración de campañas desplegadas desde `CampaignFactory`.
- Vista de detalle con progreso, estado, historial de aportaciones, enlaces a Sepolia Etherscan y acciones on-chain.
- Acciones del creador: finalizar campaña, cancelar campaña y retirar fondos si fue exitosa.
- Reembolsos para contribuyentes cuando una campaña falla, se cancela o expira el periodo de gracia.
- Perfil de usuario con estadísticas indexadas desde The Graph.
- Interfaz bilingüe en español e inglés.

## Arquitectura

| Componente | Stack | Descripción |
| --- | --- | --- |
| `contracts/` | Solidity, OpenZeppelin, Hardhat 3 | Contratos `Campaign` y `CampaignFactory`, más tests Solidity. |
| `ignition/` | Hardhat Ignition | Módulos de despliegue para Sepolia. |
| `frontend/` | React 19, Vite, TypeScript, Tailwind CSS, daisyUI, wagmi, viem, i18next | Aplicación web para crear, explorar, financiar y gestionar campañas. |
| `server/` | Express, Multer, Axios, Pinata | API local que sube imagen y metadata JSON a IPFS. |
| `subgraph-proofund-sepolia/` | The Graph, AssemblyScript | Indexa campañas, aportaciones, reembolsos y retiradas. |
| `test/` | node:test, Hardhat viem | Tests TypeScript para flujos de contratos. |

## Contratos

### `CampaignFactory`

- `createCampaign(goalAmount, deadline, metadataURI)`: despliega una campaña y emite `CampaignCreated`.
- `getCampaigns()`: devuelve las direcciones de todas las campañas creadas.

Factory desplegada en Sepolia:

```text
0x1971f060774B1974090ed8EF48E35D53a7D5003e
```

### `Campaign`

Estados:

```text
ACTIVE -> SUCCESS | FAILED | CANCELLED
```

Funciones principales:

- `fund()`: permite aportar ETH mientras la campaña esté activa y antes del deadline.
- `finishCampaign()`: el creador marca la campaña como `SUCCESS` si alcanzó la meta o `FAILED` si venció sin alcanzarla.
- `withdraw()`: el creador retira los fondos una sola vez cuando la campaña está en `SUCCESS`.
- `refund()`: devuelve la aportación del usuario si la campaña no fue exitosa; si sigue activa 7 días después del deadline, la cancela y habilita reembolsos.
- `cancelCampaign()`: el creador cancela una campaña activa.

## Requisitos

- Node.js reciente compatible con Hardhat 3 y Vite.
- npm.
- Wallet con Sepolia ETH para interactuar con la dApp.
- JWT de Pinata para subir imágenes y metadatos a IPFS.
- RPC de Sepolia para desplegar o verificar contratos.

## Variables de entorno

En la raíz del proyecto, para Hardhat:

```env
SEPOLIA_RPC_URL=https://...
SEPOLIA_PRIVATE_KEY=...
ETHERSCAN_API_KEY=...
```

Hardhat 3 también permite guardar secretos con su keystore:

```shell
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat keystore set ETHERSCAN_API_KEY
```

En `server/.env`:

```env
PINATA_JWT=...
```

El frontend no requiere `.env` en el estado actual: usa Sepolia, el backend local en
`http://localhost:3001` y la dirección de `CampaignFactory` incluida en el repo.

## Instalación

Instala dependencias por paquete:

```shell
npm install

cd server
npm install

cd ../frontend
npm install

cd ../subgraph-proofund-sepolia
npm install
```

## Ejecutar en local

Levanta primero el backend de IPFS:

```shell
cd server
npm run dev
```

El servidor queda disponible en:

```text
http://localhost:3001
```

Luego levanta el frontend:

```shell
cd frontend
npm run dev
```

Vite sirve la app normalmente en:

```text
http://localhost:5173
```

Para crear campañas desde la interfaz necesitas:

- Backend corriendo en `localhost:3001`.
- Wallet conectada a Sepolia.
- Fondos de prueba para pagar gas.
- `PINATA_JWT` configurado en el backend.

## Tests

Contratos:

```shell
npx hardhat test
```

Frontend:

```shell
cd frontend
npm test
```

Frontend en modo CI:

```shell
cd frontend
npm run test:run
```

Subgraph:

```shell
cd subgraph-proofund-sepolia
npm test
```

## Despliegue

Desplegar `CampaignFactory` con Ignition en Sepolia:

```shell
npx hardhat ignition deploy ignition/modules/CampaignFactory.ts --network sepolia
```

Verificar contratos en Etherscan, si aplica:

```shell
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

Después de un nuevo despliegue, actualiza estos archivos para mantener la app y
el subgraph apuntando al contrato correcto:

- `frontend/src/contracts/address/campaignFactoryContractAddress.ts`
- `subgraph-proofund-sepolia/subgraph.yaml`
- `ignition/deployments/chain-11155111/deployed_addresses.json`

## Subgraph

El subgraph escucha `CampaignCreated` en `CampaignFactory` y crea plantillas
dinámicas para cada contrato `Campaign`. Indexa:

- `Campaign`
- `Contribution`
- `Refund`
- `Withdrawal`

Comandos útiles:

```shell
cd subgraph-proofund-sepolia
npm run codegen
npm run build
npm run deploy
```

Para entorno local con Graph Node:

```shell
docker compose up
npm run create-local
npm run deploy-local
```

## Estructura rápida

```text
proofund/
|- contracts/                  # Smart contracts y tests Solidity
|- frontend/                   # dApp React/Vite
|- ignition/                   # Módulos y artefactos de despliegue
|- server/                     # API de subida a IPFS con Pinata
|- subgraph-proofund-sepolia/  # Subgraph para Sepolia
|- test/                       # Tests Hardhat TypeScript
|- hardhat.config.ts
`- package.json
```

## Flujo funcional

1. El creador completa el formulario de campaña en el frontend.
2. El backend sube la imagen a Pinata y crea un JSON de metadata en IPFS.
3. El frontend llama a `CampaignFactory.createCampaign(...)` con objetivo, deadline y `metadataURI`.
4. Los usuarios aportan ETH llamando a `fund()` desde la vista de detalle.
5. El creador finaliza la campaña:
   - `SUCCESS` si se alcanzó la meta.
   - `FAILED` si venció sin alcanzar la meta.
6. Si fue exitosa, el creador llama a `withdraw()`.
7. Si no fue exitosa, los contribuyentes llaman a `refund()`.
