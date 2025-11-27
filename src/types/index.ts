export interface Config {
  notionApiKey: string;
  databaseIds?: string[];
  outputFormat: 'json' | 'markdown' | 'csv' | 'tree' | 'numbered' | 'all';
  outputDir: string;
  apiVersion?: '2022-06-28' | '2025-09-03';
  includeDataSources?: boolean;
}

export interface PageInfo {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
  createdTime: string;
  icon?: string;
  parent: {
    type: string;
    id?: string;
  };
  properties: Record<string, any>;
}

export interface DatabaseProperty {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: any;
}

export interface DataSource {
  id: string;
  name: string;
  title: string;
  description?: string;
  properties: DatabaseProperty[];
  pages?: PageInfo[]; // Pages belonging to this data source (for new API)
  parent: {
    type: string;
    database_id: string;
  };
  database_parent: {
    type: string;
    page_id?: string;
  };
  createdTime: string;
  lastEditedTime: string;
  sourceDatabaseName?: string; // Name of the database this data source comes from
}

export interface DatabaseInfo {
  id: string;
  title: string;
  url: string;
  description?: string;
  lastEditedTime: string;
  createdTime: string;
  icon?: string;
  properties: DatabaseProperty[]; // The database's own properties
  dataSources: DataSource[]; // Views from this or other databases
  parent: {
    type: string;
    id?: string;
  };
}

export interface WorkspaceDocumentation {
  timestamp: string;
  workspaceName: string;
  pages: PageInfo[];
  databases: DatabaseInfo[];
  summary: {
    totalPages: number;
    totalDatabases: number;
    totalProperties: number;
  };
  includeSchema?: boolean;
  includeItems?: boolean;
}

export interface TreeNode {
  id: string;
  title: string;
  type: 'page' | 'database' | 'property' | 'properties-section' | 'views-section' | 'data-source' | 'items-section' | 'pages-section';
  children: TreeNode[];
  parentId?: string;
  sourceDatabaseName?: string; // For data sources, name of source database
}

export interface WorkspaceTree {
  timestamp: string;
  rootNodes: TreeNode[];
  summary: {
    totalPages: number;
    totalDatabases: number;
    totalProperties: number;
  };
  includeSchema?: boolean;
  includeItems?: boolean;
}