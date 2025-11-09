import { Client } from '@notionhq/client';
import { PageInfo, DatabaseInfo, DatabaseProperty, DataSource } from '../types/index.js';

export class NotionService {
  private client: Client;
  private apiVersion: '2022-06-28' | '2025-09-03';

  constructor(apiKey: string, apiVersion: '2022-06-28' | '2025-09-03' = '2025-09-03') {
    this.apiVersion = apiVersion;
    this.client = new Client({
      auth: apiKey,
      notionVersion: apiVersion,
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

  async getAllDatabases(specificIds?: string[], includeDataSources: boolean = true): Promise<DatabaseInfo[]> {
    const databases: DatabaseInfo[] = [];

    try {
      if (specificIds && specificIds.length > 0) {
        // Fetch specific databases by ID
        for (const id of specificIds) {
          try {
            const database = await this.client.databases.retrieve({ database_id: id });
            const dbInfo = await this.extractDatabaseInfo(database, includeDataSources);
            databases.push(dbInfo);
          } catch (error) {
            console.warn(`Could not fetch database ${id}:`, error instanceof Error ? error.message : 'Unknown error');
          }
        }
      } else {
        // Search for all databases
        let cursor: string | undefined;

        do {
          let response;
          
          if (this.apiVersion === '2025-09-03') {
            // For 2025-09-03, search for data sources and then get their parent databases
            response = await this.client.search({
              filter: {
                property: 'object',
                value: 'page' // Use 'page' as fallback since 'data_source' might not be supported in SDK yet
              },
              start_cursor: cursor,
              page_size: 100
            });
            
            // Also try to search for databases directly
            try {
              const dbResponse = await this.client.request({
                path: 'search',
                method: 'post',
                body: {
                  filter: {
                    property: 'object',
                    value: 'database'
                  },
                  start_cursor: cursor,
                  page_size: 100
                }
              }) as any;
              
              for (const database of dbResponse.results || []) {
                if ('properties' in database) {
                  const dbInfo = await this.extractDatabaseInfo(database, includeDataSources);
                  databases.push(dbInfo);
                }
              }
            } catch (error) {
              console.warn('Could not search databases with new API, falling back to page search');
            }
          } else {
            // For older API versions
            response = await this.client.search({
              filter: {
                property: 'object',
                value: 'database'
              },
              start_cursor: cursor,
              page_size: 100
            });
            
            for (const database of response.results) {
              if ('properties' in database) {
                const dbInfo = await this.extractDatabaseInfo(database, includeDataSources);
                databases.push(dbInfo);
              }
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

  private async extractDatabaseInfo(database: any, includeDataSources: boolean = true): Promise<DatabaseInfo> {
    const title = this.extractTitle(database.title);
    const properties: DatabaseProperty[] = [];

    // Extract database properties (for older API or base properties)
    if (database.properties) {
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
    }

    // Fetch data sources if using new API and requested
    let dataSources: DataSource[] = [];
    if (includeDataSources && this.apiVersion === '2025-09-03') {
      dataSources = await this.getDataSourcesForDatabase(database.id);
    }

    return {
      id: database.id,
      title: title || 'Untitled Database',
      url: database.url,
      description: database.description?.[0]?.plain_text || undefined,
      lastEditedTime: database.last_edited_time,
      createdTime: database.created_time,
      properties,
      dataSources,
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

  private async getDataSourcesForDatabase(databaseId: string): Promise<DataSource[]> {
    const dataSources: DataSource[] = [];

    try {
      if (this.apiVersion === '2025-09-03') {
        // Get database to see data_sources array
        const database = await this.client.databases.retrieve({ database_id: databaseId }) as any;
        
        if (database.data_sources && Array.isArray(database.data_sources)) {
          for (const dsRef of database.data_sources) {
            try {
              // Use custom request for data source API since SDK might not support it yet
              const dataSourceResponse = await this.client.request({
                path: `data_sources/${dsRef.id}`,
                method: 'get'
              }) as any;
              
              const dataSource = await this.extractDataSourceInfo(dataSourceResponse, dsRef.name);
              dataSources.push(dataSource);
            } catch (error) {
              console.warn(`Could not fetch data source ${dsRef.id}:`, error instanceof Error ? error.message : 'Unknown error');
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Could not fetch data sources for database ${databaseId}:`, error instanceof Error ? error.message : 'Unknown error');
    }

    return dataSources;
  }

  private async extractDataSourceInfo(dataSource: any, sourceName: string): Promise<DataSource> {
    const title = this.extractTitle(dataSource.title) || sourceName;
    const properties: DatabaseProperty[] = [];

    // Extract properties from data source
    if (dataSource.properties) {
      for (const [key, value] of Object.entries(dataSource.properties)) {
        const prop = value as any;
        properties.push({
          id: prop.id,
          name: key,
          type: prop.type,
          description: prop.description || undefined,
          options: this.extractPropertyOptions(prop)
        });
      }
    }

    // Try to get the source database name
    let sourceDatabaseName = '';
    if (dataSource.database_parent && dataSource.database_parent.page_id) {
      try {
        // This is a simplified approach - in reality we'd need to map database IDs to names
        sourceDatabaseName = sourceName; // Use the name from the reference for now
      } catch (error) {
        // Ignore errors when fetching source database name
      }
    }

    return {
      id: dataSource.id,
      name: sourceName,
      title,
      description: dataSource.description?.[0]?.plain_text || undefined,
      properties,
      parent: {
        type: dataSource.parent?.type || 'database',
        database_id: dataSource.parent?.database_id || ''
      },
      database_parent: {
        type: dataSource.database_parent?.type || 'page',
        page_id: dataSource.database_parent?.page_id
      },
      createdTime: dataSource.created_time,
      lastEditedTime: dataSource.last_edited_time,
      sourceDatabaseName
    };
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