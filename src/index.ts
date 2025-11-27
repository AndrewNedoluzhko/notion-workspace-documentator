#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import { NotionService } from './services/notion.js';
import { FormatterFactory } from './formatters/index.js';
import { WorkspaceDocumentation } from './types/index.js';

interface InteractiveConfig {
  workspaceName: string;
  notionApiKey: string;
  format?: string;
  formats?: string[];
  allFormats?: boolean;
  includeItems: boolean;
  includeSchema: boolean;
  includeDataSources: boolean;
  apiVersion: '2022-06-28' | '2025-09-03';
  outputDir: string;
}

const program = new Command();

program
  .name('notion-mapper')
  .description('Map Notion workspace structure including pages, databases, views, and properties')
  .version('1.0.0');

program
  .option('--non-interactive', 'Run in non-interactive mode using CLI options')
  .option('-f, --format <format>', 'Output format: json, markdown, csv, tree, numbered-txt, docx, pdf, or all', 'markdown')
  .option('-o, --output <directory>', 'Output directory', './output')
  .option('--workspace-name <name>', 'Workspace name for file naming')
  .option('--api-key <key>', 'Notion API key')
  .option('--include-schema', 'Include database schema (properties and data sources)')
  .option('--include-items', 'Include database items (pages) in the mapping')
  .option('--api-version <version>', 'Notion API version: 2022-06-28 or 2025-09-03', '2025-09-03')
  .option('--test-connection', 'Test Notion API connection and exit')
  .action(async (options) => {
    try {
      let config: InteractiveConfig;

      if (options.nonInteractive) {
        // Use CLI options
        const apiVersion = (options.apiVersion === '2022-06-28') ? '2022-06-28' : '2025-09-03';
        
        // Handle format option - if it's 'all', set all formats
        let formats: string[];
        if (options.format === 'all') {
          formats = ['json', 'markdown', 'csv', 'tree', 'numbered-txt', 'docx', 'pdf'];
        } else {
          formats = [options.format || 'numbered-txt'];
        }
        
        config = {
          workspaceName: options.workspaceName || 'Notion Workspace',
          notionApiKey: options.apiKey || process.env.NOTION_API_KEY || '',
          formats,
          includeSchema: options.includeSchema || true,
          includeItems: options.includeItems || false,
          includeDataSources: true, // Always true
          apiVersion,
          outputDir: options.output || './output'
        };
      } else {
        // Interactive mode
        console.log('🚀 Welcome to Notion Workspace Mapper!\n');
        
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
            type: 'confirm',
            name: 'allFormats',
            message: 'Generate all formats?',
            default: false
          },
          {
            type: 'checkbox',
            name: 'formats',
            message: 'Choose document format(s) (use Space to select, Enter to confirm):',
            choices: [
              { name: 'JSON - Raw data format', value: 'json', checked: true },
              { name: 'Markdown - GitHub-friendly format', value: 'markdown' },
              { name: 'CSV - Spreadsheet format', value: 'csv' },
              { name: 'Tree TXT - Tree structure text format', value: 'tree' },
              { name: 'Numbered TXT - Numbered hierarchy text', value: 'numbered-txt'},
              { name: 'DOCX - Microsoft Word document', value: 'docx' },
              { name: 'PDF - Portable document format', value: 'pdf' }
            ],
            when: (answers: any) => !answers.allFormats,
            validate: (answer: any) => {
              if (!answer || answer.length === 0) {
                return 'You must choose at least one format.';
              }
              return true;
            }
          },
          {
            type: 'confirm',
            name: 'includeSchema',
            message: 'Include databases schema (properties and data sources)?',
            default: true
          },
          {
            type: 'confirm',
            name: 'includeItems',
            message: 'Include database (data source) items (pages) in mapping?',
            default: false
          },
          {
            type: 'list',
            name: 'apiVersion',
            message: 'Choose Notion API version:',
            choices: [
              { name: '2025-09-03 - Latest with data sources support', value: '2025-09-03' },
              { name: '2022-06-28 - Legacy version (basic database support only)', value: '2022-06-28' }
            ],
            default: '2025-09-03'
          }
        ]);

        // Process formats selection
        let selectedFormats: string[];
        if (promptAnswers.allFormats) {
          selectedFormats = ['json', 'markdown', 'csv', 'tree', 'numbered-txt', 'docx', 'pdf'];
        } else {
          selectedFormats = promptAnswers.formats || ['numbered-txt'];
        }

        config = {
          ...promptAnswers,
          formats: selectedFormats,
          includeDataSources: true, // Always true, data sources are always fetched for new API
          outputDir: './output'
        };
      }

      // Validate required fields
      if (!config.notionApiKey) {
        console.error('❌ Error: NOTION_API_KEY is required');
        process.exit(1);
      }

      const formatsDisplay = config.formats ? config.formats.join(', ') : config.format || 'numbered-txt';
      
      console.log(`\n📋 Configuration:`);
      console.log(`   Workspace: ${config.workspaceName}`);
      console.log(`   Format(s): ${formatsDisplay}`);
      console.log(`   Include Schema: ${config.includeSchema ? 'Yes' : 'No'}`);
      console.log(`   Include Items: ${config.includeItems ? 'Yes' : 'No'}`);
      console.log(`   API Version: ${config.apiVersion}`);
      console.log(`   Output Directory: ${config.outputDir}\n`);

      // Initialize Notion service
      const notionService = new NotionService(config.notionApiKey, config.apiVersion);

      // Test connection if requested
      if (options.testConnection) {
        console.log('🔍 Testing Notion API connection...');
        try {
          const isConnected = await notionService.testConnection();
          
          if (isConnected) {
            console.log('✅ Connection successful!');
            process.exit(0);
          } else {
            console.error('❌ Connection failed!');
            process.exit(1);
          }
        } catch (error: any) {
          console.error(`❌ ${error.message}`);
          process.exit(1);
        }
      }

      console.log('🔍 Testing Notion API connection...');
      try {
        const isConnected = await notionService.testConnection();
        
        if (!isConnected) {
          console.error('❌ Failed to connect to Notion API. Please check your API key.');
          process.exit(1);
        }
      } catch (error: any) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
      }
      console.log('✅ Connected to Notion API\n');

      // Start timing
      const startTime = Date.now();

      // Fetch data
      console.log('📄 Fetching pages...');
      const pages = await notionService.getAllPages();
      console.log(`   Found ${pages.length} pages`);

      console.log('🗄️  Fetching databases...');
      const allDatabases = await notionService.getAllDatabases(undefined, config.includeSchema, config.includeItems);
      
      // Filter databases based on includeSchema
      const databases = config.includeSchema ? allDatabases : allDatabases.map(db => ({
        ...db,
        properties: [],
        dataSources: []
      }));
      
      console.log(`   Found ${databases.length} databases`);

      const totalProperties = databases.reduce((sum, db) => {
        // Count properties from database itself (old API) or from data sources (new API)
        const dbProps = db.properties.length;
        // In new API, data sources contain the schema (properties), not pages
        // So we always count data source properties regardless of includeItems
        const dsProps = db.dataSources?.reduce((dsSum, ds) => dsSum + ds.properties.length, 0) || 0;
        return sum + dbProps + dsProps;
      }, 0);
      console.log(`   Found ${totalProperties} total properties\n`);

      // Filter pages based on includeItems setting
      let filteredPages: typeof pages;
      if (config.includeItems) {
        if (config.apiVersion === '2025-09-03' && databases.some(db => db.dataSources && db.dataSources.length > 0)) {
          // New API with items: Pages are already included in data sources, only include non-database pages
          filteredPages = pages.filter(page => page.parent.type !== 'data_source_id' && page.parent.type !== 'database_id');
        } else {
          // Old API with items: Include all pages
          filteredPages = pages;
        }
      } else {
        // Not including items: Filter out all database and data source pages
        filteredPages = pages.filter(page => page.parent.type !== 'database_id' && page.parent.type !== 'data_source_id');
      }

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
        includeSchema: config.includeSchema,
        includeItems: config.includeItems
      };

      // Generate output
      console.log('📝 Generating mapping...');
      const generateStartTime = Date.now();
      
      // Create filename with workspace name and timestamp
      const timestamp = new Date();
      const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const filename = `${config.workspaceName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_NWS_${dateStr}-${timeStr}`;

      // Handle multiple formats
      const formatsToGenerate = config.formats || [config.format || 'numbered-txt'];
      const generatedFiles: string[] = [];

      for (const format of formatsToGenerate) {
        const filePath = await generateSingleFormat(format, documentation, config.outputDir, filename);
        generatedFiles.push(filePath);
      }

      const generateEndTime = Date.now();
      const generateDuration = ((generateEndTime - generateStartTime) / 1000).toFixed(2);
      console.log('✅ Mapping generated successfully!');
      console.log(`⏱️  Generation time: ${generateDuration}s`);
      
      if (generatedFiles.length === 1) {
        console.log(`\n📁 Generated file: ${generatedFiles[0]}`);
      } else {
        console.log('\n📁 Generated files:');
        generatedFiles.forEach(file => console.log(`   ${file}`));
      }

      const endTime = Date.now();
      const totalDuration = ((endTime - startTime) / 1000).toFixed(2);

      console.log(`\n📊 Summary:`);
      console.log(`   Pages: ${documentation.summary.totalPages}`);
      console.log(`   Databases: ${documentation.summary.totalDatabases}`);
      console.log(`   Properties: ${documentation.summary.totalProperties}`);
      console.log(`   Total execution time: ${totalDuration}s`);

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
  let filenameSuffix = '';
  
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
      filenameSuffix = '_tree';
      break;
    case 'numbered-txt':
      formatter = FormatterFactory.createNumbered('txt');
      filenameSuffix = '_numbered';
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
  
  return await formatter.writeToFile(data, outputDir, filename + filenameSuffix);
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
  $ notion-mapper                           # Interactive mode
  $ notion-mapper --non-interactive -f json --api-key secret_... --workspace-name "My Workspace"
  $ notion-mapper --test-connection        # Test API connection

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