const fs = require('fs');
const path = require('path');

async function runTest() {
  const url = 'http://localhost:3000/api/agent';
  console.log(`Sending POST request to ${url}...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const data = await response.json();
    console.log('Response received:', JSON.stringify(data, null, 2));

    // Validate schema
    const requiredKeys = [
      'request_id',
      'coin_symbol',
      'drama_index',
      'confidence',
      'dominant_branch',
      'branch_probabilities',
      'evidence_chain',
      'executable_verdict',
      'served_from_cache'
    ];

    const missingKeys = [];
    for (const key of requiredKeys) {
      if (!(key in data)) {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      throw new Error(`Missing keys in response: ${missingKeys.join(', ')}`);
    }

    // Validate sub-structures
    if (typeof data.drama_index !== 'number' || data.drama_index < 0 || data.drama_index > 100) {
      throw new Error(`Invalid drama_index: ${data.drama_index} (expected number between 0 and 100)`);
    }

    if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
      throw new Error(`Invalid confidence: ${data.confidence} (expected number between 0 and 1)`);
    }

    if (!Array.isArray(data.evidence_chain)) {
      throw new Error('evidence_chain must be an array');
    }

    if (typeof data.branch_probabilities !== 'object' || data.branch_probabilities === null) {
      throw new Error('branch_probabilities must be an object');
    }

    console.log('✅ Schema validation PASSED');

    // Write to LOOP.md
    const timestamp = new Date().toISOString();
    const loopContent = `# TestSprite Verification Loop

Last Checked: ${timestamp}
Endpoint: ${url}
Method: POST

## Test Execution Status
- **Status:** PASS
- **Schema Validation:** SUCCESS

## Response Payload
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

## Logs
- Successfully sent POST request to ${url}
- Validated all 9 required keys
- Validated types for drama_index, confidence, evidence_chain, and branch_probabilities
`;

    fs.writeFileSync(path.join(__dirname, '../LOOP.md'), loopContent, 'utf8');
    console.log('Saved test results to LOOP.md');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
    const timestamp = new Date().toISOString();
    const loopContent = `# TestSprite Verification Loop

Last Checked: ${timestamp}
Endpoint: ${url}
Method: POST

## Test Execution Status
- **Status:** FAIL
- **Error:** ${error.message}

## Logs
- Test execution failed on validation
`;
    fs.writeFileSync(path.join(__dirname, '../LOOP.md'), loopContent, 'utf8');
    process.exit(1);
  }
}

runTest();
