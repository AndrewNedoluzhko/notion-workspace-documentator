import { Client } from '@notionhq/client';
import { PageInfo, DatabaseInfo, DatabaseProperty } from '../types/index.js';

export class NotionService {
  private client: Client;

  constructor(apiKey: string) {
    this.client = new Client({
      auth: apiKey,
    });
  }

  async getAllPages(): Promise<PageInfo[]> {
    const pages: PageInfo[] = [];
    let cursor: string | undefined;

    try {
      do {
        const response = await this.client.search({
          filter: {
            property: 'object',
            value: 'page'
          },
          start_cursor: cursor,
          page_size: 100
        });

        for (const page of response.results) {
          if ('properties' in page) {
            const pageInfo = this.extractPageInfo(page);
            pages.push(pageInfo);
          }
        }

        cursor = response.next_cursor || undefined;
      } while (cursor);

      return pages;
    } catch (error) {
      console.error('Error fetching pages:', error);
      throw new Error(`Failed to fetch pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllDatabases(specificIds?: string[]): Promise<DatabaseInfo[]> {
    const databases: DatabaseInfo[] = [];

    try {
      if (specificIds && specificIds.length > 0) {
        // Fetch specific databases by ID
        for (const id of specificIds) {
          try {
            const database = await this.client.databases.retrieve({ database_id: id });
            const dbInfo = this.extractDatabaseInfo(database);
            databases.push(dbInfo);
          } catch (error) {
            console.warn(`Could not fetch database ${id}:`, error instanceof Error ? error.message : 'Unknown error');
          }
        }
      } else {
        // Search for all databases
        let cursor: string | undefined;

        do {
          const response = await this.client.search({
            filter: {
              property: 'object',
              value: 'database'
            },
            start_cursor: cursor,
            page_size: 100
          });

          for (const database of response.results) {
            if ('properties' in database) {
              const dbInfo = this.extractDatabaseInfo(database);
              databases.push(dbInfo);
            }
          }

          cursor = response.next_cursor || undefined;
        } while (cursor);
      }

      return databases;
    } catch (error) {
      console.error('Error fetching databases:', error);
      throw new Error(`Failed to fetch databases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractPageInfo(page: any): PageInfo {
    const title = this.extractTitle(page.properties);
    
    return {
      id: page.id,
      title: title || 'Untitled',
      url: page.url,
      lastEditedTime: page.last_edited_time,
      createdTime: page.created_time,
      parent: {
        type: page.parent?.type || 'unknown',
        id: page.parent?.database_id || page.parent?.page_id || page.parent?.workspace
      },
      properties: page.properties
    };
  }

  private extractDatabaseInfo(database: any): DatabaseInfo {
    const title = this.extractTitle(database.title);
    const properties: DatabaseProperty[] = [];

    for (const [key, value] of Object.entries(database.properties)) {
      const prop = value as any;
      properties.push({
        id: prop.id,
        name: key,
        type: prop.type,
        description: prop.description || undefined,
        options: this.extractPropertyOptions(prop)
      });
    }

    return {
      id: database.id,
      title: title || 'Untitled Database',
      url: database.url,
      description: database.description?.[0]?.plain_text || undefined,
      lastEditedTime: database.last_edited_time,
      createdTime: database.created_time,
      properties,
      parent: {
        type: database.parent?.type || 'unknown',
        id: database.parent?.page_id || database.parent?.workspace
      }
    };
  }

  private extractTitle(titleProperty: any): string {
    if (Array.isArray(titleProperty)) {
      return titleProperty
        .map(item => item.plain_text || '')
        .join('')
        .trim();
    }

    // For page properties, find the title property
    if (titleProperty && typeof titleProperty === 'object') {
      for (const [key, value] of Object.entries(titleProperty)) {
        const prop = value as any;
        if (prop.type === 'title' && Array.isArray(prop.title)) {
          return prop.title
            .map((item: any) => item.plain_text || '')
            .join('')
            .trim();
        }
      }
    }

    return '';
  }

  private extractPropertyOptions(property: any): any {
    switch (property.type) {
      case 'select':
        return property.select?.options || [];
      case 'multi_select':
        return property.multi_select?.options || [];
      case 'status':
        return property.status?.options || [];
      case 'number':
        return {
          format: property.number?.format
        };
      case 'formula':
        return {
          expression: property.formula?.expression
        };
      case 'rollup':
        return {
          relation_property_name: property.rollup?.relation_property_name,
          relation_property_id: property.rollup?.relation_property_id,
          rollup_property_name: property.rollup?.rollup_property_name,
          rollup_property_id: property.rollup?.rollup_property_id,
          function: property.rollup?.function
        };
      case 'relation':
        return {
          database_id: property.relation?.database_id,
          type: property.relation?.type,
          single_property: property.relation?.single_property,
          dual_property: property.relation?.dual_property
        };
      default:
        return undefined;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.users.me({});
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}