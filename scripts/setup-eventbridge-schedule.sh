#!/usr/bin/env bash
#
# Create an EventBridge Scheduler rule to trigger the OPPY ingestion Lambda.
#
# Prerequisites:
#   1. Lambda function "oppy-ingestion" already deployed and tested
#   2. AWS CLI configured with appropriate permissions
#   3. Run ONLY after single-source JSearch validation succeeds
#
# Usage:
#   bash scripts/setup-eventbridge-schedule.sh
#
set -euo pipefail

FUNCTION_NAME="oppy-ingestion"
REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
SCHEDULE_NAME="oppy-ingestion-schedule"
SCHEDULE_GROUP="default"
# Every 6 hours (0 */6 * * *)
CRON_EXPRESSION="cron(0 */6 * * ? *)"

echo "═══════════════════════════════════════════════════════"
echo "  OPPY EventBridge Ingestion Schedule"
echo "═══════════════════════════════════════════════════════"

# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'Configuration.FunctionArn' \
  --output text 2>/dev/null) || {
  echo "❌ Lambda function '$FUNCTION_NAME' not found in $REGION"
  exit 1
}
echo "  ✅ Lambda ARN: $LAMBDA_ARN"

# Get or create IAM role for EventBridge to invoke Lambda
SCHEDULER_ROLE_NAME="oppy-eventbridge-scheduler-role"
SCHEDULER_ROLE_ARN=$(aws iam get-role --role-name "$SCHEDULER_ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null) || {
  echo "  Creating EventBridge Scheduler IAM role..."
  SCHEDULER_ROLE_ARN=$(aws iam create-role \
    --role-name "$SCHEDULER_ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "scheduler.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --query 'Role.Arn' --output text)
  
  # Create inline policy allowing Lambda invoke
  aws iam put-role-policy \
    --role-name "$SCHEDULER_ROLE_NAME" \
    --policy-name "InvokeIngestionLambda" \
    --policy-document "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [{
        \"Effect\": \"Allow\",
        \"Action\": \"lambda:InvokeFunction\",
        \"Resource\": \"$LAMBDA_ARN\"
      }]
    }"
  
  echo "  ✅ Created role: $SCHEDULER_ROLE_ARN"
  echo "  ⏳ Waiting 10s for role propagation..."
  sleep 10
}
echo "  ✅ Scheduler role: $SCHEDULER_ROLE_ARN"

# Create the schedule
echo ""
echo "▶ Creating schedule: $SCHEDULE_NAME"
echo "  Cron: $CRON_EXPRESSION (every 6 hours)"
echo "  Target: $FUNCTION_NAME"
echo "  Payload: {\"forceAll\": true}"

# Delete existing schedule if present (idempotent)
aws scheduler delete-schedule \
  --name "$SCHEDULE_NAME" \
  --group-name "$SCHEDULE_GROUP" \
  --region "$REGION" 2>/dev/null || true

aws scheduler create-schedule \
  --name "$SCHEDULE_NAME" \
  --group-name "$SCHEDULE_GROUP" \
  --region "$REGION" \
  --schedule-expression "$CRON_EXPRESSION" \
  --schedule-expression-timezone "UTC" \
  --flexible-time-window "OFF" \
  --target "{
    \"Arn\": \"$LAMBDA_ARN\",
    \"RoleArn\": \"$SCHEDULER_ROLE_ARN\",
    \"Input\": \"{\\\"forceAll\\\": true}\"
  }" \
  --state "ENABLED" \
  --no-cli-pager \
  --query 'Arn' --output text

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ EventBridge schedule created"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Schedule: $SCHEDULE_NAME"
echo "  Cron:     $CRON_EXPRESSION (every 6 hours, UTC)"
echo "  Target:   $FUNCTION_NAME"
echo "  Payload:  {\"forceAll\": true}"
echo ""
echo "  Note: The pipeline's source-aware scheduling (scheduler.ts)"
echo "  means only overdue sources run per invocation. This is safe."
echo ""
echo "  To disable:"
echo "    aws scheduler update-schedule --name $SCHEDULE_NAME --group-name $SCHEDULE_GROUP --region $REGION --state DISABLED"
echo ""
echo "  To manually trigger now:"
echo "    aws lambda invoke --function-name $FUNCTION_NAME --region $REGION --payload '{\"forceAll\": true}' /tmp/response.json"
