# TCGen-Buddy 🚀

<div align="center">

**The open-source AI-powered enterprise test case generator running locally on your machine.**

[![Status](https://img.shields.io/badge/Status-Active-success.svg)](https://github.com/yourusername/tcgen-buddy)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/Node-20%2B-green)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Playwright](https://img.shields.io/badge/Playwright-1.51-00d4ff?logo=playwright)](https://playwright.dev)

</div>

---

## 🎯 Overview

**TCGen-Buddy** is a lightning-fast, locally-first AI test case generator that replaces hours of manual QA work with intelligent automation. Powered by **local LLMs via Ollama**, it guarantees **100% data privacy**—your test cases, requirements, and Jira tickets never leave your machine.

Perfect for QA teams, automation engineers, and development teams seeking to accelerate test coverage while maintaining complete control over their data.

### Why TCGen-Buddy?

- 🔒 **Zero Cloud Dependency** — All processing happens locally; no data transmission
- ⚡ **Enterprise-Grade Quality** — Generates industry-standard test cases with proper structure
- 🎨 **Premium UI/UX** — ChatGPT-inspired interface with smooth animations and micro-interactions
- 🤖 **AI-Powered** — Leverages local LLMs (Ollama) for intelligent test generation
- 🔗 **Jira Integrated** — Create defects, link stories, and sync with your issue tracker
- 📊 **Multiple Export Formats** — Excel, CSV, JSON—ready for any workflow
- 🧪 **Built-in Automation** — Run Playwright test suites with live streaming output

---

## ✨ Core Features

### 🤖 Intelligent Test Case Generation

Generate comprehensive test cases from simple requirements:
- **Platform-Aware** — Web, Mobile, and API test scenarios
- **Test Type Coverage** — Functional, boundary, negative, and edge-case generation
- **Contextual AI** — Understands platform constraints and generates appropriate test cases
- **Quality Assurance** — Strict formatting prevents LLM hallucinations

```
Prompt: "User login with email validation"
    ↓
AI Analysis (Ollama)
    ↓
Generated: 5-10 professional test cases
    ↓
Export: Excel, CSV, or JSON format
```

### 🔒 100% Local & Secure Processing

Your data stays in your environment:
- Local LLM execution via **Ollama**
- **Zero cloud connectivity** required
- **No telemetry** or usage tracking
- Support for models: `mistral:7b`, `phi3:mini`, `neural-chat`, etc.

### 🎨 ChatGPT-Inspired Interface

Intuitive, fluid, distraction-free UI:
- **Persistent Chat History** — All sessions saved locally in browser storage
- **Smart Workspace Names** — Auto-generated from prompts
- **Dynamic Content Regeneration** — Fetch alternative outputs without disrupting flow
- **Responsive Design** — Works beautifully on desktop and tablet
- **Micro-animations** — Smooth transitions powered by Framer Motion

### 📋 Enterprise Export Options

Export test cases in multiple formats:

| Format | Best For | Features |
|--------|----------|----------|
| **Excel** (.xlsx) | Business stakeholders, test management tools | Professional formatting, multiple sheets |
| **CSV** (.csv) | Data analysis, CI/CD pipelines | Lightweight, universal compatibility |
| **JSON** (.json) | API integration, custom workflows | Nested structure support |

### 🔗 Deep Jira Integration

Seamlessly create and track issues:
- **Secure Credential Storage** — Save Jira API tokens locally
- **AI-Powered Defect Generation** — Let AI write professional bug reports
- **One-Click Issue Creation** — Convert test case failures to Jira tickets
- **Story Linking** — Associate test cases with user stories
- **Test Connection** — Verify Jira credentials before use

### 🧪 Playwright Automation

Built-in test execution and reporting:
- **Live Streaming Output** — Watch tests run in real-time
- **Suite Management** — Smoke, Sanity, and Regression test suites
- **HTML Reports** — Detailed test reports with screenshots
- **Automated Test Generation** — Generate Playwright scripts from test cases
- **Cross-Platform Support** — Web, API, and mobile test generation

### 📊 Real-Time Test Execution Dashboard

Monitor automation runs with:
- Live log streaming
- Test status badges
- Duration tracking
- One-click report viewing
- Failure details and error capture

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16, React 19 | App Router, Turbopack compilation |
| **Language** | TypeScript | Type safety and IDE support |
| **Styling** | TailwindCSS v4, Radix UI | Modern utility-first CSS, accessible components |
| **Animations** | Framer Motion | Smooth, performant UI transitions |
| **Testing** | Playwright 1.51 | Cross-browser automation |
| **AI Engine** | Ollama (Local LLM) | Privacy-first AI processing |
| **Exports** | SheetJS (XLSX) | Multi-format data export |
| **Icons** | Lucide React | Clean, consistent icon set |

</div>

---

## 📁 Project Structure

```
TCGen-Buddy/
├── app/
│   ├── api/
│   │   ├── automation/
│   │   │   ├── generate/          # Playwright script generation
│   │   │   └── run/               # Test execution with streaming
│   │   ├── generate/              # Test case generation
│   │   ├── health/                # Health check endpoint
│   │   ├── models/                # Ollama models list
│   │   └── jira/
│   │       ├── create-issue/      # Create Jira tickets
│   │       ├── generate-defect/   # AI defect generation
│   │       └── test-connection/   # Verify Jira credentials
│   ├── dashboard/                 # Automation dashboard
│   └── layout.tsx                 # Root layout
│
├── automation/                     # Playwright automation
│   ├── tests/
│   │   ├── smoke/
│   │   ├── sanity/
│   │   └── regression/
│   ├── pages/                     # Page object models
│   ├── fixtures/                  # Test fixtures
│   ├── data/                      # Test data (CSV)
│   └── playwright.config.ts       # Playwright configuration
│
├── src/
│   ├── modules/testcase-generator/
│   │   ├── components/
│   │   │   ├── MainApp.tsx        # Primary chat interface
│   │   │   ├── ChatMessage.tsx    # Message display
│   │   │   ├── TestCaseTable.tsx  # Results table
│   │   │   ├── JiraModal.tsx      # Jira integration UI
│   │   │   ├── InputBox.tsx       # Chat input
│   │   │   ├── AutomationDashboard.tsx
│   │   │   └── Sidebar.tsx        # History sidebar
│   │   ├── services/
│   │   │   └── index.ts           # API service layer
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript types
│   │   └── prompts/               # AI prompt templates
│   │
│   ├── services/
│   │   ├── jira/
│   │   │   └── jira.service.ts    # Jira API client
│   │   ├── export/
│   │   │   └── export.service.ts  # Multi-format export
│   │   └── ai/
│   │       └── ollama.service.ts  # Ollama integration
│   │
│   └── prompts/
│       ├── system.txt             # System prompts
│       ├── functional.txt         # Functional test prompts
│       ├── boundary.txt           # Boundary test prompts
│       ├── negative.txt           # Negative test prompts
│       └── [platforms]/           # Platform-specific prompts
│
├── components/ui/                 # UI components
├── public/
│   └── automation-reports/        # Test reports
├── .env.local                     # Environment variables
├── next.config.ts                 # Next.js config
├── tailwind.config.ts             # TailwindCSS config
├── tsconfig.json                  # TypeScript config
├── eslint.config.mjs              # ESLint rules
└── package.json                   # Dependencies

```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org))
- **Ollama** ([Download & Install](https://ollama.ai))
- A local Ollama model (e.g., `mistral:7b`)

### Step 1: Clone & Install

```bash
# Clone the repository
git clone https://github.com/yourusername/tcgen-buddy.git
cd tcgen-buddy

# Install dependencies
npm install

# Install Playwright browsers
npm run playwright:install
```

### Step 2: Setup Environment Variables

Create `.env.local` in the project root:

```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://127.0.0.1:11434

# Jira Integration (optional)
JIRA_BASE_URL=https://yourdomain.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-api-token-here
JIRA_PROJECT_KEY=TCGB
```

### Step 3: Start Ollama

In a separate terminal, pull and run a model:

```bash
# Pull a model (first time only)
ollama pull mistral:7b

# Run Ollama (serves on localhost:11434)
ollama serve
```

### Step 4: Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 Usage Guide

### 🎯 Generate Test Cases

1. **Start a Conversation**
   - Click "New Chat" or start typing in the main input area
   - Select your platform: **Web**, **Mobile**, or **API**

2. **Write Your Requirement**
   ```
   "Implement user login validation with email and password fields"
   ```

3. **Configure AI Model**
   - Choose your Ollama model from the dropdown
   - Add optional custom prompts or acceptance criteria

4. **Generate Test Cases**
   - Click "Generate" or press Enter
   - Watch as test cases stream in real-time

5. **Review & Export**
   - View test cases in the interactive table
   - Export as Excel, CSV, or JSON
   - Copy to clipboard for quick sharing

### 🔗 Integrate with Jira

1. **Configure Credentials**
   - Click "Settings" (gear icon)
   - Enter your Jira base URL, email, and API token
   - Click "Test Connection" to verify

2. **Create Jira Defect**
   - Generate test cases for a failing scenario
   - Click the **Jira** button on any test case
   - Choose "AI Defect Reporter" or "Quick Create"
   - Let AI generate a professional bug report or enter manually
   - Click "Create in Jira"

3. **Link to Stories**
   - Enter a Jira story ID (e.g., `TCGB-123`)
   - Generated test cases automatically reference the story

### 🧪 Run Automation Tests

1. **Navigate to Automation Dashboard**
   - View live automation status in the right panel
   - Or visit [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

2. **Execute a Test Suite**
   - Click "Run Tests" on Smoke, Sanity, or Regression
   - Watch live output stream to the terminal
   - Reports auto-generate in `/public/automation-reports/{suite}/index.html`

3. **View Test Report**
   - Click "View Report" button after execution completes
   - Detailed HTML report with failure details and screenshots

### 📊 Generate Playwright Scripts

1. From test cases results table
2. Click "Playwright" button
3. Review generated Playwright code
4. Download and integrate into your test suite

---

## 🔌 API Reference

### Test Case Generation

```http
POST /api/generate
Content-Type: application/json

{
  "prompt": "User login with email validation",
  "model": "mistral:7b",
  "testType": "functional",
  "platform": "web",
  "customPrompt": "Focus on error messages",
  "acceptanceCriteria": "Must validate RFC 5322 email format"
}
```

**Response:**
```json
{
  "testCases": [
    {
      "testCaseId": "TC-001",
      "title": "Verify valid email login",
      "testType": "Functional",
      "priority": "High",
      "preconditions": "User not logged in",
      "steps": "1. Navigate to login\n2. Enter valid email...",
      "expectedResult": "User authenticated successfully",
      "testData": "email: test@example.com"
    }
  ]
}
```

### Automation Execution (Streaming)

```http
POST /api/automation/run
Content-Type: application/json

{ "suite": "smoke" }
```

**Response:** Streaming plain text output with final JSON summary
```
Running smoke tests...
[PASS] Login test
[PASS] Navigation test
__DONE__:{"success":true,"suite":"smoke","durationMs":45000,"reportUrl":"/automation-reports/smoke/index.html"}
```

### Jira Integration

#### Create Issue
```http
POST /api/jira/create-issue
{
  "summary": "Bug: Login fails with special characters",
  "description": "Steps to reproduce...",
  "issueType": "Bug",
  "priority": "High"
}
```

#### Generate AI Defect
```http
POST /api/jira/generate-defect
{
  "testCaseTitle": "Login validation",
  "testCaseSteps": "1. Enter email\n2. Submit",
  "expectedResult": "Success",
  "actualResult": "500 error",
  "model": "mistral:7b"
}
```

#### Test Connection
```http
GET /api/jira/test-connection
```

---

## 🤖 AI Model Configuration

### Supported Models

| Model | Size | Speed | Quality | Recommended For |
|-------|------|-------|---------|-----------------|
| mistral:7b | 4.4GB | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | Production (recommended) |
| phi3:mini | 2.3GB | ⚡⚡⚡⚡ | ⭐⭐⭐⭐ | Fast iteration |
| neural-chat:7b | 4.7GB | ⚡⚡ | ⭐⭐⭐⭐ | Quality-focused |

### Using Different Models

```bash
# Pull a model
ollama pull neural-chat:7b

# Serve it
ollama serve

# Select in TCGen-Buddy UI (Settings)
```

### Custom Prompts

Enhance generation with custom instructions:

```
Custom Prompt:
"Generate boundary value test cases focusing on 
minimum and maximum input lengths. Include international 
character validation."
```

---

## 🧪 Playwright Automation

### Test Structure

```typescript
// automation/tests/smoke/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

test.describe('Smoke - Login', () => {
  test('should login successfully', async ({ page }) => {
    const login = new LoginPage(page);
    await login.navigate();
    await login.fillEmail('test@example.com');
    await login.fillPassword('password123');
    await login.submit();
    await expect(page).toHaveURL('/dashboard');
  });
});
```

### Run Tests

```bash
# All tests
npm run test:automation

# Specific suite
npm run test:automation:smoke
npm run test:automation:sanity
npm run test:automation:regression

# Watch mode
npx playwright test --watch
```

### View Reports

```bash
# Open HTML report
npx playwright show-report
```

---

## 📊 Feature Comparison

| Feature | TCGen-Buddy | Traditional Tools |
|---------|-------------|-------------------|
| **Local Processing** | ✅ 100% Local | ⚠️ Requires cloud |
| **Privacy** | ✅ Zero data transmission | ❌ Cloud storage |
| **Cost** | ✅ Free (open-source) | ❌ Subscription-based |
| **Setup Time** | ✅ < 5 minutes | ❌ Hours of config |
| **AI Quality** | ✅ Enterprise-grade | ⚠️ Variable |
| **Jira Integration** | ✅ Built-in | ⚠️ Limited |
| **Test Export** | ✅ 3+ formats | ⚠️ 1-2 formats |
| **Automation** | ✅ Integrated | ❌ Separate tool |

---

## 🔒 Security & Privacy

### Data Protection

- **Zero Cloud Connectivity** — All data stays on your machine
- **No Telemetry** — No usage tracking or analytics
- **Local Storage Only** — Browser `localStorage` for session persistence
- **API Token Safety** — Credentials never exposed in requests
- **Open Source** — Audit-friendly, community-reviewed code

### API Security

- Basic Auth for Jira (email:token base64 encoding)
- CORS-protected API endpoints
- Environment variable isolation
- No logging of sensitive data

---

## 🚀 Performance & Scalability

### Benchmarks

- **Test Case Generation:** ~3-8 seconds per prompt
- **Excel Export:** < 1 second for 50 test cases
- **Jira Issue Creation:** ~1-2 seconds
- **Automation Suite:** Smoke (2-3 min), Sanity (5-10 min), Regression (15-30 min)

### Optimization Tips

- Use smaller models (`phi3:mini`) for faster iteration
- Run Ollama on dedicated GPU for 3-5x speedup
- Keep browser `localStorage` clean (clear old sessions)
- Use Playwright's `--workers` flag for parallel test execution

---

## 📝 Example Workflows

### Workflow 1: Generate Tests from Requirements

```
Requirements → Prompt → AI Generation → Review → Export to Excel → Import to TMS
```

### Workflow 2: Bug Report Automation

```
Failed Test → Capture Details → AI Defect Gen → Auto-create Jira → Assign to Team
```

### Workflow 3: Continuous Testing

```
Codebase Update → Regenerate Tests → Run Automation → Generate Report → Archive
```

---

## 🛣️ Roadmap

### Current (v0.1.0)
- ✅ AI test case generation
- ✅ Jira integration
- ✅ Playwright automation
- ✅ Multi-format export

### Planned (v0.2.0)
- 🚧 Batch generation (upload CSV requirements)
- 🚧 RAG-enhanced generation
- 🚧 GitHub Actions integration
- 🚧 Test quality scoring

### Future (v0.3.0+)
- 📋 Docker containerization
- 📋 Multi-user collaboration
- 📋 Advanced analytics dashboard
- 📋 API-first architecture
- 📋 Mobile app (React Native)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Setup

```bash
# Install dev dependencies
npm install

# Run dev server
npm run dev

# Run linter
npm run lint

# Run tests
npm run test:automation
```

### Code Style

- TypeScript strict mode enabled
- ESLint configuration enforced
- TailwindCSS utility-first approach
- Component-driven architecture

---

## ❓ FAQ

<details>
<summary><strong>Q: Do I need internet access?</strong></summary>

A: No. After initial setup and model download, TCGen-Buddy runs completely offline. All processing happens locally.

</details>

<details>
<summary><strong>Q: What if Ollama isn't installed?</strong></summary>

A: Visit [ollama.ai](https://ollama.ai) to download and install. It's available for Windows, macOS, and Linux.

</details>

<details>
<summary><strong>Q: Can I use multiple models?</strong></summary>

A: Yes. Install multiple models with `ollama pull <model>` and switch between them in the UI.

</details>

<details>
<summary><strong>Q: How much disk space is needed?</strong></summary>

A: Depends on model size. Mistral (4.4GB) + Node deps (500MB) ≈ 5GB total.

</details>

<details>
<summary><strong>Q: Is Jira integration required?</strong></summary>

A: No. All features work without Jira. Configure it only if you want to auto-create tickets.

</details>

<details>
<summary><strong>Q: Can I use this in CI/CD?</strong></summary>

A: Yes. Use the API endpoints to integrate TCGen-Buddy into GitHub Actions, GitLab CI, or Jenkins pipelines.

</details>

---

## 🐛 Known Limitations

- Ollama models have smaller context windows (2K-8K tokens) than cloud LLMs
- No multi-user collaboration (single-machine setup)
- Mobile app not available (PWA limited functionality)
- Jira Cloud only (Jira Server EOL)
- No GPU acceleration auto-detection

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) file for details.

---

## 🙏 Credits & Acknowledgments

- **Ollama** — Local LLM engine ([ollama.ai](https://ollama.ai))
- **Next.js** — React framework ([nextjs.org](https://nextjs.org))
- **Playwright** — Automation testing ([playwright.dev](https://playwright.dev))
- **TailwindCSS** — Utility-first CSS ([tailwindcss.com](https://tailwindcss.com))
- **Radix UI** — Accessible components ([radix-ui.com](https://radix-ui.com))
- **Framer Motion** — Animation library ([framer.com](https://framer.com))

---

## 📞 Support & Community

- **Email** — suneel.barigala@gmail.com

---

<div align="center">

**Made with ❤️ for QA teams everywhere.**

[⭐ Star us on GitHub](https://github.com/yourusername/tcgen-buddy) • [📖 Read the Docs](docs/) • [🐛 Report an Issue](https://github.com/yourusername/tcgen-buddy/issues)

</div>
