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

@description('Azure OpenAI endpoint (leave empty to skip)')
param azureOpenAiEndpoint string = ''

@description('Azure OpenAI deployment name')
param azureOpenAiDeploymentName string = 'gpt-5-1-codex-mini'

@description('Azure OpenAI API key (leave empty to use managed identity)')
@secure()
param azureOpenAiApiKey string = ''

@description('Azure OpenAI API version')
param azureOpenAiApiVersion string = '2025-01-01-preview'

// ── Name variables ───────────────────────────────────────────
var suffix             = '${prefix}-${environment}'
var storageAccountName = take(replace('${prefix}${environment}st', '-', ''), 24)
var functionAppName    = '${suffix}-func'
var staticWebAppName   = '${suffix}-swa'
var appInsightsName    = '${suffix}-appi'
var logAnalyticsName   = '${suffix}-law'
var appServicePlanName = '${suffix}-asp'

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

// ── Storage connection string (local var) ────────────────────
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${az.environment().suffixes.storage}'

// ── Function App ─────────────────────────────────────────────
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
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
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'STORAGE_CONNECTION_STRING'
          value: storageConnectionString
        }
        {
          name: 'NOTES_CONTAINER'
          value: 'notes'
        }
        {
          // Set this in GitHub secrets / Azure portal after deployment
          name: 'OPENAI_API_KEY'
          value: ''
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: azureOpenAiEndpoint
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT_NAME'
          value: azureOpenAiDeploymentName
        }
        {
          name: 'AZURE_OPENAI_API_KEY'
          value: azureOpenAiApiKey
        }
        {
          name: 'AZURE_OPENAI_API_VERSION'
          value: azureOpenAiApiVersion
        }
      ]
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}deployments'
          authentication: {
            type: 'StorageAccountConnectionString'
            storageAccountConnectionStringName: 'AzureWebJobsStorage'
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
