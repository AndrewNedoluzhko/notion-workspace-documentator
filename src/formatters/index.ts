import { WorkspaceDocumentation, PageInfo, DatabaseInfo, DatabaseProperty, TreeNode, WorkspaceTree } from '../types/index.js';
import fs from 'fs/promises';
import path from 'path';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export abstract class BaseFormatter {
  abstract format(data: WorkspaceDocumentation): string;
  abstract getFileExtension(): string;

  async writeToFile(data: WorkspaceDocumentation, outputDir: string, filename?: string): Promise<string> {
    await fs.mkdir(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const defaultFilename = `notion-documentation-${timestamp}`;
    const finalFilename = filename || defaultFilename;
    const filePath = path.join(outputDir, `${finalFilename}.${this.getFileExtension()}`);
    
    const content = this.format(data);
    await fs.writeFile(filePath, content, 'utf-8');
    
    return filePath;
  }
}

export class JsonFormatter extends BaseFormatter {
  format(data: WorkspaceDocumentation): string {
    return JSON.stringify(data, null, 2);
  }

  getFileExtension(): string {
    return 'json';
  }
}

export class MarkdownFormatter extends BaseFormatter {
  format(data: WorkspaceDocumentation): string {
    const lines: string[] = [];

    lines.push('# Notion Workspace Mapping');
    lines.push('');
    lines.push(`Generated on: ${new Date(data.timestamp).toLocaleString()}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Pages:** ${data.summary.totalPages}`);
    lines.push(`- **Total Databases:** ${data.summary.totalDatabases}`);
    lines.push(`- **Total Properties:** ${data.summary.totalProperties}`);
    lines.push('');

    // Pages section
    if (data.pages.length > 0) {
      lines.push('## Pages');
      lines.push('');
      
      for (const page of data.pages) {
        lines.push(`### ${page.title}`);
        lines.push('');
        lines.push(`- **ID:** \`${page.id}\``);
        lines.push(`- **URL:** [Open in Notion](${page.url})`);
        lines.push(`- **Created:** ${new Date(page.createdTime).toLocaleString()}`);
        lines.push(`- **Last Edited:** ${new Date(page.lastEditedTime).toLocaleString()}`);
        lines.push(`- **Parent Type:** ${page.parent.type}`);
        if (page.parent.id) {
          lines.push(`- **Parent ID:** \`${page.parent.id}\``);
        }
        lines.push('');
      }
    }

    // Databases section
    if (data.databases.length > 0) {
      lines.push('## Databases');
      lines.push('');

      for (const db of data.databases) {
        lines.push(`### ${db.title}`);
        lines.push('');
        lines.push(`- **ID:** \`${db.id}\``);
        lines.push(`- **URL:** [Open in Notion](${db.url})`);
        if (db.description) {
          lines.push(`- **Description:** ${db.description}`);
        }
        lines.push(`- **Created:** ${new Date(db.createdTime).toLocaleString()}`);
        lines.push(`- **Last Edited:** ${new Date(db.lastEditedTime).toLocaleString()}`);
        lines.push(`- **Parent Type:** ${db.parent.type}`);
        if (db.parent.id) {
          lines.push(`- **Parent ID:** \`${db.parent.id}\``);
        }
        lines.push('');

        if (db.properties.length > 0) {
          lines.push('#### Properties');
          lines.push('');
          lines.push('| Name | Type | ID | Description | Options |');
          lines.push('|------|------|----|----|---------|');
          
          for (const prop of db.properties) {
            const options = prop.options ? JSON.stringify(prop.options) : '';
            const description = prop.description || '';
            lines.push(`| ${prop.name} | ${prop.type} | \`${prop.id}\` | ${description} | ${options} |`);
          }
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  getFileExtension(): string {
    return 'md';
  }
}

export class CsvFormatter extends BaseFormatter {
  format(data: WorkspaceDocumentation): string {
    const lines: string[] = [];

    // Pages CSV
    lines.push('# PAGES');
    lines.push('Type,ID,Title,URL,Created,LastEdited,ParentType,ParentID');
    
    for (const page of data.pages) {
      const row = [
        'page',
        `"${page.id}"`,
        `"${page.title.replace(/"/g, '""')}"`,
        `"${page.url}"`,
        `"${page.createdTime}"`,
        `"${page.lastEditedTime}"`,
        `"${page.parent.type}"`,
        `"${page.parent.id || ''}"`
      ];
      lines.push(row.join(','));
    }

    lines.push('');
    lines.push('# DATABASES');
    lines.push('Type,ID,Title,URL,Description,Created,LastEdited,ParentType,ParentID');
    
    for (const db of data.databases) {
      const row = [
        'database',
        `"${db.id}"`,
        `"${db.title.replace(/"/g, '""')}"`,
        `"${db.url}"`,
        `"${(db.description || '').replace(/"/g, '""')}"`,
        `"${db.createdTime}"`,
        `"${db.lastEditedTime}"`,
        `"${db.parent.type}"`,
        `"${db.parent.id || ''}"`
      ];
      lines.push(row.join(','));
    }

    lines.push('');
    lines.push('# DATABASE_PROPERTIES');
    lines.push('DatabaseID,DatabaseTitle,PropertyID,PropertyName,PropertyType,Description,Options');
    
    for (const db of data.databases) {
      for (const prop of db.properties) {
        const row = [
          `"${db.id}"`,
          `"${db.title.replace(/"/g, '""')}"`,
          `"${prop.id}"`,
          `"${prop.name.replace(/"/g, '""')}"`,
          `"${prop.type}"`,
          `"${(prop.description || '').replace(/"/g, '""')}"`,
          `"${prop.options ? JSON.stringify(prop.options).replace(/"/g, '""') : ''}"`
        ];
        lines.push(row.join(','));
      }
    }

    return lines.join('\n');
  }

  getFileExtension(): string {
    return 'csv';
  }
}

export class TreeFormatter extends BaseFormatter {
  format(data: WorkspaceDocumentation): string {
    const tree = this.buildTree(data);
    return this.renderTree(tree);
  }

  getFileExtension(): string {
    return 'txt';
  }

  private buildTree(data: WorkspaceDocumentation): WorkspaceTree {
    const allNodes: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // Create nodes for pages
    for (const page of data.pages) {
      const node: TreeNode = {
        id: page.id,
        title: `${page.title || 'Untitled Page'} page`,
        type: 'page',
        children: [],
        parentId: page.parent.id
      };
      allNodes.push(node);
      nodeMap.set(page.id, node);
    }

    // Create nodes for databases and their properties
    for (const database of data.databases) {
      const dbNode: TreeNode = {
        id: database.id,
        title: `${database.title || 'Untitled Database'} database`,
        type: 'database',
        children: [],
        parentId: database.parent.id
      };
      allNodes.push(dbNode);
      nodeMap.set(database.id, dbNode);

      // Create a "properties:" section if database has properties
      if (database.properties.length > 0) {
        const propertiesNode: TreeNode = {
          id: `${database.id}-properties`,
          title: 'properties:',
          type: 'properties-section',
          children: [],
          parentId: database.id
        };
        dbNode.children.push(propertiesNode);
        nodeMap.set(propertiesNode.id, propertiesNode);

        // Sort properties: title type first, then others
        const sortedProperties = [...database.properties].sort((a, b) => {
          if (a.type === 'title' && b.type !== 'title') return -1;
          if (a.type !== 'title' && b.type === 'title') return 1;
          return 0;
        });

        // Add property nodes as children of the properties section
        for (const property of sortedProperties) {
          const propNode: TreeNode = {
            id: property.id,
            title: this.formatPropertyTitle(property, data.databases),
            type: 'property',
            children: [],
            parentId: propertiesNode.id
          };
          propertiesNode.children.push(propNode);
          nodeMap.set(property.id, propNode);
        }
      }

      // Only create an "items:" section for database pages if includeItems is true
      if (data.includeItems) {
        const itemsNode: TreeNode = {
          id: `${database.id}-items`,
          title: 'items:',
          type: 'items-section',
          children: [],
          parentId: database.id
        };
        dbNode.children.push(itemsNode);
        nodeMap.set(itemsNode.id, itemsNode);
      }
    }

    // Build parent-child relationships for pages and databases
    const rootNodes: TreeNode[] = [];
    
    for (const node of allNodes) {
      if (node.type === 'property' || node.type === 'properties-section' || node.type === 'items-section') {
        continue; // These are already handled above
      }
      
      if (!node.parentId || node.parentId === 'workspace' || !nodeMap.has(node.parentId)) {
        // This is a root node
        rootNodes.push(node);
      } else {
        // This is a child node - check if parent is a database
        const parentId = node.parentId;
        const parent = nodeMap.get(parentId);
        
        if (parent && parent.type === 'database') {
          // This page belongs to a database - add it to the items section
          const itemsSection = nodeMap.get(`${parentId}-items`);
          if (itemsSection) {
            itemsSection.children.push(node);
          }
        } else if (parent) {
          // Regular parent-child relationship
          parent.children.push(node);
        }
      }
    }

    // Sort children by title
    this.sortTreeNodes(rootNodes);

    return {
      timestamp: data.timestamp,
      rootNodes,
      summary: data.summary
    };
  }

  private formatPropertyTitle(property: DatabaseProperty, databases: DatabaseInfo[]): string {
    let title = `${property.name} (${property.type})`;
    
    // Add options for select and multi-select properties
    if (property.type === 'select' || property.type === 'multi_select') {
      if (property.options && Array.isArray(property.options) && property.options.length > 0) {
        const optionNames = property.options.map((option: any) => option.name || option).join(', ');
        title += ` [${optionNames}]`;
      }
    }
    
    // Add options for status properties
    if (property.type === 'status') {
      if (property.options && Array.isArray(property.options) && property.options.length > 0) {
        const optionNames = property.options.map((option: any) => option.name || option).join(', ');
        title += ` [${optionNames}]`;
      }
    }
    
    // Add relation details
    if (property.type === 'relation') {
      if (property.options && property.options.database_id) {
        const relatedDb = databases.find(db => db.id === property.options.database_id);
        const dbName = relatedDb ? relatedDb.title : property.options.database_id;
        
        // Build relation details
        let relationDetails = `→ ${dbName}`;
        
        // Determine relation type and constraints
        let constraints = [];
        
        // Check for two-way relation (dual_property means it has a synced property)
        if (property.options.dual_property) {
          constraints.push('two-way');
        } else {
          constraints.push('one-way');
        }
        
        // Check if single_property exists (indicates relation limit)
        if (property.options.single_property !== undefined) {
          constraints.push('limit: 1 page');
        } else {
          constraints.push('no limit');
        }
        
        relationDetails += ` (${constraints.join(', ')})`;
        
        title += ` ${relationDetails}`;
      }
    }
    
    // Add formula expressions
    if (property.type === 'formula') {
      if (property.options && property.options.expression) {
        // Clean up the formula expression for display
        let expression = property.options.expression.toString();
        
        // Replace internal Notion property references with more readable format
        expression = expression.replace(/\{\{notion:block_property:[^}]+\}\}/g, '[Property]');
        
        // Remove excessive whitespace and newlines
        expression = expression.replace(/\s+/g, ' ').trim();
        
        // Show full formula (no length limit)
        title += ` [${expression}]`;
      }
    }
    
    return title;
  }

  private sortTreeNodes(nodes: TreeNode[]): void {
    nodes.sort((a, b) => {
      // Properties section should come first, then items section
      if (a.type === 'properties-section' && b.type !== 'properties-section') return -1;
      if (b.type === 'properties-section' && a.type !== 'properties-section') return 1;
      if (a.type === 'items-section' && b.type !== 'items-section' && b.type !== 'properties-section') return -1;
      if (b.type === 'items-section' && a.type !== 'items-section' && a.type !== 'properties-section') return 1;
      
      // Sort by type first (pages before databases), then by title
      if (a.type !== b.type) {
        if (a.type === 'page' && b.type === 'database') return -1;
        if (a.type === 'database' && b.type === 'page') return 1;
      }
      return a.title.localeCompare(b.title);
    });

    // Recursively sort children
    for (const node of nodes) {
      this.sortTreeNodes(node.children);
    }
  }

  private renderTree(tree: WorkspaceTree): string {
    const lines: string[] = [];
    
    lines.push('# Notion Workspace Tree Structure');
    lines.push('');
    lines.push(`Generated on: ${new Date(tree.timestamp).toLocaleString()}`);
    lines.push('');
    lines.push('## Summary');
    lines.push(`Pages: ${tree.summary.totalPages}`);
    lines.push(`Databases: ${tree.summary.totalDatabases}`);
    lines.push(`Properties: ${tree.summary.totalProperties}`);
    lines.push('');
    lines.push('## Workspace Structure');
    lines.push('');

    if (tree.rootNodes.length === 0) {
      lines.push('No accessible content found.');
      lines.push('Make sure your pages and databases are shared with the integration.');
    } else {
      for (const rootNode of tree.rootNodes) {
        this.renderNode(rootNode, '', lines, true);
      }
    }

    return lines.join('\n');
  }

  private renderNode(node: TreeNode, prefix: string, lines: string[], isLast: boolean): void {
    const connector = isLast ? '└── ' : '├── ';
    const typeIcon = this.getTypeIcon(node.type);
    lines.push(`${prefix}${connector}${typeIcon} ${node.title}`);

    if (node.children.length > 0) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const isLastChild = i === node.children.length - 1;
        this.renderNode(child, childPrefix, lines, isLastChild);
      }
    }
  }

  private getTypeIcon(type: string): string {
    switch (type) {
      case 'page':
        return '📄';
      case 'database':
        return '🗄️';
      case 'property':
        return '🔧';
      case 'properties-section':
        return '📋';
      case 'items-section':
        return '📁';
      default:
        return '📁';
    }
  }
}

export class NumberedFormatter extends BaseFormatter {
  private outputType: 'txt' | 'pdf' | 'doc' = 'txt';

  constructor(outputType: 'txt' | 'pdf' | 'doc' = 'txt') {
    super();
    this.outputType = outputType;
  }

  format(data: WorkspaceDocumentation): string {
    const lines: string[] = [];
    
    // Build tree structure similar to TreeFormatter
    const tree = this.buildTree(data);
    
    // Generate numbered output
    let counter = 1;
    for (const rootNode of tree.rootNodes) {
      this.formatNodeNumbered(rootNode, lines, [counter]);
      counter++;
    }
    
    return lines.join('\n');
  }

  getFileExtension(): string {
    return this.outputType === 'doc' ? 'docx' : this.outputType;
  }

  async writeToFile(data: WorkspaceDocumentation, outputDir: string, filename?: string): Promise<string> {
    await fs.mkdir(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const defaultFilename = `notion-numbered-documentation-${timestamp}`;
    const finalFilename = filename || defaultFilename;
    
    if (this.outputType === 'pdf') {
      return this.generatePDF(data, outputDir, finalFilename);
    } else if (this.outputType === 'doc') {
      return this.generateDOC(data, outputDir, finalFilename);
    } else {
      const filePath = path.join(outputDir, `${finalFilename}.${this.getFileExtension()}`);
      const content = this.format(data);
      await fs.writeFile(filePath, content, 'utf-8');
      return filePath;
    }
  }

  private async generatePDF(data: WorkspaceDocumentation, outputDir: string, filename: string): Promise<string> {
    const doc = new jsPDF();
    const content = this.format(data);
    const lines = content.split('\n');
    
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let yPosition = margin;
    
    // Add title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${data.workspaceName || 'Notion Workspace'} Workspace - Mapping`, margin, yPosition);
    yPosition += 16;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${new Date(data.timestamp).toLocaleString()}`, margin, yPosition);
    yPosition += 12;
    
    // Add summary
    doc.text(`Pages: ${data.summary.totalPages} | Databases: ${data.summary.totalDatabases} | Properties: ${data.summary.totalProperties}`, margin, yPosition);
    yPosition += 16;
    
    // Add content with specific formatting
    for (const line of lines) {
      if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
      
      if (line.trim()) {
        // Parse the line to get level and content
        const match = line.match(/^(\d+(?:\.\d+)*)\s+(.*)$/);
        if (match) {
          const [, number, originalText] = match;
          let text = originalText;
          const level = number.split('.').length;
          
          // Determine formatting based on content type and level
          let fontSize = 8; // default
          let fontStyle = 'normal';
          let spaceBefore = 0;
          let spaceAfter = 0;
          
          if (text.endsWith(' page')) {
            if (level === 1) {
              // First level pages: 20pt, bold, 10pt before, 5pt after
              fontSize = 20;
              fontStyle = 'bold';
              spaceBefore = 10;
              spaceAfter = 5;
            } else if (level === 2) {
              // Second level pages: 14pt, bold, 10pt before, 5pt after
              fontSize = 14;
              fontStyle = 'bold';
              spaceBefore = 10;
              spaceAfter = 5;
            } else if (level === 3) {
              // Third level pages (1.1.1): 12pt, bold, 5pt before, 2pt after
              fontSize = 12;
              fontStyle = 'bold';
              spaceBefore = 5;
              spaceAfter = 2;
            } else if (level >= 4) {
              // Fourth level and deeper pages (1.1.1.1+): 10pt, bold, 2pt before, 1pt after
              fontSize = 10;
              fontStyle = 'bold';
              spaceBefore = 2;
              spaceAfter = 1;
            }
          } else if (text.endsWith(' database')) {
            // Database: 12pt, bold, 5pt before, 2pt after
            fontSize = 12;
            fontStyle = 'bold';
            spaceBefore = 5;
            spaceAfter = 2;
          } else if (text === 'properties:') {
            // Properties: capitalize, 10pt, bold, 2pt before, 0pt after
            fontSize = 10;
            fontStyle = 'bold';
            spaceBefore = 2;
            spaceAfter = 0;
            text = 'Properties';
          } else if (text === 'items:') {
            // Items: capitalize, 10pt, bold, 2pt before, 0pt after
            fontSize = 10;
            fontStyle = 'bold';
            spaceBefore = 2;
            spaceAfter = 0;
            text = 'Items';
          }
          
          // Apply spacing before
          yPosition += spaceBefore;
          
          // Set font and add text
          doc.setFontSize(fontSize);
          doc.setFont('helvetica', fontStyle);
          
          // Truncate very long lines to fit PDF width
          const fullText = `${number} ${text}`;
          const truncatedLine = fullText.length > 120 ? fullText.substring(0, 117) + '...' : fullText;
          doc.text(truncatedLine, margin, yPosition);
          
          // Apply spacing after
          yPosition += fontSize * 0.35 + spaceAfter; // Font size in points converted to PDF units
        } else {
          // Default formatting for non-matching lines
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          const truncatedLine = line.length > 120 ? line.substring(0, 117) + '...' : line;
          doc.text(truncatedLine, margin, yPosition);
          yPosition += 6;
        }
      }
    }
    
    const filePath = path.join(outputDir, `${filename}.pdf`);
    const pdfOutput = doc.output();
    await fs.writeFile(filePath, Buffer.from(pdfOutput, 'binary'));
    
    return filePath;
  }

  private async generateDOC(data: WorkspaceDocumentation, outputDir: string, filename: string): Promise<string> {
    const content = this.format(data);
    const lines = content.split('\n');
    
    const paragraphs: Paragraph[] = [];
    
    // Add title
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${data.workspaceName || 'Notion Workspace'} Workspace - Mapping`,
            bold: true,
            size: 32,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 400 },
      })
    );
    
    // Add timestamp
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated on: ${new Date(data.timestamp).toLocaleString()}`,
            italics: true,
          }),
        ],
        spacing: { after: 200 },
      })
    );
    
    // Add summary
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Summary: ${data.summary.totalPages} Pages | ${data.summary.totalDatabases} Databases | ${data.summary.totalProperties} Properties`,
            bold: true,
          }),
        ],
        spacing: { after: 400 },
      })
    );
    
    // Add content lines with specific formatting
    for (const line of lines) {
      if (line.trim()) {
        // Determine the level based on the number prefix
        const match = line.match(/^(\d+(?:\.\d+)*)\s+(.*)$/);
        if (match) {
          const [, number, originalText] = match;
          let text = originalText;
          const level = number.split('.').length;
          
          // Determine formatting based on content type and level
          let fontSize = 16; // default (8pt * 2 = 16 half-points)
          let bold = false;
          let spaceBefore = 0;
          let spaceAfter = 0;
          
          if (text.endsWith(' page')) {
            if (level === 1) {
              // First level pages: 20pt, bold, 10pt before, 5pt after
              fontSize = 40; // 20pt * 2
              bold = true;
              spaceBefore = 200; // 10pt * 20
              spaceAfter = 100; // 5pt * 20
            } else if (level === 2) {
              // Second level pages: 14pt, bold, 10pt before, 5pt after
              fontSize = 28; // 14pt * 2
              bold = true;
              spaceBefore = 200; // 10pt * 20
              spaceAfter = 100; // 5pt * 20
            } else if (level === 3) {
              // Third level pages (1.1.1): 12pt, bold, 5pt before, 2pt after
              fontSize = 24; // 12pt * 2
              bold = true;
              spaceBefore = 100; // 5pt * 20
              spaceAfter = 40; // 2pt * 20
            } else if (level >= 4) {
              // Fourth level and deeper pages (1.1.1.1+): 10pt, bold, 2pt before, 1pt after
              fontSize = 20; // 10pt * 2
              bold = true;
              spaceBefore = 40; // 2pt * 20
              spaceAfter = 20; // 1pt * 20
            }
          } else if (text.endsWith(' database')) {
            // Database: 12pt, bold, 5pt before, 2pt after
            fontSize = 24; // 12pt * 2
            bold = true;
            spaceBefore = 100; // 5pt * 20
            spaceAfter = 40; // 2pt * 20
          } else if (text === 'properties:') {
            // Properties: capitalize, 10pt, bold, 2pt before, 0pt after
            fontSize = 20; // 10pt * 2
            bold = true;
            spaceBefore = 40; // 2pt * 20
            spaceAfter = 0;
            text = 'Properties';
          } else if (text === 'items:') {
            // Items: capitalize, 10pt, bold, 2pt before, 0pt after
            fontSize = 20; // 10pt * 2
            bold = true;
            spaceBefore = 40; // 2pt * 20
            spaceAfter = 0;
            text = 'Items';
          }
          
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${number} `,
                  bold: bold,
                  size: fontSize,
                }),
                new TextRun({
                  text: text,
                  bold: bold,
                  size: fontSize,
                }),
              ],
              spacing: { 
                before: spaceBefore,
                after: spaceAfter 
              },
            })
          );
        } else {
          // Default formatting for non-matching lines
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  size: 16, // default 8pt * 2
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }
      }
    }
    
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });
    
    const buffer = await Packer.toBuffer(doc);
    const filePath = path.join(outputDir, `${filename}.docx`);
    await fs.writeFile(filePath, buffer);
    
    return filePath;
  }

  private buildTree(data: WorkspaceDocumentation): WorkspaceTree {
    const allNodes: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // Create nodes for all pages
    for (const page of data.pages) {
      const node: TreeNode = {
        id: page.id,
        title: `${page.title || 'Untitled Page'} page`,
        type: 'page',
        children: [],
        parentId: page.parent.id
      };
      allNodes.push(node);
      nodeMap.set(page.id, node);
    }

    // Create nodes for databases and their properties
    for (const database of data.databases) {
      const dbNode: TreeNode = {
        id: database.id,
        title: `${database.title || 'Untitled Database'} database`,
        type: 'database',
        children: [],
        parentId: database.parent.id
      };
      allNodes.push(dbNode);
      nodeMap.set(database.id, dbNode);

      // Create a "properties:" section if database has properties
      if (database.properties.length > 0) {
        const propertiesNode: TreeNode = {
          id: `${database.id}-properties`,
          title: 'properties:',
          type: 'properties-section',
          children: [],
          parentId: database.id
        };
        dbNode.children.push(propertiesNode);
        nodeMap.set(propertiesNode.id, propertiesNode);

        // Sort properties: title type first, then others
        const sortedProperties = [...database.properties].sort((a, b) => {
          if (a.type === 'title' && b.type !== 'title') return -1;
          if (a.type !== 'title' && b.type === 'title') return 1;
          return 0;
        });

        // Add property nodes as children of the properties section
        for (const property of sortedProperties) {
          const propNode: TreeNode = {
            id: property.id,
            title: this.formatPropertyTitle(property, data.databases),
            type: 'property',
            children: [],
            parentId: propertiesNode.id
          };
          propertiesNode.children.push(propNode);
          nodeMap.set(property.id, propNode);
        }
      }

      // Create an "items:" section for database pages only when includeItems is true
      if (data.includeItems) {
        const itemsNode: TreeNode = {
          id: `${database.id}-items`,
          title: 'items:',
          type: 'items-section',
          children: [],
          parentId: database.id
        };
        dbNode.children.push(itemsNode);
        nodeMap.set(itemsNode.id, itemsNode);

        // Add database items (pages that belong to this database) as children of items section
        const databasePages = data.pages.filter(page => 
          page.parent.type === 'database_id' && page.parent.id === database.id
        );
        
        for (const dbPage of databasePages) {
          const existingNode = nodeMap.get(dbPage.id);
          if (existingNode) {
            existingNode.parentId = itemsNode.id;
            itemsNode.children.push(existingNode);
          }
        }
      }
    }

    // Build parent-child relationships
    const rootNodes: TreeNode[] = [];
    
    for (const node of allNodes) {
      if (!node.parentId) {
        rootNodes.push(node);
      } else {
        const parent = nodeMap.get(node.parentId);
        if (parent && !parent.children.includes(node)) {
          parent.children.push(node);
        } else if (!parent) {
          // If parent not found, treat as root
          rootNodes.push(node);
        }
      }
    }

    return { 
      timestamp: data.timestamp,
      rootNodes, 
      summary: data.summary
    };
  }

  private formatPropertyTitle(property: DatabaseProperty, databases: DatabaseInfo[]): string {
    let title = `${property.name} (${property.type})`;
    
    if (property.options) {
      if (property.type === 'select' || property.type === 'multi_select' || property.type === 'status') {
        const optionNames = property.options.map((opt: any) => opt.name);
        if (optionNames.length > 0) {
          title += ` [${optionNames.join(', ')}]`;
        }
      } else if (property.type === 'relation' && property.options.length > 0) {
        const relationOption = property.options[0];
        const relatedDb = databases.find(db => db.id === relationOption.database_id);
        const dbName = relatedDb ? relatedDb.title : 'Unknown Database';
        
        let relationDetails = `→ ${dbName}`;
        
        if (relationOption.type === 'dual_property') {
          relationDetails += ' (two-way';
        } else {
          relationDetails += ' (one-way';
        }
        
        if (relationOption.single_property === false) {
          relationDetails += ', no limit)';
        } else {
          relationDetails += ', limit: 1 page)';
        }
        
        title += ` ${relationDetails}`;
      } else if (property.type === 'formula' && property.options.length > 0) {
        const formulaExpression = property.options[0].expression;
        if (formulaExpression) {
          title += ` [${formulaExpression}]`;
        }
      }
    }
    
    return title;
  }

  private formatNodeNumbered(node: TreeNode, lines: string[], numberPath: number[]): void {
    const numberString = numberPath.join('.');
    lines.push(`${numberString} ${node.title}`);
    
    // Process children with incremented numbering
    let childCounter = 1;
    for (const child of node.children) {
      const childPath = [...numberPath, childCounter];
      this.formatNodeNumbered(child, lines, childPath);
      childCounter++;
    }
  }
}

export class FormatterFactory {
  static create(format: string): BaseFormatter {
    switch (format.toLowerCase()) {
      case 'json':
        return new JsonFormatter();
      case 'markdown':
      case 'md':
        return new MarkdownFormatter();
      case 'csv':
        return new CsvFormatter();
      case 'tree':
        return new TreeFormatter();
      case 'numbered':
        return new NumberedFormatter('txt');
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  static createNumbered(outputType: 'txt' | 'pdf' | 'doc' = 'txt'): BaseFormatter {
    return new NumberedFormatter(outputType);
  }

  static async writeAllFormats(data: WorkspaceDocumentation, outputDir: string): Promise<string[]> {
    const formatters = [
      new JsonFormatter(),
      new MarkdownFormatter(),
      new CsvFormatter(),
      new TreeFormatter(),
      new NumberedFormatter('txt'),
      new NumberedFormatter('pdf'),
      new NumberedFormatter('doc')
    ];

    const files: string[] = [];
    
    for (const formatter of formatters) {
      const filePath = await formatter.writeToFile(data, outputDir);
      files.push(filePath);
    }

    return files;
  }
}