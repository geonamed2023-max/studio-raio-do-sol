const fs = require('fs');

const logPath = 'C:\\Users\\georg\\.gemini\\antigravity\\brain\\d0a0f95a-7ceb-4955-ac5f-ab213eccf505\\.system_generated\\logs\\transcript.jsonl';

async function main() {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    const data = JSON.parse(lines[105]); // Step 106 is index 105
    console.log(data.content);
}

main();
