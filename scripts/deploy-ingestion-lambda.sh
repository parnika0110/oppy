#!/usr/bin/env bash
#
# Deploy the standalone OPPY ingestion Lambda to AWS.
#
# Prerequisites:
#   1. AWS CLI v2 installed and configured (aws configure)
#   2. handler.zip rebuilt: npm run lambda:build && cd lambda/dist && zip handler.zip handler.js
#   3. JSEARCH_API_KEY available (for JSearch single-source test)
#
# Usage:
#   bash scripts/deploy-ingestion-lambda.sh
#
# This script:
#   Step 1: Creates or updates the Lambda function
#   Step 2: Configures environment variables (from .env.local or manual input)
#   Step 3: Sets timeout to 900 seconds (15 minutes)
#   Step 4: Tests with a single-source JSearch invocation
#   Step 5: Shows Lambda logs
#   Step 6: Optionally creates EventBridge schedule
#
set -euo pipefail

FUNCTION_NAME="oppy-ingestion"
REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
HANDLER_FILE="lambda/dist/handler.zip"
ROLE_NAME="oppy-ingestion-lambda-role"

echo "═══════════════════════════════════════════════════════"
echo "  OPPY Ingestion Lambda Deployment"
echo "═══════════════════════════════════════════════════════"

# ── Step 0: Verify prerequisites ───────────────────────────────────────────

echo ""
echo "▶ Step 0: Verifying prerequisites..."

if ! command -v aws &>/dev/null; then
  echo "❌ AWS CLI not found. Install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  exit 1
fi

if [ ! -f "$HANDLER_FILE" ]; then
  echo "❌ handler.zip not found at $HANDLER_FILE"
  echo "   Run: npm run lambda:build && cd lambda/dist && zip handler.zip handler.js"
  exit 1
fi

IDENTITY=$(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null) || {
  echo "❌ AWS credentials not configured. Run: aws configure"
  exit 1
}
echo "  ✅ AWS identity: $IDENTITY"
echo "  ✅ Region: $REGION"
echo "  ✅ handler.zip: $(ls -la $HANDLER_FILE | awk '{print $5}') bytes"

# ── Step 1: Create IAM role (if needed) ───────────────────────────────────

echo ""
echo "▶ Step 1: Checking IAM role..."

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null) || {
  echo "  Creating IAM role: $ROLE_NAME"
  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --query 'Role.Arn' --output text)
  
  # Attach basic Lambda execution policy (CloudWatch Logs)
  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" 2>/dev/null || true
  
  echo "  ✅ Created role: $ROLE_ARN"
  echo "  ⏳ Waiting 10s for role propagation..."
  sleep 10
}
echo "  ✅ Role: $ROLE_ARN"

# ── Step 2: Create or update Lambda function ───────────────────────────────

echo ""
echo "▶ Step 2: Deploying Lambda function..."

EXISTS=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null && echo "yes" || echo "no")

if [ "$EXISTS" = "yes" ]; then
  echo "  Function exists — updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --zip-file "fileb://$HANDLER_FILE" \
    --no-cli-pager \
    --query 'LastModified' --output text
  echo "  ✅ Code updated"
  
  # Wait for update to complete before setting config
  echo "  ⏳ Waiting for function update to complete..."
  aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION"
else
  echo "  Creating new function: $FUNCTION_NAME"
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --runtime nodejs20.x \
    --handler handler.handler \
    --role "$ROLE_ARN" \
    --zip-file "fileb://$HANDLER_FILE" \
    --timeout 900 \
    --memory-size 512 \
    --no-cli-pager \
    --query 'FunctionArn' --output text
  echo "  ✅ Function created"
fi

# ── Step 3: Configure timeout and memory ───────────────────────────────────

echo ""
echo "▶ Step 3: Configuring timeout (15 min) and memory (512 MB)..."

aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --timeout 900 \
  --memory-size 512 \
  --no-cli-pager \
  --query '[Timeout,MemorySize]' --output text
echo "  ✅ Configured: timeout=900s, memory=512MB"

# ── Step 4: Set environment variables ──────────────────────────────────────

echo ""
echo "▶ Step 4: Configuring environment variables..."

echo "  ⚠️  You need to set these environment variables in the Lambda console"
echo "     or via AWS CLI. The script will NOT read or print secret values."
echo ""
echo "  Required variables:"
echo "    MONGODB_URI    — MongoDB connection string"
echo "    MONGODB_DB     — Database name (default: oppy)"
echo "    JSEARCH_API_KEY — OpenWeb Ninja API key"
echo ""
echo "  Optional variables:"
echo "    RAPIDAPI_KEY   — Legacy JSearch fallback"
echo "    LUMA_CALENDARS — Comma-separated Luma calendar slugs"
echo "    NODE_ENV       — Set to 'production'"
echo ""

