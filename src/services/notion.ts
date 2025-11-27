import { Client } from '@notionhq/client';
import { PageInfo, DatabaseInfo, DatabaseProperty, DataSource } from '../types/index.js';

export class NotionService {
  private client: Client;
  private apiVersion: '2022-06-28' | '2025-09-03';
  private firstDbDebugged: boolean = false;
  private blockToPageCache: Map<string, string> = new Map(); // Cache block ID → page ID mappings

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
            const pageInfo = await this.extractPageInfo(page);
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

  async getAllDatabases(specificIds?: string[], includeDataSources: boolean = true, fetchPages: boolean = false): Promise<DatabaseInfo[]> {
    const databases: DatabaseInfo[] = [];

    try {
      if (specificIds && specificIds.length > 0) {
        // Fetch specific databases by ID
        for (const id of specificIds) {
          try {
            const database = await this.client.databases.retrieve({ database_id: id });
            const dbInfo = await this.extractDatabaseInfo(database, includeDataSources, fetchPages);
            databases.push(dbInfo);
          } catch (error) {
            console.warn(`Could not fetch database ${id}:`, error instanceof Error ? error.message : 'Unknown error');
          }
        }
      } else {
        if (this.apiVersion === '2025-09-03') {
          // For new API, discover databases through page relationships
          await this.discoverDatabasesFromPages(databases, includeDataSources, fetchPages);
        } else {
          // For older API, search databases directly
          await this.searchDatabasesDirectly(databases, includeDataSources, fetchPages);
        }
      }

      return databases;
    } catch (error) {
      console.error('Error fetching databases:', error);
      throw new Error(`Failed to fetch databases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async discoverDatabasesFromPages(databases: DatabaseInfo[], includeDataSources: boolean, fetchPages: boolean = false): Promise<void> {
    let cursor: string | undefined;
    const databaseIds = new Set<string>();

    // Search for data sources to find their parent databases
    do {
      const response = await this.client.search({
        filter: {
          property: 'object',
          value: 'data_source' as any // SDK types not updated for 2025-09-03 API
        },
        start_cursor: cursor,
        page_size: 100
      });

      for (const dataSource of response.results || []) {
        if ('parent' in dataSource && dataSource.parent) {
          const parent = dataSource.parent as any;
          if (parent.type === 'database_id' && parent.database_id) {
            databaseIds.add(parent.database_id);
          }
        }
      }

      cursor = response.next_cursor || undefined;
    } while (cursor);

    // Fetch all databases in parallel for better performance
    const databasePromises = Array.from(databaseIds).map(async (dbId) => {
      try {
        const database = await this.client.databases.retrieve({ database_id: dbId });
        return await this.extractDatabaseInfo(database, includeDataSources, fetchPages);
      } catch (error) {
        console.warn(`Could not fetch database ${dbId}:`, error instanceof Error ? error.message : 'Unknown error');
        return null;
      }
    });
    
    const results = await Promise.all(databasePromises);
    databases.push(...results.filter((db): db is DatabaseInfo => db !== null));
  }

  private async searchDatabasesDirectly(databases: DatabaseInfo[], includeDataSources: boolean, fetchPages: boolean = false): Promise<void> {
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
          const dbInfo = await this.extractDatabaseInfo(database, includeDataSources, fetchPages);
          databases.push(dbInfo);
        }
      }

      cursor = response.next_cursor || undefined;
    } while (cursor);
  }

  private async extractPageInfo(page: any): Promise<PageInfo> {
    const title = this.extractTitle(page.properties);
    
    // Determine parent ID - if parent is a block, resolve it to the containing page
    let parentType = page.parent?.type || 'unknown';
    let parentId = page.parent?.database_id || page.parent?.page_id || page.parent?.block_id || page.parent?.data_source_id || page.parent?.workspace;
    
    // If parent is a block, try to resolve it to a page (same as for databases)
    if (parentType === 'block_id' && page.parent?.block_id) {
      const resolvedPageId = await this.resolveBlockToPage(page.parent.block_id);
      if (resolvedPageId) {
        // Successfully resolved to a page
        parentType = 'page_id';
        parentId = resolvedPageId;
      }
      // If not resolved, keep block_id as parent (will trigger placeholder parent)
    }
    
    return {
      id: page.id,
      title: title || 'Untitled',
      url: page.url,
      lastEditedTime: page.last_edited_time,
      createdTime: page.created_time,
      parent: {
        type: parentType,
        id: parentId
      },
      properties: page.properties
    };
  }

  /**
   * Resolve a block ID to its containing page ID by traversing parent chain
   */
  private async resolveBlockToPage(blockId: string): Promise<string | undefined> {
    // Check cache first
    if (this.blockToPageCache.has(blockId)) {
      return this.blockToPageCache.get(blockId);
    }

    try {
      const block = await this.client.blocks.retrieve({ block_id: blockId });
      
      if ('parent' in block && block.parent) {
        const parent = block.parent as any;
        
        // If parent is a page, we found it!
        if (parent.type === 'page_id' && parent.page_id) {
          this.blockToPageCache.set(blockId, parent.page_id);
          return parent.page_id;
        }
        
        // If parent is also a block, recursively resolve
        if (parent.type === 'block_id' && parent.block_id) {
          const pageId = await this.resolveBlockToPage(parent.block_id);
          if (pageId) {
            this.blockToPageCache.set(blockId, pageId);
            return pageId;
          }
        }
        
        // If parent is workspace, no page parent
        if (parent.type === 'workspace') {
          return undefined;
        }
      }
    } catch (error) {
      // Block not accessible, cannot resolve
      console.warn(`Could not resolve block ${blockId} to page:`, error instanceof Error ? error.message : 'Unknown error');
    }
    
    return undefined;
  }

  private async extractDatabaseInfo(database: any, includeDataSources: boolean = true, fetchPages: boolean = false): Promise<DatabaseInfo> {
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
      dataSources = await this.getDataSourcesForDatabase(database, fetchPages);
    }

    // Determine parent ID - if parent is a block, resolve it to the containing page
    let parentType = database.parent?.type || 'unknown';
    let parentId = database.parent?.database_id || database.parent?.page_id || database.parent?.block_id || database.parent?.data_source_id || database.parent?.workspace;
    
    // If parent is a block, try to resolve it to a page
    if (parentType === 'block_id' && database.parent?.block_id) {
      const resolvedPageId = await this.resolveBlockToPage(database.parent.block_id);
      if (resolvedPageId) {
        // Successfully resolved to a page
        parentType = 'page_id';
        parentId = resolvedPageId;
      }
      // If not resolved, keep block_id as parent (will trigger placeholder parent)
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
        type: parentType,
        id: parentId
      }
    };
  }

  private async getDataSourcesForDatabase(database: any, fetchPages: boolean = false): Promise<DataSource[]> {
    const dataSources: DataSource[] = [];

    try {
      if (this.apiVersion === '2025-09-03') {
        // Use the database object passed in (already fetched)
        if (database.data_sources && Array.isArray(database.data_sources)) {
          // Fetch all data sources in parallel for better performance
          const dataSourcePromises = database.data_sources.map(async (dsRef: any) => {
            try {
              const dataSourceResponse = await this.client.request({
                path: `data_sources/${dsRef.id}`,
                method: 'get'
              }) as any;
              
              return await this.extractDataSourceInfo(dataSourceResponse, dsRef.name, fetchPages);
            } catch (error) {
              console.warn(`Could not fetch data source ${dsRef.id}:`, error instanceof Error ? error.message : 'Unknown error');
              return null;
            }
          });
          
          const results = await Promise.all(dataSourcePromises);
          dataSources.push(...results.filter((ds): ds is DataSource => ds !== null));
        }
      }
    } catch (error) {
      console.warn(`Could not fetch data sources for database ${database.id}:`, error instanceof Error ? error.message : 'Unknown error');
    }

    return dataSources;
  }

  private async extractDataSourceInfo(dataSource: any, sourceName: string, fetchPages: boolean = false): Promise<DataSource> {
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

    // Fetch pages for this data source if requested
    let pages: PageInfo[] | undefined;
    if (fetchPages) {
      pages = await this.getDataSourcePages(dataSource.id);
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
      pages, // Include pages if fetched
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

  private async getDataSourcePages(dataSourceId: string): Promise<PageInfo[]> {
    const pages: PageInfo[] = [];
    
    try {
      let cursor: string | undefined;
      
      do {
        const response = await this.client.request({
          path: `data_sources/${dataSourceId}/query`,
          method: 'post',
          body: {
            start_cursor: cursor,
            page_size: 100
          }
        }) as any;

        if (response.results && Array.isArray(response.results)) {
          for (const page of response.results) {
            if ('properties' in page) {
              const pageInfo = await this.extractPageInfo(page);
              pages.push(pageInfo);
            }
          }
        }

        cursor = response.next_cursor || undefined;
      } while (cursor);
    } catch (error) {
      console.warn(`Could not fetch pages for data source ${dataSourceId}:`, error instanceof Error ? error.message : 'Unknown error');
    }

    return pages;
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

  async testConnection(): Promise<boolean> {
    try {
      await this.client.users.me({});
      return true;
    } catch (error: any) {
      if (error.code === 'unauthorized' || error.status === 401) {
        throw new Error('Notion API token is invalid. Please enter a valid token.');
      }
      console.error('Connection test failed:', error);
      return false;
    }
  }
}