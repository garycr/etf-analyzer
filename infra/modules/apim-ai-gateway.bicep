// ──────────────────────────────────────────────────────────────
// Reference: APIM AI Gateway for FinOps token metering
// See .github/skills/finops.md §7 for architecture details.
// This is a REFERENCE template — adapt parameters to your environment.
// ──────────────────────────────────────────────────────────────

@description('Unique prefix for resource names')
param prefix string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('SKU for API Management')
@allowed(['Consumption', 'Developer', 'BasicV2', 'StandardV2'])
param apimSku string = 'BasicV2'

@description('Azure OpenAI account name (must already exist)')
param openAiAccountName string

@description('Azure OpenAI deployment name')
param openAiDeploymentName string

@description('Log Analytics workspace retention in days')
@minValue(30)
@maxValue(730)
param logRetentionDays int = 90

// ── Log Analytics Workspace ──────────────────────────────────

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-log'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: logRetentionDays
  }
}

// ── Application Insights ─────────────────────────────────────

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${prefix}-ai'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ── API Management ───────────────────────────────────────────

resource apim 'Microsoft.ApiManagement/service@2023-09-01-preview' = {
  name: '${prefix}-apim'
  location: location
  sku: {
    name: apimSku
    capacity: apimSku == 'Consumption' ? 0 : 1
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publisherEmail: 'admin@contoso.com'
    publisherName: prefix
  }
}

// ── APIM Diagnostic Settings (send to Log Analytics) ─────────

resource apimDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${prefix}-apim-diag'
  scope: apim
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { categoryGroup: 'allLogs', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

// ── Reference: Azure OpenAI (existing) ───────────────────────

resource openAi 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' existing = {
  name: openAiAccountName
}

// ── APIM Backend — Azure OpenAI ──────────────────────────────

resource apimBackend 'Microsoft.ApiManagement/service/backends@2023-09-01-preview' = {
  parent: apim
  name: 'azure-openai'
  properties: {
    protocol: 'http'
    url: '${openAi.properties.endpoint}openai'
    credentials: {
      header: {}
    }
    tls: {
      validateCertificateChain: true
      validateCertificateName: true
    }
  }
}

// ── APIM Named Value — App Insights Key ──────────────────────

resource apimAppInsightsKey 'Microsoft.ApiManagement/service/namedValues@2023-09-01-preview' = {
  parent: apim
  name: 'appinsights-key'
  properties: {
    displayName: 'appinsights-key'
    secret: true
    value: appInsights.properties.InstrumentationKey
  }
}

// ── APIM API — Azure OpenAI proxy ────────────────────────────

resource apimApi 'Microsoft.ApiManagement/service/apis@2023-09-01-preview' = {
  parent: apim
  name: 'azure-openai-api'
  properties: {
    displayName: 'Azure OpenAI API'
    path: 'openai'
    protocols: ['https']
    subscriptionRequired: true
    serviceUrl: '${openAi.properties.endpoint}openai'
  }
}

// ── APIM Policy — token metering + caching + rate limit ──────

resource apimApiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-09-01-preview' = {
  parent: apimApi
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: '''
<policies>
  <inbound>
    <base />
    <!-- Authenticate to Azure OpenAI with APIM managed identity -->
    <authentication-managed-identity resource="https://cognitiveservices.azure.com" />
    <!-- Rate limit per subscription key: 100 requests per minute -->
    <rate-limit-by-key calls="100" renewal-period="60"
      counter-key="@(context.Subscription.Id)" />
    <!-- Semantic caching: return cached response for similar prompts -->
    <azure-openai-semantic-cache-lookup score-threshold="0.95"
      embeddings-backend-id="azure-openai"
      embeddings-backend-auth="system-assigned" />
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
    <!-- Emit token usage metrics to Azure Monitor -->
    <azure-openai-emit-token-metric>
      <dimension name="Subscription" value="@(context.Subscription.Id)" />
      <dimension name="Agent-Role"
        value="@(context.Request.Headers.GetValueOrDefault("X-Agent-Role","unknown"))" />
      <dimension name="Project"
        value="@(context.Request.Headers.GetValueOrDefault("X-Project","unknown"))" />
    </azure-openai-emit-token-metric>
    <!-- Store response in semantic cache -->
    <azure-openai-semantic-cache-store duration="3600" />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>
'''
  }
}

// ── Role Assignment — APIM → Azure OpenAI (Cognitive Services User) ──

@description('Cognitive Services User role ID')
var cognitiveServicesUserRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908'

resource apimOpenAiRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(apim.id, openAi.id, cognitiveServicesUserRoleId)
  scope: openAi
  properties: {
    principalId: apim.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
    principalType: 'ServicePrincipal'
  }
}

// ── Outputs ──────────────────────────────────────────────────

output apimGatewayUrl string = apim.properties.gatewayUrl
output apimName string = apim.name
output logAnalyticsId string = logAnalytics.id
output appInsightsConnectionString string = appInsights.properties.ConnectionString
