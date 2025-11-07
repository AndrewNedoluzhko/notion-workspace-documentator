# 🚀 Notion Workspace Documentator

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Notion](https://img.shields.io/badge/Notion-%23000000.svg?style=for-the-badge&logo=notion&logoColor=white)

A powerful, interactive CLI tool to automatically document your entire Notion workspace structure. Generate professional documentation in multiple formats including PDF, DOCX, Markdown, and more!

## ✨ Features

- 🎯 **Interactive CLI Interface** - User-friendly prompts for easy operation
- 📄 **Multi-Format Output** - PDF, DOCX, Markdown, JSON, CSV, Tree structure, and TXT
- 🎨 **Professional Formatting** - Beautiful, business-ready documentation with proper typography
- � **Comprehensive Documentation** - Pages, databases, properties, relationships, and schemas
- 🔧 **Flexible Configuration** - Choose workspace name, output formats, and include/exclude options
- 🚀 **Modern TypeScript** - Built with TypeScript for reliability and maintainability
- � **Smart File Naming** - Custom workspace-based file naming with timestamps

## 🎬 Demo

```bash
$ npm start

🚀 Welcome to Notion Workspace Documentator!

✔ Enter Workspace Name: My Company Wiki
✔ Enter NOTION_API_KEY: ****************************
✔ Choose document format: PDF - Portable document format
✔ Include database items (pages) in documentation? Yes

📋 Configuration:
   Workspace: My Company Wiki
   Format: pdf
   Include Items: Yes
   Output Directory: ./output

🔍 Testing Notion API connection...
✅ Connected to Notion API

📄 Fetching pages... Found 150 pages
🗄️ Fetching databases... Found 25 databases
📝 Generating documentation...
✅ Documentation generated successfully!

📁 Generated file: output/My_Company_Wiki_WP_2025-11-07-14-30-15.pdf
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- A Notion account with workspace access

### Installation

1. **Clone this repository:**
```bash
git clone https://github.com/AndrewNedoluzhko/notion-workspace-documentator.git
cd notion-workspace-documentator
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
```bash
npm run build
```

4. **Run the interactive CLI:**
```bash
npm start
```

## 🔧 Setup Your Notion Integration

### Step 1: Create Notion Integration

1. Visit [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Name it (e.g., "Workspace Documentator")
4. Select your workspace
5. Click **"Submit"**
6. Copy the **Integration Token** (starts with `secret_` or `ntn_`)

### Step 2: Share Content with Integration

⚠️ **Important**: Share pages/databases with your integration to access them.

1. Open any page or database in Notion
2. Click **"Share"** in the top-right corner
3. Click **"Invite"** and select your integration
4. Grant **Read** permissions

## 📋 Output Formats

| Format | Extension | Description | Use Case |
|--------|-----------|-------------|----------|
| **PDF** | `.pdf` | Professional document with hierarchical formatting | Reports, presentations, archival |
| **DOCX** | `.docx` | Microsoft Word document with proper typography | Editing, collaboration, templates |
| **Numbered TXT** | `.txt` | Hierarchical numbered structure | Quick reference, planning |
| **Markdown** | `.md` | GitHub-friendly format with links | Documentation, wikis |
| **JSON** | `.json` | Structured data format | API integration, analysis |
| **CSV** | `.csv` | Spreadsheet-compatible format | Data analysis, imports |
| **Tree** | `.txt` | Visual tree structure with icons | Architecture overview |
| **All** | Multiple | Generate all formats at once | Complete documentation set |

### Sample Output Structure

```
📁 output/
├── 📄 My_Workspace_WP_2025-11-07-14-30-15.pdf      # Professional PDF
├── 📄 My_Workspace_WP_2025-11-07-14-30-15.docx     # Word document
├── 📄 My_Workspace_WP_2025-11-07-14-30-15.md       # Markdown
├── 📄 My_Workspace_WP_2025-11-07-14-30-15.json     # JSON data
├── 📄 My_Workspace_WP_2025-11-07-14-30-15.csv      # CSV spreadsheet
└── 📄 My_Workspace_WP_2025-11-07-14-30-15.txt      # Tree structure
```

## 💼 Interactive Usage

The tool features a beautiful interactive CLI that guides you through the documentation process:

### Interactive Prompts

1. **📝 Workspace Name**: Enter your workspace name for file naming
2. **🔑 API Key**: Securely enter your Notion integration token
3. **📄 Format Selection**: Choose from 8 output formats
4. **📊 Items Inclusion**: Toggle database items (pages) inclusion

### Example Session

```bash
🚀 Welcome to Notion Workspace Documentator!

✔ Enter Workspace Name: Product Roadmap 2025
✔ Enter NOTION_API_KEY: ********************************
✔ Choose document format: All - Generate all formats
✔ Include database items (pages) in documentation? Yes

📋 Configuration:
   Workspace: Product Roadmap 2025
   Format: all
   Include Items: Yes
   Output Directory: ./output

🔍 Testing Notion API connection...
✅ Connected to Notion API

📄 Fetching pages... Found 89 pages
🗄️ Fetching databases... Found 12 databases
   Found 156 total properties

📝 Generating documentation...
✅ Documentation generated successfully!

📁 Generated files:
   - Product_Roadmap_2025_WP_2025-11-07-14-30-15.json
   - Product_Roadmap_2025_WP_2025-11-07-14-30-15.md
   - Product_Roadmap_2025_WP_2025-11-07-14-30-15.csv
   - Product_Roadmap_2025_WP_2025-11-07-14-30-15.txt
   - Product_Roadmap_2025_WP_2025-11-07-14-30-15.pdf
   - Product_Roadmap_2025_WP_2025-11-07-14-30-15.docx

📊 Summary:
   Pages: 89
   Databases: 12
   Properties: 156
```

## ⚙️ Advanced Usage

### Non-Interactive Mode (Legacy)

For automation and CI/CD pipelines:

```bash
# Set environment variables
export NOTION_API_KEY="your_api_key_here"

# Generate specific format
npm start -- -f pdf

# Generate all formats
npm start -- -f all

# Specify output directory
npm start -- -o ./documentation

# Test connection
npm start -- --test-connection
```

### CLI Options

| Option | Description | Example |
|--------|-------------|---------|
| `-f, --format` | Output format | `-f pdf` |
| `-o, --output` | Output directory | `-o ./docs` |
| `--test-connection` | Test API connection | `--test-connection` |

## 📊 Documentation Content

### What Gets Documented

- **📄 Pages**: All accessible pages with titles, IDs, and metadata
- **🗄️ Databases**: Complete database schemas and configurations
- **🔧 Properties**: Detailed property definitions, types, and options
- **🔗 Relations**: Database relationships and connections
- **📝 Formulas**: Formula expressions and calculations
- **🎛️ Views**: Database views and filtering configurations
- **📅 Timestamps**: Creation and modification dates

### Professional Formatting Features

#### PDF Output
- **Hierarchical Font Sizing**: 20pt → 14pt → 12pt → 10pt for levels
- **Professional Typography**: Bold headings, proper spacing
- **Business-Ready Layout**: Clean, printable format

#### DOCX Output  
- **Microsoft Word Compatibility**: Proper .docx formatting
- **Professional Styling**: Consistent fonts and spacing
- **Template-Ready**: Easy to customize and brand

## 🛠️ Development

### Scripts

```bash
# Start interactive CLI
npm start

# Development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Test connection
npm start -- --test-connection
```

### Project Structure

```
notion-workspace-documentator/
├── 📁 src/
│   ├── 📄 index.ts              # Main CLI application
│   ├── 📁 services/
│   │   └── 📄 notion.ts         # Notion API service
│   ├── 📁 formatters/
│   │   └── 📄 index.ts          # Output formatters (PDF, DOCX, etc.)
│   ├── 📁 types/
│   │   └── 📄 index.ts          # TypeScript interfaces
│   └── 📄 config.ts             # Configuration management
├── 📁 output/                   # Generated documentation
├── 📄 package.json              # Dependencies and scripts
├── 📄 tsconfig.json             # TypeScript configuration
└── 📄 README.md                 # This file
```

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **"API token is invalid"** | Verify your integration token and workspace access |
| **"No pages/databases found"** | Share content with your integration in Notion |
| **"API key seems too short"** | Ensure you copied the complete integration token |
| **Connection timeout** | Check internet connection and Notion service status |

### Debug Steps

1. **Test Connection**:
   ```bash
   npm start -- --test-connection
   ```

2. **Check Integration Permissions**:
   - Visit your Notion integration settings
   - Verify workspace access
   - Ensure content is shared with integration

3. **Validate API Key Format**:
   - Should start with `secret_` or `ntn_`
   - Must be at least 20 characters long

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new features
- Update documentation for changes
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## ⭐ Support

If this tool helps you document your Notion workspace, please consider:

- ⭐ **Starring** this repository
- 🐛 **Reporting** issues and bugs
- 💡 **Suggesting** new features
- 🤝 **Contributing** to the codebase

## 🙏 Acknowledgments

- Built with [Notion API](https://developers.notion.com/)
- Powered by [TypeScript](https://www.typescriptlang.com/)
- CLI interface with [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/)
- PDF generation with [jsPDF](https://github.com/parallax/jsPDF)
- Word documents with [docx](https://github.com/dolanmiu/docx)

---

**📧 Questions or Issues?** Open an issue on GitHub or reach out to the community!

**🚀 Happy Documenting!** Transform your Notion workspace into professional documentation in minutes.