<div align="center">
  <img src="https://img.shields.io/badge/Status-Active-success.svg" alt="Status" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" />
</div>

<h1 align="center">testGen-AI</h1>

<p align="center">
  <strong>The open-source, local-first Test Case generator running natively on your machine.</strong>
</p>

## 🌟 Overview

**testGen-AI** is a lightning-fast, highly intuitive AI application modeled to flawlessly replicate the fluid and responsive ChatGPT interface. It empowers software Quality Assurance teams and project managers by automatically digesting standard product prompts—or Jira tickets—and instantly generating rigorously formatted test cases that align with enterprise industry standards.

Driven entirely by a **Local Large Language Model (LLM)** via Ollama, **testGen-AI** guarantees absolute privacy: zero proprietary code, trade secrets, or client data is ever transmitted out of your localized environment.

---

## ✨ Core Capabilities

### 🔒 100% Local & Secure Data Processing
Your data stays entirely invisible to the cloud. Utilizing localized models like `phi3:mini`, generations complete natively on your own hardware ensuring zero telemetry, zero subscription fees, and complete offline efficiency. 

### 🎨 Stunning, Fluid ChatGPT-Inspired Interface
Crafted with extreme attention to detail using TailwindCSS v4 and Framer Motion, it features a fluid, distraction-free environment:
* **Intuitive Side Navigation:** Familiar "New Chat" logic mapped securely against persistent memory threading. 
* **Dynamic Content Regeneration:** Seamlessly fetch alternative outputs from the Local LLM in-place without ruining your current chat flow thread.
* **Micro-Interactions:** From fluidly expanding input areas to custom scaled Jira modal overlays and conversational context switching.

### 📋 Enterprise-Grade Excel Exports
Engineered precisely for production pipelines. Outputs natively guard against typical LLM 'hallucinations', ensuring generated responses strictly output:
`ID -> Title -> Description -> Steps -> Expected Result -> Priority`
With one click, flawlessly parse entire suites directly into a standard `.xlsx` workbook—entirely skipping painful copy-pasting processes.

### 🔗 Deep Jira Integrations 
Tired of typing endless context? The dynamic native toolbar allows you to map your unique Atlassian domain, Jira email, and API Token securely inside local settings. Simply toggle the standard "Jira URL" mode, securely paste a complex ticket, and watch standard test cases stream out!

### 💡 RAG Feedback Telemetry
Testing frameworks require iterations. Integrated "RAG Helpful" components allow contextual local tagging of generated responses, dynamically enabling local iteration tracking natively within the web client.

---

## 🛠️ Architecture Stack

**testGen-AI** relies on a lightweight internal architecture stacked together strictly for velocity and responsiveness:

- **Frontend Environment**: Next.js 16 (App Router + Turbopack)
- **Typing Ecosystem**: TypeScript
- **Styling Architecture**: TailwindCSS v4 + Radix-UI Base
- **Animation Engine**: Framer Motion
- **Dataset Manipulation**: SheetJS (`xlsx`)
- **Intelligence Core**: Local Ollama Ecosystem (w/ dynamic multi-model fetching)
- **Session Layer**: Synchronized Browser `localStorage` History mapping

---

> _"Zero cloud bills, complete workflow isolation, rapid test engineering."_
