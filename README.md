# Notion Workspace Mapper

![Logo](web/img/logo_3_3.png)

Map your Notion workspace structure with ease. Generate comprehensive documentation of your workspace including pages, databases, properties, and data sources in multiple formats.

## Features

- 🗺️ **Complete Workspace Mapping** - Capture entire workspace structure
- 📊 **Multiple Output Formats** - JSON, Markdown, CSV, Tree TXT, Numbered TXT, DOCX, PDF
- 🔗 **Data Sources Support** - Full support for Notion's 2025-09-03 API with data sources
- 🎨 **Web Interface** - Beautiful, modern web UI for easy access
- ⚡ **CLI Support** - Command-line interface for automation
- 📋 **Schema Documentation** - Capture database properties and their configurations
- 📄 **Items Inclusion** - Optionally include database items (pages) in mapping

## Prerequisites

- Node.js 16+ installed
- A Notion workspace
- A Notion integration token (see setup below)

## 🚀 Quick Start

### 1. Create a Notion Integration

**Important:** You must create a **new, separate integration** specifically for this mapper tool.

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Give it a meaningful name (e.g., "Workspace Mapper")
4. Select your workspace
5. Set capabilities:
   - ✅ **Read content** - Required
   - ✅ **Read user information** - Optional
   - ❌ Update content - Not needed
   - ❌ Insert content - Not needed
6. Click **"Submit"** to create the integration
7. Copy the **Internal Integration Token** (starts with `ntn_`)

> **💡 Tip:** Keep this token secure! It provides access to all pages/databases you share with this integration.

### 2. Share Your Workspace with the Integration

**Critical Step:** The integration can only access content that is explicitly shared with it.

#### For Root Pages/Databases:

1. Open the **root page** or **root database** in Notion
2. Click the **"..."** menu (top right)
3. Scroll down and click **"Add connections"**
4. Search for your integration name (e.g., "Workspace Mapper")
5. Click to add it

#### Automatic Child Access:

> **✨ Important:** When you add an integration to a root page, it **automatically gains access to all child pages and databases** under that page. You don't need to share each child individually.

**Example Structure:**
```
📄 My Root Page [Share integration here]
  ├── 📄 Child Page 1 [Automatically accessible]
  ├── 📄 Child Page 2 [Automatically accessible]
  ├── 🗄️ Database A [Automatically accessible]
  │   ├── Properties [Automatically accessible]
  │   └── Items [Automatically accessible]
  └── 🗄️ Database B [Automatically accessible]
```

#### For Multiple Root Items:

If your workspace has multiple root-level pages/databases you want to include:

1. Share the integration with **each root item**
2. All their children will be automatically included

### 3. Install Dependencies

```bash
npm install
```

### 4. Build the Project

```bash
npm run build
```

## 📖 Usage

### Web Interface (Recommended)

1. Start the web server:
```bash
node server.js
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Fill in the form:
   - **Workspace Name:** A friendly name for your workspace
   - **Notion API Key:** Your integration token (ntn_...)
   - **Output Formats:** Select desired formats (JSON, Markdown, CSV, Tree TXT, Numbered TXT, DOCX, PDF)
   - **Options:**
     - ☑️ Include database schema (properties and data sources)
     - ☐ Include database items (pages) in mapping
   - **API Version:** Choose 2025-09-03 (recommended) or 2022-06-28 (legacy)

4. Click **"Generate Mapping"**

5. Watch the progress:
   - ⟳ Connecting to Notion API...
   - ⟳ Fetching pages...
   - ⟳ Fetching databases...
   - ⟳ Generating mapping...

6. Download your generated files from the results section

### Command Line Interface

#### Interactive Mode:
```bash
npm start
```

The CLI will guide you through:
- Workspace name
- API token (secure input)
- Format selection
- Schema/items inclusion
- API version selection

#### Non-Interactive Mode:
```bash
npm start -- --non-interactive \
  --workspace-name "My Workspace" \
  --api-key "ntn_your_token_here" \
  --format all \
  --include-schema \
  --include-items \
  --api-version 2025-09-03 \
  --output ./output
```

#### Available Options:
- `--non-interactive` - Skip interactive prompts
- `--workspace-name <name>` - Name for your workspace
- `--api-key <key>` - Notion API token
- `--format <format>` - Output format: json, markdown, csv, tree, numbered-txt, docx, pdf, or all
- `--output <directory>` - Output directory (default: ./output)
- `--include-schema` - Include database schema (properties and data sources)
- `--include-items` - Include database items (pages)
- `--api-version <version>` - API version: 2022-06-28 or 2025-09-03 (default)
- `--test-connection` - Test API connection and exit

## 📁 Output Formats

### File Naming Convention

All files follow this pattern:
```
<WorkspaceName>_NWS_<YYYY-MM-DD>-<HH-MM-SS>.<extension>

