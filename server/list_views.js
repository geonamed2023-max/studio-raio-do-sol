const fs = require('fs');

const logPath = 'C:\\Users\\georg\\.gemini\\antigravity\\brain\\d0a0f95a-7ceb-4955-ac5f-ab213eccf505\\.system_generated\\logs\\transcript.jsonl';

async function main() {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i]) continue;
        const data = JSON.parse(lines[i]);
        if (data.tool_calls && data.tool_calls[0].name === 'view_file' && data.tool_calls[0].args.AbsolutePath.includes('dashboard.js')) {
            const args = data.tool_calls[0].args;
            console.log(`Step ${i+1}: StartLine=${args.StartLine}, EndLine=${args.EndLine}`);
        }
    }
}

main();
