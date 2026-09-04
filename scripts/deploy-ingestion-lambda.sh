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

# ── Step 2: Create or update Lambda function (code only) ──────────────────

echo ""
echo "▶ Step 2: Deploying Lambda function..."

if aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  >/dev/null 2>&1; then

  echo "  Updating existing function: $FUNCTION_NAME"

  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --zip-file "fileb://$HANDLER_FILE" \
    --no-cli-pager \
    --query 'LastModified' --output text
  echo "  ✅ Code updated"
  
  # Wait for update to complete before touching configuration
  echo "  ⏳ Waiting for code update to complete..."
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

# ── Step 3: Build environment variables JSON ───────────────────────────────

echo ""
echo "▶ Step 3: Building environment configuration..."

# Build the COMPLETE {"Variables": {...}} JSON in Node.
# This avoids all shell quoting issues — the Node subprocess outputs
# a single JSON string that is passed directly to AWS CLI.
LAMBDA_ENV_CONFIG="{}"
if [ -f ".env.local" ]; then
  echo "  Found .env.local — extracting variable names (values hidden)..."
  
  # Node outputs the full {"Variables": {...}} object — NEVER printed to stdout
  LAMBDA_ENV_CONFIG=$(node -e "
    const fs = require('fs');
    const vars = { NODE_ENV: 'production' };
    const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.substring(0, eq).trim();
      const val = trimmed.substring(eq + 1).trim().replace(/^['\"]|['\"]$/g, '');
      if (['MONGODB_URI','MONGODB_DB','JSEARCH_API_KEY','RAPIDAPI_KEY','LUMA_CALENDARS','BRAVE_API_KEY','NODE_ENV'].includes(key) && val) {
        vars[key] = val;
      }
    }
    // Output the COMPLETE structure AWS CLI expects: {"Variables": {...}}
    console.log(JSON.stringify({ Variables: vars }));
  ")
  
  # Print only the key names, never values
  echo "  ✅ Variables: MONGODB_URI, MONGODB_DB, JSEARCH_API_KEY, RAPIDAPI_KEY, LUMA_CALENDARS, BRAVE_API_KEY, NODE_ENV"
else
  echo "  ⚠️  No .env.local found — environment variables will be empty."
  echo "     Set them manually in the Lambda console after deployment."
fi

# ── Step 4: Apply full configuration (role, timeout, memory, env vars) ────

echo ""
echo "▶ Step 4: Applying Lambda configuration..."

# LAMBDA_ENV_CONFIG is a complete JSON object: {"Variables": {...}}
# Pass it directly to --environment — no shell re-parsing needed.
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --role "$ROLE_ARN" \
  --runtime nodejs20.x \
  --handler handler.handler \
  --timeout 900 \
  --memory-size 512 \
  --environment "$LAMBDA_ENV_CONFIG" \
  --no-cli-pager \
  --query '[Timeout,MemorySize,Runtime,Handler,Role]' --output text
echo "  ✅ Configuration applied: role=updated, timeout=900s, memory=512MB, runtime=nodejs20.x"

# ── Step 5: Wait for config propagation, then test ───────────────────────

echo ""
echo "▶ Step 5: Waiting for configuration to propagate..."
aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION"
echo "  ✅ Configuration propagated"

echo ""
echo "▶ Step 6: Testing single-source JSearch invocation..."
echo "  Invoking Lambda with: {\"source\": \"JSearch\"}"
echo "  ⏳ JSearch runs the reduced ~14-request plan; allow a few minutes..."
echo ""

# CLI read timeout (960s) exceeds the Lambda's 900s timeout with margin, so a
# legitimate full-duration Lambda execution can complete without the local
# client timing out first. The Lambda's own timeout configuration is untouched.
INVOKE_OUTPUT=$(aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --payload '{"source": "JSearch"}' \
  --cli-binary-format raw-in-base64-out \
  --cli-read-timeout 960 \
  --cli-connect-timeout 10 \
  /tmp/oppy-ingestion-response.json 2>&1) || {
  echo "  ❌ Lambda invocation failed: $INVOKE_OUTPUT"
  echo "  Check CloudWatch logs: aws logs tail /aws/lambda/$FUNCTION_NAME --region $REGION --since 10m"
  exit 1
}

echo "  ✅ Lambda invoked successfully"
echo ""
echo "  Response:"
# Git Bash converts /tmp/... to a Windows temp path for aws.exe.
# cygpath -w gives Node the same Windows path so readFileSync works.
# export is required so Node inherits RESPONSE_FILE via process.env.
export RESPONSE_FILE=$(cygpath -w /tmp/oppy-ingestion-response.json)
node -e "
  const fs = require('fs');
  const file = process.env.RESPONSE_FILE;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(JSON.stringify(data, null, 2));
"
rm -f "$RESPONSE_FILE"

# ── Step 7: Check CloudWatch logs ──────────────────────────────────────────

echo ""
echo "▶ Step 7: Recent Lambda logs (last 5 minutes)..."
echo "─────────────────────────────────────────────────────"
aws logs tail "/aws/lambda/$FUNCTION_NAME" \
  --region "$REGION" \
  --since 5m \
  --format short 2>/dev/null | tail -50 || {
  echo "  ℹ️  Logs may take a moment to appear. Try:"
  echo "  aws logs tail /aws/lambda/$FUNCTION_NAME --region $REGION --since 10m"
}
echo "─────────────────────────────────────────────────────"

# ── Step 8: Verify MongoDB ─────────────────────────────────────────────────

echo ""
echo "▶ Step 8: Verifying MongoDB..."
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
