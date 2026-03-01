// ============================================================
// FlowNote – Azure Infrastructure
// Target scope: resource group
// ============================================================
targetScope = 'resourceGroup'

// ── Parameters ──────────────────────────────────────────────
@description('Base prefix for all resource names')
param prefix string = 'flownote'

@description('Environment label (prod / staging)')
param environment string = 'prod'

@description('Azure region (defaults to resource group location)')
param location string = resourceGroup().location

@description('Python runtime version for Function App')
param pythonVersion string = '3.11'

@description('GitHub repo URL (used for SWA metadata only)')
param repositoryUrl string = 'https://github.com/geekfujiwara/FlowNote'

@description('Azure OpenAI deployment name')
param azureOpenAiDeploymentName string = 'gpt-5-1-codex-mini'

@description('Azure OpenAI API version')
param azureOpenAiApiVersion string = 'preview'

@description('Azure OpenAI model name')
param azureOpenAiModelName string = 'gpt-5.1-codex-mini'

@description('Azure OpenAI model version')
param azureOpenAiModelVersion string = '2025-11-13'

@description('Azure OpenAI GlobalStandard capacity (TPM units)')
param azureOpenAiCapacity int = 10

// ── Name variables ───────────────────────────────────────────
var suffix             = '${prefix}-${environment}'
var storageAccountName = take(replace('${prefix}${environment}st', '-', ''), 24)
var functionAppName    = '${suffix}-func'
var staticWebAppName   = '${suffix}-swa'
var appInsightsName    = '${suffix}-appi'
var logAnalyticsName   = '${suffix}-law'
var appServicePlanName = '${suffix}-asp'
var openAiAccountName  = '${suffix}-oai'

// ── Log Analytics Workspace ──────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ── Application Insights ─────────────────────────────────────
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ── Storage Account ──────────────────────────────────────────
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    accessTier: 'Hot'
  }
}

// ── Blob Service ─────────────────────────────────────────────
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storage
  name: 'default'
}

// ── Notes Blob Container ─────────────────────────────────────
resource notesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'notes'
  properties: {
    publicAccess: 'None'
  }
}

// ── Deployments Blob Container (Flex Consumption) ────────────
resource deploymentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'deployments'
  properties: {
    publicAccess: 'None'
  }
}

// ── App Service Plan (Flex Consumption / Linux) ─────────────
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  kind: 'functionapp'
  properties: {
    reserved: true // required for Linux
  }
}

// ── Azure OpenAI ─────────────────────────────────────────────
resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: openAiAccountName
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: openAiAccountName
    publicNetworkAccess: 'Enabled'
  }
}

// ── Model Deployment ─────────────────────────────────────────
resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: azureOpenAiDeploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: azureOpenAiCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: azureOpenAiModelName
      version: azureOpenAiModelVersion
    }
  }
}

// ── Role IDs ──────────────────────────────────────────────────
// Storage Blob Data Owner
var storageBlobDataOwnerRoleId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
// Cognitive Services OpenAI User
var cognitiveServicesOpenAiUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

// ── Function App ─────────────────────────────────────────────
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      cors: {
        allowedOrigins: ['*']
        supportCredentials: false
      }
      appSettings: [
        {
          // Managed identity auth: no key required
          name: 'AzureWebJobsStorage__accountName'
          value: storage.name
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          // Blob URL for managed-identity-based storage access in Python backend
          name: 'STORAGE_ACCOUNT_URL'
          value: storage.properties.primaryEndpoints.blob
        }
        {
          name: 'NOTES_CONTAINER'
          value: 'notes'
        }
        {
          // Azure OpenAI endpoint – managed identity auth (no key)
          name: 'AZURE_OPENAI_ENDPOINT'
          value: openAi.properties.endpoint
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT_NAME'
          value: azureOpenAiDeploymentName
        }
        {
          name: 'AZURE_OPENAI_API_VERSION'
          value: azureOpenAiApiVersion
        }
        {
          // Disable OpenTelemetry SDK to avoid SpanAttributes version incompatibilities
          name: 'OTEL_SDK_DISABLED'
          value: 'true'
        }
      ]
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}deployments'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 10  // cost cap
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'python'
        version: pythonVersion
      }
    }
  }
}

// ── Role Assignment: Function App → Storage Blob Data Owner ──
resource funcStorageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, functionApp.id, storageBlobDataOwnerRoleId)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataOwnerRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Role Assignment: Function App → Cognitive Services OpenAI User ──
resource funcOpenAiRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openAi.id, functionApp.id, cognitiveServicesOpenAiUserRoleId)
  scope: openAi
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesOpenAiUserRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
  dependsOn: [modelDeployment]
}

// ── Static Web App ───────────────────────────────────────────
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: 'eastus2' // SWA supported region close to eastus
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

// ── Outputs ──────────────────────────────────────────────────
output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output staticWebAppName string = staticWebApp.name
output staticWebAppHostname string = staticWebApp.properties.defaultHostname
output storageAccountName string = storage.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output openAiEndpoint string = openAi.properties.endpoint
output openAiDeploymentName string = modelDeployment.name
