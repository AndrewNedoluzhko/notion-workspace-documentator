#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import { NotionService } from './services/notion.js';
import { FormatterFactory } from './formatters/index.js';
import { WorkspaceDocumentation } from './types/index.js';

interface InteractiveConfig {
  workspaceName: string;
  notionApiKey: string;
  format: string;
  includeItems: boolean;
  outputDir: string;
}

const program = new Command();

program
  .name('notion-documentator')
  .description('Document Notion workspace structure including pages, databases, views, and properties')
  .version('1.0.0');

program
  .option('--non-interactive', 'Run in non-interactive mode using CLI options')
  .option('-f, --format <format>', 'Output format: json, markdown, csv, tree, numbered-txt, docx, pdf, or all', 'markdown')
  .option('-o, --output <directory>', 'Output directory', './output')
  .option('--workspace-name <name>', 'Workspace name for file naming')
  .option('--api-key <key>', 'Notion API key')
  .option('--include-items', 'Include database items (pages) in the documentation')
  .option('--test-connection', 'Test Notion API connection and exit')
  .action(async (options) => {
    try {
      let config: InteractiveConfig;

      if (options.nonInteractive) {
        // Use CLI options
        config = {
          workspaceName: options.workspaceName || 'Notion Workspace',
          notionApiKey: options.apiKey || process.env.NOTION_API_KEY || '',
          format: options.format || 'markdown',
          includeItems: options.includeItems || false,
          outputDir: options.output || './output'
        };
      } else {
        // Interactive mode
        console.log('🚀 Welcome to Notion Workspace Documentator!\n');
        
        const promptAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'workspaceName',
            message: 'Enter Workspace Name:',
            default: 'My Notion Workspace',
            validate: (input: string) => {
              if (input.trim().length === 0) {
                return 'Workspace name cannot be empty';
              }
              return true;
            }
          },
          {
            type: 'password',
            name: 'notionApiKey',
            message: 'Enter NOTION_API_KEY:',
            mask: '*',
            validate: (input: string) => {
              if (input.trim().length === 0) {
                return 'API key cannot be empty';
              }
              if (input.length < 20) {
                return 'API key seems too short. Please check your key.';
              }
              return true;
            }
          },
          {
            type: 'list',
            name: 'format',
            message: 'Choose document format:',
            choices: [
              { name: 'JSON - Raw data format', value: 'json' },
              { name: 'Markdown - GitHub-friendly format', value: 'markdown' },
              { name: 'CSV - Spreadsheet format', value: 'csv' },
              { name: 'Tree - Tree structure text format', value: 'tree' },
              { name: 'Numbered TXT - Numbered hierarchy text', value: 'numbered-txt' },
              { name: 'DOCX - Microsoft Word document', value: 'docx' },
              { name: 'PDF - Portable document format', value: 'pdf' },
              { name: 'All - Generate all formats', value: 'all' }
            ],
            default: 'numbered-txt'
          },
          {
            type: 'confirm',
            name: 'includeItems',
            message: 'Include database items (pages) in documentation?',
            default: false
          }
        ]);

        config = {
          ...promptAnswers,
          outputDir: './output'
        };
      }

      // Validate required fields
      if (!config.notionApiKey) {
        console.error('❌ Error: NOTION_API_KEY is required');
        process.exit(1);
      }

      console.log(`\n📋 Configuration:`);
      console.log(`   Workspace: ${config.workspaceName}`);
      console.log(`   Format: ${config.format}`);
      console.log(`   Include Items: ${config.includeItems ? 'Yes' : 'No'}`);
      console.log(`   Output Directory: ${config.outputDir}\n`);

      // Initialize Notion service
      const notionService = new NotionService(config.notionApiKey);

      // Test connection if requested
      if (options.testConnection) {
        console.log('🔍 Testing Notion API connection...');
        const isConnected = await notionService.testConnection();
        
        if (isConnected) {
          console.log('✅ Connection successful!');
          process.exit(0);
        } else {
          console.error('❌ Connection failed!');
          process.exit(1);
        }
      }

      console.log('🔍 Testing Notion API connection...');
      const isConnected = await notionService.testConnection();
      
      if (!isConnected) {
        console.error('❌ Failed to connect to Notion API. Please check your API key.');
        process.exit(1);
      }
      console.log('✅ Connected to Notion API\n');

      // Fetch data
      console.log('📄 Fetching pages...');
      const pages = await notionService.getAllPages();
      console.log(`   Found ${pages.length} pages`);

      console.log('🗄️  Fetching databases...');
      const databases = await notionService.getAllDatabases();
      console.log(`   Found ${databases.length} databases`);

      const totalProperties = databases.reduce((sum, db) => sum + db.properties.length, 0);
      console.log(`   Found ${totalProperties} total properties\n`);

      // Filter pages based on includeItems option
      const filteredPages = config.includeItems ? pages : pages.filter(page => page.parent.type !== 'database_id');

      // Create documentation object
      const documentation: WorkspaceDocumentation = {
        timestamp: new Date().toISOString(),
        workspaceName: config.workspaceName,
        pages: filteredPages,
        databases,
        summary: {
          totalPages: filteredPages.length,
          totalDatabases: databases.length,
          totalProperties
        },
        includeItems: config.includeItems
      };

      // Generate output
      console.log('📝 Generating documentation...');
      
      // Create filename with workspace name and timestamp
      const timestamp = new Date();
      const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const filename = `${config.workspaceName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_NWS_${dateStr}-${timeStr}`;

      if (config.format === 'all') {
        const files = await generateAllFormats(documentation, config.outputDir, filename);
        console.log('✅ Documentation generated successfully!');
        console.log('\n📁 Generated files:');
        files.forEach(file => console.log(`   ${file}`));
      } else {
        const filePath = await generateSingleFormat(config.format, documentation, config.outputDir, filename);
        console.log('✅ Documentation generated successfully!');
        console.log(`\n📁 Generated file: ${filePath}`);
      }

      console.log(`\n📊 Summary:`);
      console.log(`   Pages: ${documentation.summary.totalPages}`);
      console.log(`   Databases: ${documentation.summary.totalDatabases}`);
      console.log(`   Properties: ${documentation.summary.totalProperties}`);

    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      
      if (error instanceof Error && error.message.includes('API key')) {
        console.log('\n💡 Make sure to:');
        console.log('   1. Create a Notion integration at https://www.notion.so/my-integrations');
        console.log('   2. Copy the integration token');
        console.log('   3. Share your pages/databases with the integration');
      }
      
      process.exit(1);
    }
  });

