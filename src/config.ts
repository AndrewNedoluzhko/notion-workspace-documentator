import { config } from 'dotenv';
import { Config } from './types/index.js';

config();

export function getConfig(): Config {
  const notionApiKey = process.env.NOTION_API_KEY;
  
  if (!notionApiKey) {
    throw new Error('NOTION_API_KEY environment variable is required');
  }

  const databaseIds = process.env.DATABASE_IDS 
    ? process.env.DATABASE_IDS.split(',').map(id => id.trim()).filter(Boolean)
    : undefined;

  const outputFormat = (process.env.OUTPUT_FORMAT as Config['outputFormat']) || 'markdown';
  const outputDir = process.env.OUTPUT_DIR || './output';

  return {
    notionApiKey,
    databaseIds,
    outputFormat,
    outputDir
  };
}

export function validateConfig(config: Config): void {
  if (!config.notionApiKey || config.notionApiKey === 'your_notion_integration_token_here') {
    throw new Error('Please set a valid NOTION_API_KEY in your .env file');
  }

  const validFormats = ['json', 'markdown', 'csv', 'tree', 'numbered', 'all'];
  if (!validFormats.includes(config.outputFormat)) {
    throw new Error(`Invalid output format. Must be one of: ${validFormats.join(', ')}`);
  }
}