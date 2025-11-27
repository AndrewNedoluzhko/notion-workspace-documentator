# Web Interface Guide

## Overview

The Notion Documentator now includes a web-based interface that works in all major browsers including Google Chrome, Microsoft Edge, Firefox, Opera, and Safari.

## Quick Start

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Start the web server**:
   ```bash
   npm run server
   ```

3. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

4. **Fill in the form**:
   - **Workspace Name**: Enter a name for your Notion workspace (used for file naming)
   - **Notion API Key**: Your Notion integration API key ([Get one here](https://www.notion.so/my-integrations))
   - **Output Formats**: Select one or more formats (JSON, Markdown, CSV, Tree, Numbered, DOCX, PDF)
   - **Options**: 
     - Include database schemas (checked by default)
     - Include database items (unchecked by default - can significantly increase generation time)
   - **API Version**: Select the Notion API version (2025-09-03 is default)

5. **Generate Documentation**: Click the "Generate Documentation" button

6. **Download Files**: Once generation is complete, download the generated files

## Features

- **Multi-format Selection**: Generate multiple formats in a single request
- **Real-time Progress**: See live progress as pages, databases, and documentation are processed
- **Responsive Design**: Works on desktop and mobile devices
- **Cross-browser Compatible**: Tested on Chrome, Edge, Firefox, Opera, and Safari
- **Secure**: API keys are not stored and are only used for the current session

## Architecture

The web interface consists of three main components:

1. **Frontend** (`web/` directory):
   - `index.html` - Main HTML structure with form and progress indicators
   - `styles.css` - Modern, responsive styling with gradient design
   - `app.js` - Client-side JavaScript for form handling and API communication

2. **Backend** (`server.js`):
   - Express.js server handling API requests
   - Endpoints for fetching pages, databases, and generating documentation
   - File download management with automatic cleanup

3. **Core Services** (`src/` directory):
   - NotionService for API communication
   - Formatters for generating different output formats

## API Endpoints

### GET /api/health
Health check endpoint
- **Response**: `{ status: 'ok', version: '1.0.0' }`

### POST /api/pages
Fetch all pages from Notion workspace
- **Body**: `{ apiKey: string, apiVersion?: string }`
- **Response**: `{ success: boolean, count: number, pages: PageInfo[] }`

### POST /api/databases
Fetch all databases from Notion workspace
- **Body**: `{ apiKey: string, apiVersion?: string, includeSchema: boolean, includeItems: boolean }`
- **Response**: `{ success: boolean, count: number, databases: DatabaseInfo[] }`

### POST /api/generate
Generate documentation files
- **Body**: `{ workspaceName: string, formats: string[], pages: PageInfo[], databases: DatabaseInfo[], includeSchema: boolean, includeItems: boolean }`
- **Response**: `{ success: boolean, files: FileInfo[], summary: { totalPages: number, totalDatabases: number } }`

### GET /api/download/:fileId
Download generated file
- **Response**: File download stream

## Development

### Run in development mode with auto-reload:
```bash
npm run server:dev
```

### Environment Variables

Create a `.env` file in the root directory:
```
PORT=3000
NODE_ENV=development
```

## Production Deployment

For production deployment, consider:

1. **Environment Variables**: Set proper environment variables for production
2. **File Storage**: Replace in-memory file storage with cloud storage (AWS S3, Google Cloud Storage, etc.)
3. **Authentication**: Add user authentication if needed
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **HTTPS**: Use HTTPS in production
6. **Error Monitoring**: Integrate error monitoring (Sentry, LogRocket, etc.)

## Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Verify all dependencies are installed: `npm install`
- Check for syntax errors in server.js

### API calls failing
- Verify your Notion API key is correct
- Ensure your Notion integration has access to the workspace
- Check browser console for detailed error messages

### Files not downloading
- Check if the `output/` directory exists and is writable
- Verify sufficient disk space
- Check browser download settings

## Browser Support

- ✅ Google Chrome (latest)
- ✅ Microsoft Edge (latest)
- ✅ Mozilla Firefox (latest)
- ✅ Opera (latest)
- ✅ Safari (latest)

## Security Notes

- API keys are transmitted securely but not stored
- Files are automatically deleted after 1 hour
- Use HTTPS in production
- Never commit API keys to version control

## Contributing

Feel free to submit issues and enhancement requests!