Examples:
- MyWorkspace_NWS_2025-11-26-14-30-00.json
- MyWorkspace_NWS_tree_2025-11-26-14-30-00.txt
- MyWorkspace_NWS_numbered_2025-11-26-14-30-00.txt
- MyWorkspace_NWS_2025-11-26-14-30-00.docx
```

### Format Details

| Format | Extension | Description | Structure | Best For |
|--------|-----------|-------------|-----------|----------|
| **JSON** | `.json` | Raw structured data | Flat arrays | API integration, data processing |
| **Markdown** | `.md` | Hierarchical format with metadata | Progressive headings (# → ## → ###)<br/>• Pages/databases with metadata bullets<br/>• Properties as bullet list<br/>• "page", "database", "data source" suffixes | Documentation, GitHub wikis, human-readable hierarchy |
| **CSV** | `.csv` | Spreadsheet format | Flat tables | Excel, data analysis |
| **Tree TXT** | `_tree.txt` | Visual tree structure | ASCII tree with icons (📄 📁 🗄️) | Quick overview, ASCII visualization |
| **Numbered TXT** | `_numbered.txt` | Numbered hierarchy | Decimal notation (1.1.1.1) | Detailed navigation, printing |
| **DOCX** | `.docx` | Microsoft Word | Hierarchical with styled headings | Reports, formal documentation |
| **PDF** | `.pdf` | Portable document | Hierarchical with styled headings | Sharing, archiving |

## ⚙️ Configuration Options

### Include Database Schema
When enabled, captures:
- ✅ Database properties (name, type, options)
- ✅ Property configurations (select options, formulas, relations)
- ✅ Data sources and their schemas

When disabled:
- Shows database names and structure only
- Properties displayed as: **"Properties: not included"**

### Include Database Items
When enabled, captures:
- ✅ All pages that belong to databases
- ✅ Data source items
- ✅ Full database content

When disabled:
- Only workspace structure and databases
- No database item pages included

### API Version

#### 2025-09-03 (Recommended)
- ✅ Full data sources support
- ✅ Enhanced database schema
- ✅ Latest Notion features
- 🆕 Introduced data sources concept

#### 2022-06-28 (Legacy)
- ⚠️ Basic database support only
- ⚠️ No data sources
- 📦 For older integrations

## 🎨 Web UI Features

- **Modern Design** - Beautiful sage green/teal color scheme
- **Real-time Progress** - Watch each step complete
- **Automatic Scrolling** - Smooth scroll to progress section
- **Error Handling** - Clear, actionable error messages
- **Multi-format Support** - Generate multiple formats at once
- **Instant Download** - Download files immediately after generation

## 📝 Markdown Format Details

The Markdown format provides a hierarchical, human-readable representation of your workspace:

### Structure Example:
```markdown
# Root Page page
- **ID:** `abc-123`
- **URL:** https://notion.so/...
- **Created:** 20.11.2024, 14:12:00
- **Last Edited:** 18.11.2025, 10:29:00
- **Parent Type:** workspace

## Child Page page
- **ID:** `def-456`
- **URL:** https://notion.so/...
- **Parent Type:** page_id
- **Parent ID:** `abc-123`

### Some Database database
- **ID:** `ghi-789`
- **URL:** https://notion.so/...
- **Parent Type:** page_id

#### Database View data source
- **ID:** `jkl-012`
- **Created:** 08.05.2025, 13:33:00
- **Last Edited:** 09.10.2025, 12:47:00
- **Parent Type:** database_id
- **Parent ID:** `ghi-789`

##### Properties
- **Property Name:** prop-id-123, text, [], Property description
- **Status:** prop-id-456, status, [To Do, In Progress, Done]
- **Relation:** prop-id-789, relation, → Target Database (two-way, no limit)

##### Data source pages
###### Item Page 1 page
- **ID:** `mno-345`
- **URL:** https://notion.so/...
```

### Key Features:
- **Progressive Heading Levels:** Nested items use deeper heading levels (# → ## → ### → ####)
- **Type Suffixes:** All items clearly labeled as "page", "database", or "data source"
- **Metadata Bullets:** ID, URL, dates, and parent info as bullet points under each item
- **Property Details:** Properties shown as bullet list with ID, type, options, and description
- **Hierarchical Structure:** Matches the actual Notion workspace organization

## 🔧 Troubleshooting

### "API token is invalid"
- ✅ Check your token starts with `ntn_`
- ✅ Verify the integration is active at notion.so/my-integrations
- ✅ Ensure you copied the entire token

### "No pages/databases found"
- ✅ Share at least one root page/database with your integration
- ✅ Remember: Sharing a root page automatically shares all children
- ✅ Check the integration appears in the page's "Connections"

### "Properties: 0" in output
- ✅ Enable "Include database schema" option
- ✅ Ensure databases have properties defined
- ✅ Verify the integration can read database schemas

### Files not including database items
- ✅ Enable "Include database items (pages)" option
- ✅ Ensure databases contain items
- ✅ Check data sources have pages

## 📚 Examples

### Example 1: Full Workspace Documentation
```bash
npm start -- --non-interactive \
  --workspace-name "Company Wiki" \
  --api-key "ntn_xxx" \
  --format all \
  --include-schema \
  --include-items
```

### Example 2: Schema-Only Export
```bash
npm start -- --non-interactive \
  --workspace-name "Database Schemas" \
  --api-key "ntn_xxx" \
  --format json \
  --include-schema
```

### Example 3: Tree Structure Overview
```bash
npm start -- --non-interactive \
  --workspace-name "Project Structure" \
  --api-key "ntn_xxx" \
  --format tree
```

## 🔐 Security Notes

- **Never commit** your API token to version control
- **Use environment variables** for automation: `export NOTION_API_KEY="ntn_..."`
- **Rotate tokens** regularly at notion.so/my-integrations
- **Create separate integrations** for different purposes
- **Review integration access** periodically

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

See [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Notion API Documentation](https://developers.notion.com/)
- [Create Integration](https://www.notion.so/my-integrations)
- [GitHub Repository](https://github.com/AndrewNedoluzhko/notion-workspace-mapper)

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Review Notion's [API documentation](https://developers.notion.com/)
3. Open an issue on GitHub

---

**Version:** 1.0.0  
**Made with ❤️ for the Notion community**