async function generateSingleFormat(format: string, data: WorkspaceDocumentation, outputDir: string, filename: string): Promise<string> {
  let formatter;
  
  switch (format) {
    case 'json':
      formatter = FormatterFactory.create('json');
      break;
    case 'markdown':
      formatter = FormatterFactory.create('markdown');
      break;
    case 'csv':
      formatter = FormatterFactory.create('csv');
      break;
    case 'tree':
      formatter = FormatterFactory.create('tree');
      break;
    case 'numbered-txt':
      formatter = FormatterFactory.createNumbered('txt');
      break;
    case 'docx':
      formatter = FormatterFactory.createNumbered('doc');
      break;
    case 'pdf':
      formatter = FormatterFactory.createNumbered('pdf');
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
  
  return await formatter.writeToFile(data, outputDir, filename);
}

async function generateAllFormats(data: WorkspaceDocumentation, outputDir: string, filename: string): Promise<string[]> {
  const formatters = [
    { formatter: FormatterFactory.create('json'), name: filename },
    { formatter: FormatterFactory.create('markdown'), name: filename },
    { formatter: FormatterFactory.create('csv'), name: filename },
    { formatter: FormatterFactory.create('tree'), name: filename },
    { formatter: FormatterFactory.createNumbered('txt'), name: filename },
    { formatter: FormatterFactory.createNumbered('pdf'), name: filename },
    { formatter: FormatterFactory.createNumbered('doc'), name: filename }
  ];

  const files: string[] = [];
  
  for (const { formatter, name } of formatters) {
    const filePath = await formatter.writeToFile(data, outputDir, name);
    files.push(filePath);
  }

  return files;
}

// Add help examples
program.addHelpText('after', `

Examples:
  $ notion-documentator                           # Interactive mode
  $ notion-documentator --non-interactive -f json --api-key secret_... --workspace-name "My Workspace"
  $ notion-documentator --test-connection        # Test API connection

Interactive Mode:
  - Enter workspace name for custom file naming
  - Enter your Notion API key securely
  - Choose output format from available options
  - Toggle database items inclusion

Setup:
  1. Create a Notion integration at https://www.notion.so/my-integrations
  2. Copy the integration token (starts with 'secret_')
  3. Share your pages/databases with the integration
  4. Run the tool in interactive mode

Note: Make sure to share your Notion pages and databases with your integration.
`);

program.parse();