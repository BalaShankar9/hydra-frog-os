#!/bin/bash
set -e

API_URL="http://localhost:3001"
UNIQUE_ID=$(date +%s)

echo "=== Step 1: Create User ==="
SIGNUP=$(curl -s -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"crawl-test-'$UNIQUE_ID'@example.com","password":"TestPass123!"}')
TOKEN=$(echo "$SIGNUP" | jq -r '.accessToken')
echo "Token: ${TOKEN:0:30}..."

echo ""
echo "=== Step 2: Create Org ==="
ORG=$(curl -s -X POST "$API_URL/orgs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Org '$UNIQUE_ID'","slug":"test-org-'$UNIQUE_ID'"}')
ORG_ID=$(echo "$ORG" | jq -r '.id')
echo "Org ID: $ORG_ID"

echo ""
echo "=== Step 3: Create Project ==="
PROJECT=$(curl -s -X POST "$API_URL/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","orgId":"'$ORG_ID'","siteUrl":"https://example.com"}')
PROJECT_ID=$(echo "$PROJECT" | jq -r '.id')
echo "Project ID: $PROJECT_ID"

echo ""
echo "=== Step 4: Trigger Crawl ==="
CRAWL=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/crawls/run-now" \
  -H "Authorization: Bearer $TOKEN")
echo "Crawl Response: $CRAWL"
CRAWL_RUN_ID=$(echo "$CRAWL" | jq -r '.crawlRunId // .id')
echo "CrawlRun ID: $CRAWL_RUN_ID"

echo ""
echo "=== Waiting 5 seconds for crawl to process ==="
sleep 5

echo ""
echo "=== Step 5: Check Crawl Status ==="
STATUS=$(curl -s "$API_URL/crawls/$CRAWL_RUN_ID" \
  -H "Authorization: Bearer $TOKEN")
echo "Status: $(echo "$STATUS" | jq -r '.status')"
echo "Pages Crawled: $(echo "$STATUS" | jq -r '.pagesCrawled')"

echo ""
echo "=== Step 6: Get Pages ==="
PAGES=$(curl -s "$API_URL/crawls/$CRAWL_RUN_ID/pages" \
  -H "Authorization: Bearer $TOKEN")
echo "Pages Response:"
echo "$PAGES" | jq .

echo ""
echo "=== Step 7: Get Issues ==="
ISSUES=$(curl -s "$API_URL/crawls/$CRAWL_RUN_ID/issues" \
  -H "Authorization: Bearer $TOKEN")
echo "Issues Response:"
echo "$ISSUES" | jq .

echo ""
echo "=== Step 8: Get Issues Summary ==="
SUMMARY=$(curl -s "$API_URL/crawls/$CRAWL_RUN_ID/issues/summary" \
  -H "Authorization: Bearer $TOKEN")
echo "Summary Response:"
echo "$SUMMARY" | jq .

echo ""
echo "=== Test Complete ==="
