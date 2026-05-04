#!/bin/bash

# PetConnect - Azure Infrastructure Provisioning Script (Logic Apps Architecture)
# Student: Chibuike Nwachukwu (B00911346)
# Module: COM682 Cloud Native Development - Coursework 2

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   PetConnect Infrastructure Setup     ║${NC}"
echo -e "${BLUE}║      Logic Apps Architecture          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Variables
RG="PetConnect-RG"
LOCATION="spaincentral"
STUDENT_ID="b911346"
COSMOS_ACCOUNT="petconnect-cosmos-${STUDENT_ID}"
STORAGE_ACCOUNT="petconnect${STUDENT_ID}"
CONTAINER_NAME="pet-images"
INSIGHTS_NAME="petconnect-insights"
LOGS_NAME="petconnect-logs"
VISION_NAME="petconnect-vision"

echo -e "${GREEN}[1/9] Ensuring Resource Group exists...${NC}"
az group create \
  --name $RG \
  --location $LOCATION \
  --output table 2>/dev/null || echo "Resource group already exists"

echo ""
echo -e "${GREEN}[2/9] Creating Log Analytics Workspace...${NC}"
az monitor log-analytics workspace create \
  --resource-group $RG \
  --workspace-name $LOGS_NAME \
  --location $LOCATION \
  --output table

echo ""
echo -e "${GREEN}[3/9] Creating Application Insights...${NC}"
WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group $RG \
  --workspace-name $LOGS_NAME \
  --query id -o tsv)

az monitor app-insights component create \
  --app $INSIGHTS_NAME \
  --resource-group $RG \
  --location $LOCATION \
  --kind web \
  --application-type web \
  --workspace $WORKSPACE_ID \
  --output table

echo ""
echo -e "${GREEN}[4/9] Creating Storage Account (Standard LRS)...${NC}"
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RG \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --allow-blob-public-access true \
  --output table

echo ""
echo -e "${GREEN}[5/9] Creating Blob Container (pet-images)...${NC}"
az storage container create \
  --name $CONTAINER_NAME \
  --account-name $STORAGE_ACCOUNT \
  --public-access blob \
  --output table

echo ""
echo -e "${GREEN}[6/9] Enabling Static Website hosting...${NC}"
az storage blob service-properties update \
  --account-name $STORAGE_ACCOUNT \
  --static-website \
  --index-document index.html \
  --404-document index.html

echo ""
echo -e "${GREEN}[7/9] Creating Cosmos DB Account (Serverless)...${NC}"
az cosmosdb create \
  --name $COSMOS_ACCOUNT \
  --resource-group $RG \
  --locations regionName=$LOCATION \
  --default-consistency-level Session \
  --enable-free-tier false \
  --capabilities EnableServerless \
  --output table

echo ""
echo -e "${GREEN}[8/9] Creating Cosmos DB Database (petdb)...${NC}"
az cosmosdb sql database create \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RG \
  --name petdb \
  --output table

echo ""
echo -e "${GREEN}[9/9] Creating Cosmos DB Container (pets)...${NC}"
az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RG \
  --database-name petdb \
  --name pets \
  --partition-key-path "/id" \
  --output table

echo ""
echo -e "${YELLOW}[OPTIONAL] Creating Cognitive Services (Computer Vision)...${NC}"
echo -e "${YELLOW}Note: Free tier (F0) may require manual approval or may not be available${NC}"
az cognitiveservices account create \
  --name $VISION_NAME \
  --resource-group $RG \
  --location $LOCATION \
  --kind ComputerVision \
  --sku S1 \
  --yes \
  --output table || echo -e "${YELLOW}⚠ Vision API creation skipped (create manually if needed)${NC}"

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Base Infrastructure Provisioning Complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

echo "Retrieving connection strings and keys..."
echo ""

# Retrieve Cosmos DB connection info
echo -e "${GREEN}Cosmos DB Endpoint:${NC}"
COSMOS_ENDPOINT=$(az cosmosdb show \
  --name $COSMOS_ACCOUNT \
  --resource-group $RG \
  --query documentEndpoint \
  --output tsv)
echo $COSMOS_ENDPOINT

echo ""
echo -e "${GREEN}Cosmos DB Primary Key:${NC}"
COSMOS_KEY=$(az cosmosdb keys list \
  --name $COSMOS_ACCOUNT \
  --resource-group $RG \
  --query primaryMasterKey \
  --output tsv)
echo $COSMOS_KEY

echo ""
echo -e "${GREEN}Storage Account Key:${NC}"
STORAGE_KEY=$(az storage account keys list \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RG \
  --query '[0].value' \
  --output tsv)
echo $STORAGE_KEY

echo ""
echo -e "${GREEN}Storage Connection String:${NC}"
STORAGE_CONN=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RG \
  --query connectionString \
  --output tsv)
echo $STORAGE_CONN

echo ""
echo -e "${GREEN}Application Insights Connection String:${NC}"
INSIGHTS_CONN=$(az monitor app-insights component show \
  --app $INSIGHTS_NAME \
  --resource-group $RG \
  --query connectionString \
  --output tsv)
echo $INSIGHTS_CONN

echo ""
echo -e "${GREEN}Computer Vision Endpoint:${NC}"
VISION_ENDPOINT=$(az cognitiveservices account show \
  --name $VISION_NAME \
  --resource-group $RG \
  --query properties.endpoint \
  --output tsv 2>/dev/null || echo "Not created")
echo $VISION_ENDPOINT

echo ""
echo -e "${GREEN}Computer Vision Key:${NC}"
VISION_KEY=$(az cognitiveservices account keys list \
  --name $VISION_NAME \
  --resource-group $RG \
  --query key1 \
  --output tsv 2>/dev/null || echo "Not created")
echo $VISION_KEY

echo ""
echo -e "${GREEN}Static Website URL:${NC}"
WEBSITE_URL=$(az storage account show \
  --name $STORAGE_ACCOUNT \
  --resource-group $RG \
  --query primaryEndpoints.web \
  --output tsv)
echo $WEBSITE_URL

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${GREEN}Next Steps:${NC}"
echo ""
echo "1. Deploy Logic Apps using ARM template:"
echo "   ${YELLOW}az deployment group create \\${NC}"
echo "   ${YELLOW}  --resource-group $RG \\${NC}"
echo "   ${YELLOW}  --template-file infrastructure/logic-apps.json \\${NC}"
echo "   ${YELLOW}  --parameters cosmosKey=\"$COSMOS_KEY\" \\${NC}"
echo "   ${YELLOW}               storageAccountKey=\"$STORAGE_KEY\" \\${NC}"
echo "   ${YELLOW}               visionKey=\"$VISION_KEY\"${NC}"
echo ""
echo "2. Get Logic App trigger URLs from Azure Portal"
echo "3. Add URLs to .env file"
echo "4. Deploy frontend via GitHub Actions"
echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
