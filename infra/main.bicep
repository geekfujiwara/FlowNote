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

// ── App Service Plan (Consumption / Linux) ───────────────────
resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
  properties: {
    reserved: true // required for Linux
  }
}

// ── Storage connection string (local var) ────────────────────
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${az.environment().suffixes.storage}'

// ── Function App ─────────────────────────────────────────────
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|${pythonVersion}'
      pythonVersion: pythonVersion
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
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'python'
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
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
      ]
    }
  }
}

// ── Static Web App ───────────────────────────────────────────
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: 'eastasia' // SWA has limited regions; use closest available
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
