# Example Usage

This document provides practical examples of how to use the Notion Documentator.

## Prerequisites

Before running these examples, make sure you have:

1. Created a Notion integration at https://www.notion.so/my-integrations
2. Copied your integration token
3. Set up your `.env` file with the token
4. Shared your Notion content with the integration

## Basic Examples

### 1. Quick Start - Document Everything

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Notion API key
# NOTION_API_KEY=secret_your_token_here

# Test your connection
npm start -- --test-connection

# Generate markdown documentation
npm start
```

### 2. Generate All Formats

```bash
# Generate JSON, Markdown, and CSV files
npm start -- -f all -o ./complete-documentation
```

### 3. Document Specific Databases

```bash
# Get database IDs from Notion URLs or previous documentation
npm start -- -d "1a2b3c4d-e5f6-7890-1234-567890abcdef,2b3c4d5e-f6g7-8901-2345-678901bcdef0" -f json
```

### 4. Custom Output Directory

```bash
# Output to a specific directory
npm start -- -f markdown -o "./docs/notion-$(date +%Y-%m-%d)"
```

## Advanced Examples

### 5. Automated Documentation Pipeline

```bash
#!/bin/bash
# automation-script.sh

# Set up directories
mkdir -p ./documentation/$(date +%Y-%m-%d)

# Generate all formats
npm start -- -f all -o "./documentation/$(date +%Y-%m-%d)"

# Optional: Upload to cloud storage, send notifications, etc.
echo "Documentation generated at ./documentation/$(date +%Y-%m-%d)"
```

### 6. Database-Specific Analysis

```bash
# Document only CRM databases
npm start -- -d "customer-db-id,leads-db-id,deals-db-id" -f json -o ./crm-analysis

# Document only project management databases  
npm start -- -d "projects-db-id,tasks-db-id,sprints-db-id" -f markdown -o ./pm-docs
```

## Working with Output

### Processing JSON Output

```javascript
// analyze-output.js
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./output/notion-documentation.json', 'utf8'));

// Find databases with most properties
const dbsByPropertyCount = data.databases
  .sort((a, b) => b.properties.length - a.properties.length);

console.log('Databases by property count:');
dbsByPropertyCount.forEach(db => {
  console.log(`${db.title}: ${db.properties.length} properties`);
});

// Find all formula properties
const formulas = data.databases
  .flatMap(db => db.properties.filter(prop => prop.type === 'formula'))
  .map(prop => ({database: prop.database, name: prop.name, expression: prop.options?.expression}));

console.log('Formula properties:', formulas);
```

### Converting Markdown to HTML

```bash
# Using pandoc to convert markdown to HTML
pandoc ./output/notion-documentation.md -o ./output/notion-documentation.html --standalone --css=styles.css
```

### Importing CSV to Excel/Google Sheets

The CSV output can be directly imported into spreadsheet applications:

1. Open Excel or Google Sheets
2. Import the CSV file
3. Use the comment lines (starting with #) to separate data into different sheets

## Troubleshooting Examples

### Connection Issues

```bash
# Test connection with verbose error output
npm start -- --test-connection

# If connection fails, check your integration:
# 1. Verify token in .env file
# 2. Check integration permissions in Notion
# 3. Ensure content is shared with integration
```

### No Content Found

```bash
# This might happen if nothing is shared with your integration
# Solution: Go to Notion → Share pages/databases → Invite your integration
```

### Large Workspaces

```bash
# For workspaces with 1000+ pages/databases, use:
# - Specific database IDs to limit scope
# - JSON format for faster processing
npm start -- -d "important-db-1,important-db-2" -f json
```

## Integration Examples

### CI/CD Pipeline

```yaml
# .github/workflows/document-notion.yml
name: Document Notion Workspace

on:
  schedule:
    - cron: '0 9 * * MON'  # Every Monday at 9 AM
  workflow_dispatch:

jobs:
  document:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build project
        run: npm run build
        
      - name: Generate documentation
        run: npm start -- -f all -o ./docs
        env:
          NOTION_API_KEY: ${{ secrets.NOTION_API_KEY }}
          
      - name: Commit documentation
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add docs/
          git commit -m "Auto-update Notion documentation" || exit 0
          git push
```

### Node.js Integration

```javascript
// integrate-notion-docs.js
import { NotionService } from './src/services/notion.js';
import { FormatterFactory } from './src/formatters/index.js';

async function getNotionData() {
  const service = new NotionService(process.env.NOTION_API_KEY);
  
  const pages = await service.getAllPages();
  const databases = await service.getAllDatabases();
  
  return {
    timestamp: new Date().toISOString(),
    pages,
    databases,
    summary: {
      totalPages: pages.length,
      totalDatabases: databases.length,
      totalProperties: databases.reduce((sum, db) => sum + db.properties.length, 0)
    }
  };
}

// Use in your application
const notionData = await getNotionData();
console.log(`Found ${notionData.summary.totalDatabases} databases`);
```

## Best Practices

1. **Regular Documentation**: Set up automated runs to keep documentation current
2. **Selective Documentation**: Use database IDs to focus on important content
3. **Multiple Formats**: Generate JSON for processing, Markdown for reading
4. **Version Control**: Commit generated documentation to track workspace changes
5. **Access Control**: Regularly review integration permissions and shared content