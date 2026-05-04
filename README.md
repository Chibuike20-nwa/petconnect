# PetConnect

Cloud-native multimedia sharing platform — COM682 CW2, Chibuike Nwachukwu (B00911346).

---

## Live URL

**Frontend:** https://petconnectb911346.z43.web.core.windows.net

---

## Architecture

```
Browser (Frontend - Static Web App)
      │
      │  HTTP triggers (SAS-signed URLs, injected at deploy via .env)
      ▼
┌──────────────────────────────────────────┐
│          Azure Logic Apps                │
│  petconnect-list-all-pets                │
│  petconnect-get-pet                      │
│  petconnect-create-pet                   │
│  petconnect-update-pet                   │
│  petconnect-delete-pet                   │
└────────────┬────────────────┬────────────┘
             │                │
     ┌───────▼──────┐  ┌──────▼──────────┐
     │  Cosmos DB   │  │  Blob Storage   │
     │  (metadata)  │  │  (media files)  │
     └──────────────┘  └─────────────────┘
                    │
           ┌────────▼────────┐
           │  App Insights   │
           │  (telemetry)    │
           └─────────────────┘
```

---

## Azure Resources (Spain Central)

| Resource | Name | Purpose |
|---|---|---|
| Resource Group | `PetConnect-RG` | Container for all resources |
| Logic App | `petconnect-list-all-pets` | GET — list all records |
| Logic App | `petconnect-get-pet` | GET — single record by ID |
| Logic App | `petconnect-create-pet` | POST — upload file + create record |
| Logic App | `petconnect-update-pet` | POST — update record metadata |
| Logic App | `petconnect-delete-pet` | POST — delete blob + metadata |
| Cosmos DB | `petconnect-cosmos-chibuike` | Record metadata (Serverless, SQL API) |
| Blob Storage | `petconnectb911346` | Binary media files (Standard LRS) |
| Application Insights | `petconnect-insights` | Telemetry + monitoring |
| Log Analytics Workspace | `petconnect-logs` | Logic App execution logs |

---

## Record Schema (Cosmos DB)

```json
{
  "id": "uuid",
  "fileName": "photo.jpg",
  "fileLocator": "https://petconnectb911346.blob.core.windows.net/pet-images/uuid.jpg",
  "userID": "owner@email.com",
  "contentType": "image/jpeg",
  "createdAt": "2026-05-05T00:00:00Z",
  "updatedAt": "2026-05-05T00:00:00Z"
}
```

---

## Logic App Workflow Patterns

**petconnect-list-all-pets** (List): `HTTP GET → Cosmos DB query → 200 [ ]`

**petconnect-get-pet** (Get): `HTTP GET /{id} → Cosmos DB get → 200 { }`

**petconnect-create-pet** (Create): `HTTP POST → base64 decode → Blob Storage create → Cosmos DB create → 201 { }`

**petconnect-update-pet** (Update): `HTTP POST → Cosmos DB read → merge fields → Cosmos DB upsert → 200 { }`

**petconnect-delete-pet** (Delete): `HTTP POST → Cosmos DB read → Blob Storage delete → Cosmos DB delete → 204`

### Request payloads

**Create:**
```json
{ "fileName": "photo.jpg", "userID": "owner@email.com", "contentType": "image/jpeg", "fileContent": "<base64>" }
```

**Update:**
```json
{ "id": "<record-id>", "fileName": "new-name.jpg", "userID": "owner@email.com" }
```

**Delete:**
```json
{ "id": "<record-id>" }
```

---

## Project Structure

```
petconnect/
├── frontend/
│   ├── index.html           # Single-page UI — upload, gallery, edit, delete
│   ├── app.js               # Logic App fetch calls, drag-and-drop, modals
│   └── styles.css           # Layout and component styles
├── infrastructure/
│   ├── provision.sh         # Azure CLI provisioning script
│   └── petconnect-logic-apps.json  # ARM template — deploys all 5 Logic Apps + connectors
├── .github/workflows/
│   └── deploy-frontend.yml  # CI/CD: push → envsubst URLs → upload to $web
├── .env.example             # Required environment variable names
├── .env                     # Actual values (gitignored — never committed)
└── .gitignore
```

---

## Environment Variables

Logic App trigger URLs are stored in `.env` (gitignored) and injected at deploy time.

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
# edit .env with your Logic App trigger URLs
```

| Variable | Description |
|---|---|
| `LA_LIST_ALL_PETS` | petconnect-list-all-pets trigger URL |
| `LA_GET_PET` | petconnect-get-pet trigger URL |
| `LA_CREATE_PET` | petconnect-create-pet trigger URL |
| `LA_UPDATE_PET` | petconnect-update-pet trigger URL |
| `LA_DELETE_PET` | petconnect-delete-pet trigger URL |

Get trigger URLs from Azure Portal → Logic Apps → select app → Overview → Trigger URL.

---

## Deploy Logic Apps (ARM Template)

```bash
COSMOS_KEY=$(az cosmosdb keys list --name petconnect-cosmos-chibuike \
  --resource-group PetConnect-RG --query primaryMasterKey -o tsv)

STORE_KEY=$(az storage account keys list --account-name petconnectb911346 \
  --resource-group PetConnect-RG --query '[0].value' -o tsv)

az deployment group create \
  --resource-group PetConnect-RG \
  --template-file infrastructure/petconnect-logic-apps.json \
  --parameters cosmosKey="$COSMOS_KEY" storageAccountKey="$STORE_KEY"
```

---

## CI/CD

Push to `main` → GitHub Actions substitutes Logic App URLs from secrets → uploads `frontend/` to Azure Blob Storage `$web`.

**Required GitHub secrets:**

| Secret | Description |
|---|---|
| `PETCONNECT_STORAGE_KEY` | Azure Storage account key |
| `LA_LIST_ALL_PETS` | petconnect-list-all-pets trigger URL |
| `LA_GET_PET` | petconnect-get-pet trigger URL |
| `LA_CREATE_PET` | petconnect-create-pet trigger URL |
| `LA_UPDATE_PET` | petconnect-update-pet trigger URL |
| `LA_DELETE_PET` | petconnect-delete-pet trigger URL |

---

## Student Information

- **Name**: Chibuike Nwachukwu
- **Student ID**: B00911346
- **Module**: COM682 Cloud Native Development
- **Assignment**: Coursework 2
