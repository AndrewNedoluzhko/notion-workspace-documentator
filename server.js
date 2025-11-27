import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { NotionService } from './dist/services/notion.js';
import { FormatterFactory } from './dist/formatters/index.js';
import fs from 'fs/promises';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase payload limit for large workspaces
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'web')));

// Store generated files temporarily (in production, use cloud storage)
const tempFiles = new Map();

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

// Fetch pages endpoint
app.post('/api/pages', async (req, res) => {
    try {
        const { apiKey, apiVersion } = req.body;

        if (!apiKey) {
            return res.status(400).json({ error: 'API key is required' });
        }

        const notionService = new NotionService(apiKey, apiVersion || '2025-09-03');
        const pages = await notionService.getAllPages();

        res.json({
            success: true,
            count: pages.length,
            pages: pages
        });
    } catch (error) {
        console.error('Error fetching pages:', error);
        
        // Check for unauthorized error
        if (error.code === 'unauthorized' || error.status === 401) {
            return res.status(401).json({
                error: 'Invalid API token',
                message: 'Notion API token is invalid. Please enter a valid token.'
            });
        }
        
        res.status(500).json({
            error: 'Failed to fetch pages',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Fetch databases endpoint
app.post('/api/databases', async (req, res) => {
    try {
        const { apiKey, apiVersion, includeSchema, includeItems } = req.body;

        if (!apiKey) {
            return res.status(400).json({ error: 'API key is required' });
        }

        const notionService = new NotionService(apiKey, apiVersion || '2025-09-03');
        const databases = await notionService.getAllDatabases(includeSchema, includeItems);

        res.json({
            success: true,
            count: databases.length,
            databases: databases
        });
    } catch (error) {
        console.error('Error fetching databases:', error);
        
        // Check for unauthorized error
        if (error.code === 'unauthorized' || error.status === 401) {
            return res.status(401).json({
                error: 'Invalid API token',
                message: 'Notion API token is invalid. Please enter a valid token.'
            });
        }
        
        res.status(500).json({
            error: 'Failed to fetch databases',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Generate documentation endpoint
app.post('/api/generate', async (req, res) => {
    try {
        const { workspaceName, apiKey, apiVersion, formats, includeSchema, includeItems } = req.body;

        if (!workspaceName || !formats || formats.length === 0) {
            return res.status(400).json({ error: 'Workspace name and formats are required' });
        }

        if (!apiKey) {
            return res.status(400).json({ error: 'API key is required' });
        }

        // Create Notion service
        const notionService = new NotionService(apiKey, apiVersion || '2025-09-03');

        // Test connection first to provide better error message
        try {
            await notionService.testConnection();
        } catch (error) {
            return res.status(401).json({
                error: 'Invalid API token',
                message: error.message || 'Notion API token is invalid. Please enter a valid token.'
            });
        }

        // Fetch pages and databases from Notion
        const pages = await notionService.getAllPages();
        const allDatabases = await notionService.getAllDatabases(undefined, includeSchema, includeItems);

        // Filter databases based on includeSchema
        const databases = includeSchema ? allDatabases : allDatabases.map(db => ({
            ...db,
            properties: [],
            dataSources: []
        }));

        // Ensure databases is an array
        const databasesArray = databases || [];
        const pagesArray = pages || [];

        // Filter pages based on includeItems setting (matching CLI logic)
        let filteredPages;
        if (includeItems) {
            if (apiVersion === '2025-09-03' && databasesArray.some(db => db.dataSources && db.dataSources.length > 0)) {
                // New API with items: Pages are already included in data sources, only include non-database pages
                filteredPages = pagesArray.filter(page => page.parent.type !== 'data_source_id' && page.parent.type !== 'database_id');
            } else {
                // Old API with items: Include all pages
                filteredPages = pagesArray;
            }
        } else {
            // Not including items: Filter out all database and data source pages
            filteredPages = pagesArray.filter(page => page.parent.type !== 'database_id' && page.parent.type !== 'data_source_id');
        }

        // Create timestamp matching CLI format: YYYY-MM-DD-HH-MM-SS
        const timestamp = new Date();
        const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
        const cleanWorkspaceName = workspaceName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        const baseFilename = `${cleanWorkspaceName}_NWS_${dateStr}-${timeStr}`;
        
        const generatedFiles = [];

        // Calculate total properties (both from database and data sources)
        const totalProperties = databasesArray.reduce((sum, db) => {
            // Count properties from database itself (old API)
            const dbProps = db.properties ? Object.keys(db.properties).length : 0;
            // Count properties from data sources (new API)
            const dsProps = db.dataSources?.reduce((dsSum, ds) => dsSum + (ds.properties ? ds.properties.length : 0), 0) || 0;
            return sum + dbProps + dsProps;
        }, 0);

        // Create workspace documentation object
        const workspaceDoc = {
            timestamp: new Date().toISOString(),
            workspaceName: workspaceName,
            pages: filteredPages,
            databases: databasesArray,
            summary: {
                totalPages: filteredPages.length,
                totalDatabases: databasesArray.length,
                totalProperties: totalProperties
            },
            includeSchema: includeSchema,
            includeItems: includeItems
        };

        // Output directory
        const outputDir = path.join(__dirname, 'output');
        await fs.mkdir(outputDir, { recursive: true });

        // Generate each requested format
        for (const format of formats) {
            try {
                let formatter;
                let filePath;
                let filenameSuffix = '';
                
                switch (format) {
                    case 'json':
                        formatter = FormatterFactory.create('json');
                        filePath = await formatter.writeToFile(workspaceDoc, outputDir, baseFilename + filenameSuffix);
                        break;
                    case 'markdown':
                        formatter = FormatterFactory.create('markdown');
                        filePath = await formatter.writeToFile(workspaceDoc, outputDir, baseFilename + filenameSuffix);
                        break;
                    case 'csv':
                        formatter = FormatterFactory.create('csv');
                        filePath = await formatter.writeToFile(workspaceDoc, outputDir, baseFilename + filenameSuffix);
                        break;
                    case 'tree':
                        formatter = FormatterFactory.create('tree');
                        filenameSuffix = '_tree';
                        filePath = await formatter.writeToFile(workspaceDoc, outputDir, baseFilename + filenameSuffix);
                        break;
                    case 'numbered':
                        formatter = FormatterFactory.createNumbered('txt');
                        filenameSuffix = '_numbered';
                        filePath = await formatter.writeToFile(workspaceDoc, outputDir, baseFilename + filenameSuffix);
                        break;
                    case 'docx':
                        formatter = FormatterFactory.createNumbered('doc');
                        filePath = await formatter.writeToFile(workspaceDoc, outputDir, baseFilename + filenameSuffix);
                        break;
                    case 'pdf':
                        formatter = FormatterFactory.createNumbered('pdf');
                        filePath = await formatter.writeToFile(workspaceDoc, outputDir, baseFilename + filenameSuffix);
                        break;
                    default:
                        throw new Error(`Unsupported format: ${format}`);
                }

                // Store file info for download
                const fileId = crypto.randomBytes(16).toString('hex');
                const actualFilename = path.basename(filePath);
                
                tempFiles.set(fileId, {
                    filename: actualFilename,
                    path: filePath,
                    createdAt: Date.now()
                });

                generatedFiles.push({
                    id: fileId,
                    filename: actualFilename,
                    format,
                    size: (await fs.stat(filePath)).size
                });
            } catch (formatError) {
                console.error(`Error generating ${format}:`, formatError);
                // Continue with other formats
            }
        }

        // Clean up old files (older than 1 hour)
        cleanupOldFiles();

        res.json({
            success: true,
            files: generatedFiles,
            summary: {
                totalPages: pagesArray.length,
                totalDatabases: databasesArray.length
            }
        });
    } catch (error) {
        console.error('Error generating documentation:', error);
        
        // Check for unauthorized error
        if (error.code === 'unauthorized' || error.status === 401) {
            return res.status(401).json({
                error: 'Invalid API token',
                message: 'Notion API token is invalid. Please enter a valid token.'
            });
        }
        
        res.status(500).json({
            error: 'Failed to generate documentation',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Download file endpoint
app.get('/api/download/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const fileInfo = tempFiles.get(fileId);

        if (!fileInfo) {
            return res.status(404).json({ error: 'File not found or expired' });
        }

        res.download(fileInfo.path, fileInfo.filename, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                res.status(500).json({ error: 'Failed to download file' });
            }
        });
    } catch (error) {
        console.error('Error in download endpoint:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// Serve web UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// Helper functions
function getFileExtension(format) {
    const extensions = {
        json: 'json',
        markdown: 'md',
        csv: 'csv',
        tree: 'txt',
        numbered: 'txt',
        docx: 'docx',
        pdf: 'pdf'
    };
    return extensions[format] || 'txt';
}

function cleanupOldFiles() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [fileId, fileInfo] of tempFiles.entries()) {
        if (fileInfo.createdAt < oneHourAgo) {
            fs.unlink(fileInfo.path).catch(err => {
                console.error('Error deleting old file:', err);
            });
            tempFiles.delete(fileId);
        }
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Notion Documentator Web Server`);
    console.log(`📍 Server running at: http://localhost:${PORT}`);
    console.log(`🌐 Open your browser and navigate to the URL above\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