# Read from .env.local if available, otherwise prompt
ENV_VARS="{}"
if [ -f ".env.local" ]; then
  echo "  Found .env.local — extracting non-secret variable names..."
  
  # Build env vars JSON from .env.local (only non-empty values, NEVER print values)
  MONGODB_URI=$(grep "^MONGODB_URI=" .env.local 2>/dev/null | cut -d= -f2- | head -1)
  MONGODB_DB=$(grep "^MONGODB_DB=" .env.local 2>/dev/null | cut -d= -f2- | head -1)
  JSEARCH_API_KEY_VAL=$(grep "^JSEARCH_API_KEY=" .env.local 2>/dev/null | cut -d= -f2- | head -1)
  RAPIDAPI_KEY_VAL=$(grep "^RAPIDAPI_KEY=" .env.local 2>/dev/null | cut -d= -f2- | head -1)
  LUMA_CALENDARS_VAL=$(grep "^LUMA_CALENDARS=" .env.local 2>/dev/null | cut -d= -f2- | head -1)
  
  # Build JSON with values (read from file, never printed)
  ENV_VARS=$(node -e "
    const vars = { NODE_ENV: 'production' };
    const fs = require('fs');
    const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.substring(0, eq).trim();
      const val = trimmed.substring(eq + 1).trim().replace(/^['\"]|['\"]$/g, '');
      if (['MONGODB_URI','MONGODB_DB','JSEARCH_API_KEY','RAPIDAPI_KEY','LUMA_CALENDARS','NODE_ENV'].includes(key) && val) {
        vars[key] = val;
      }
    }
    console.log(JSON.stringify(vars));
  ")
  
  echo "  ✅ Environment variables loaded from .env.local (values hidden)"
  
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --environment "Variables=$ENV_VARS" \
    --no-cli-pager \
    --query 'Environment.Variables.keys(@)' --output text
  echo "  ✅ Environment variables set"
else
  echo "  ❌ No .env.local found. Set environment variables manually:"
  echo ""
  echo "  Option A — AWS Console:"
  echo "    Lambda → $FUNCTION_NAME → Configuration → Environment variables → Edit"
  echo ""
  echo "  Option B — AWS CLI (replace VALUES):"
  echo "    aws lambda update-function-configuration \\"
  echo "      --function-name $FUNCTION_NAME \\"
  echo "      --region $REGION \\"
  echo "      --environment 'Variables={MONGODB_URI=<URI>,MONGODB_DB=oppy,JSEARCH_API_KEY=<KEY>,NODE_ENV=production}'"
fi

# ── Step 5: Test — single-source JSearch invocation ────────────────────────

echo ""
echo "▶ Step 5: Testing single-source JSearch invocation..."
echo "  Invoking Lambda with: {\"source\": \"JSearch\"}"
echo "  ⏳ This may take 60-90 seconds..."
echo ""

INVOKE_OUTPUT=$(aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --payload '{"source": "JSearch"}' \
  --cli-read-timeout 300 \
  --cli-connect-timeout 10 \
  /tmp/oppy-ingestion-response.json 2>&1) || {
  echo "  ❌ Lambda invocation failed: $INVOKE_OUTPUT"
  echo "  Check CloudWatch logs: aws logs tail /aws/lambda/$FUNCTION_NAME --region $REGION --since 10m"
  exit 1
}

echo "  ✅ Lambda invoked successfully"
echo ""
echo "  Response:"
cat /tmp/oppy-ingestion-response.json | node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
  console.log(JSON.stringify(data, null, 2));
"

# ── Step 6: Check CloudWatch logs ──────────────────────────────────────────

echo ""
echo "▶ Step 6: Recent Lambda logs (last 5 minutes)..."
echo "─────────────────────────────────────────────────────"
aws logs tail "/aws/lambda/$FUNCTION_NAME" \
  --region "$REGION" \
  --since 5m \
  --format short 2>/dev/null | tail -50 || {
  echo "  ℹ️  Logs may take a moment to appear. Try:"
  echo "  aws logs tail /aws/lambda/$FUNCTION_NAME --region $REGION --since 10m"
}
echo "─────────────────────────────────────────────────────"

# ── Step 7: Verify MongoDB ─────────────────────────────────────────────────

echo ""
echo "▶ Step 7: Verifying MongoDB..."
echo "  Run this query against your MongoDB to check results:"
echo ""
echo "  // Active JSearch opportunities"
echo "  db.opportunities.count({ sourcePlatform: 'JSearch', isActive: true })"
echo ""
echo "  // Bengaluru/Bangalore jobs"
echo "  db.opportunities.count({ category: 'Job', isActive: true, location: /Bengaluru|Bangalore/i })"
echo ""
echo "  // All active by source"
echo "  db.opportunities.aggregate(["
echo "    { \$match: { isActive: true } },"
echo "    { \$group: { _id: '\$source', count: { \$sum: 1 } } },"
echo "    { \$sort: { count: -1 } }"
echo "  ])"

# ── Done ───────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ Deployment complete"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Function: $FUNCTION_NAME"
echo "  Region:   $REGION"
echo "  Timeout:  900s (15 min)"
echo "  Memory:   512 MB"
echo "  Runtime:  Node.js 20.x"
echo "  Handler:  handler.handler"
echo ""
echo "  To re-invoke manually:"
echo "    aws lambda invoke --function-name $FUNCTION_NAME --region $REGION --payload '{\"source\": \"JSearch\"}' /tmp/response.json"
echo ""
echo "  To run full pipeline:"
echo "    aws lambda invoke --function-name $FUNCTION_NAME --region $REGION --payload '{\"forceAll\": true}' /tmp/response.json"
echo ""
echo "  To create EventBridge schedule (after JSearch validation):"
echo "    bash scripts/setup-eventbridge-schedule.sh"
