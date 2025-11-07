export interface Config {
  notionApiKey: string;
  databaseIds?: string[];
  outputFormat: 'json' | 'markdown' | 'csv' | 'tree' | 'numbered' | 'all';
  outputDir: string;
}

export interface PageInfo {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
  createdTime: string;
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

export interface DatabaseInfo {
  id: string;
  title: string;
  url: string;
  description?: string;
  lastEditedTime: string;
  createdTime: string;
  properties: DatabaseProperty[];
  parent: {
    type: string;
    id?: string;
  };
}

export interface WorkspaceDocumentation {
  timestamp: string;
  workspaceName?: string;
  pages: PageInfo[];
  databases: DatabaseInfo[];
  summary: {
    totalPages: number;
    totalDatabases: number;
    totalProperties: number;
  };
  includeItems?: boolean;
}

export interface TreeNode {
  id: string;
  title: string;
  type: 'page' | 'database' | 'property' | 'properties-section' | 'items-section';
  children: TreeNode[];
  parentId?: string;
}

export interface WorkspaceTree {
  timestamp: string;
  rootNodes: TreeNode[];
  summary: {
    totalPages: number;
    totalDatabases: number;
    totalProperties: number;
  };
}