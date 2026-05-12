<p align="center">
  <br>
  <img width="80" src="https://cdn.rawgit.com/sindresorhus/awesome/d7305f38d29fed78fa85652e3a63e154dd8e8829/media/badge.svg" alt="Awesome">
  <br>
</p>

<h1 align="center">Codex Plugin & Connector Marketplace</h1>

<p align="center">A comprehensive, curated marketplace of plugins, MCP servers, connectors, and integrations for Codex AI agents</p>

<p align="center">
  <a href="http://makeapullrequest.com"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License"></a>
</p>

<p align="center">
  This marketplace provides access to the maximum possible range of AI connectors, tools, and integrations across 50+ categories, enabling Codex agents to interact with virtually any service, API, or data source.
</p>

<br>

## 📑 Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Legend](#legend)
- [Categories](#categories)
  - [🔗 Aggregators & Meta-Servers](#aggregators--meta-servers)
  - [🚀 Aerospace & Astrodynamics](#aerospace--astrodynamics)
  - [🎨 Art & Culture](#art--culture)
  - [📐 Architecture & Design](#architecture--design)
  - [🧬 Biology, Medicine & Bioinformatics](#biology-medicine--bioinformatics)
  - [📂 Browser Automation](#browser-automation)
  - [☁️ Cloud Platforms](#cloud-platforms)
  - [👨‍💻 Code Execution](#code-execution)
  - [🤖 Coding Agents](#coding-agents)
  - [🖥️ Command Line](#command-line)
  - [💬 Communication](#communication)
  - [🗣️ Conversational AI](#conversational-ai)
  - [👤 Customer Data Platforms](#customer-data-platforms)
  - [🗄️ Databases](#databases)
  - [📊 Data Platforms](#data-platforms)
  - [🚚 Delivery](#delivery)
  - [🛠️ Developer Tools](#developer-tools)
  - [🧮 Data Science Tools](#data-science-tools)
  - [📊 Data Visualization](#data-visualization)
  - [📟 Embedded Systems](#embedded-systems)
  - [🎓 Education](#education)
  - [🛒 E-Commerce](#e-commerce)
  - [🌳 Environment & Nature](#environment--nature)
  - [📂 File Systems](#file-systems)
  - [💰 Finance & Fintech](#finance--fintech)
  - [🎮 Gaming](#gaming)
  - [🏠 Home Automation](#home-automation)
  - [🧠 Knowledge & Memory](#knowledge--memory)
  - [⚖️ Legal](#legal)
  - [🗺️ Location Services](#location-services)
  - [🎯 Marketing](#marketing)
  - [📊 Monitoring](#monitoring)
  - [🎥 Multimedia Processing](#multimedia-processing)
  - [🖥️ OS Automation](#os-automation)
  - [📋 Product Management](#product-management)
  - [🏠 Real Estate](#real-estate)
  - [🔬 Research](#research)
  - [🔎 Search & Data Extraction](#search--data-extraction)
  - [🔒 Security](#security)
  - [🌐 Social Media](#social-media)
  - [🏃 Sports](#sports)
  - [🎧 Support & Service Management](#support--service-management)
  - [🌎 Translation Services](#translation-services)
  - [🎧 Text-to-Speech](#text-to-speech)
  - [🚆 Travel & Transportation](#travel--transportation)
  - [🔄 Version Control](#version-control)
  - [🏢 Workplace & Productivity](#workplace--productivity)
  - [🛠️ Other Tools & Integrations](#other-tools--integrations)
- [Installation](#installation)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

This marketplace is inspired by [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) and [awesome-codex-plugins](https://github.com/hashgraph-online/awesome-codex-plugins), bringing together the most comprehensive collection of Codex connectors available.

### What's Inside?

- **2,500+ Connectors**: Access to MCP servers, plugins, and API integrations
- **50+ Categories**: Organized by use case and industry
- **Multiple Protocols**: MCP, REST APIs, WebSocket, SSE, and more
- **Universal Compatibility**: Works with Codex CLI, Desktop App, and IDE extensions
- **Payment Options**: Free, API key-based, OAuth, and micropayment (x402/L402) enabled services

---

## Quick Start

### Using this Marketplace in Codex

**CLI Installation:**
```bash
# Add this repo as a marketplace source
codex plugin marketplace add \
  "https://raw.githubusercontent.com/primustrash/Copilot/main/marketplace.json"

# Browse available plugins
codex plugin list --source Copilot

# Install a specific connector
codex plugin install <connector-name> --source Copilot
```

**Desktop App / IDE Extension:**
1. Open Codex settings → Plugins → Marketplace Sources
2. Add this repository URL:
   ```
   https://raw.githubusercontent.com/primustrash/Copilot/main/marketplace.json
   ```
3. Browse and install connectors from the curated list

### MCP Server Configuration

Add MCP servers to your `mcp-config.json` or Claude Desktop configuration:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "package-name"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

---

## Legend

### Programming Languages
- 🎖️ – Official implementation
- 🐍 – Python
- 📇 – TypeScript/JavaScript
- 🏎️ – Go
- 🦀 – Rust
- #️⃣ – C#
- ☕ – Java
- 🌊 – C/C++
- 💎 – Ruby
- 🐘 – PHP

### Scope
- ☁️ – Cloud Service (remote APIs)
- 🏠 – Local Service (runs on your machine)
- 📟 – Embedded Systems

### Operating Systems
- 🍎 – macOS
- 🪟 – Windows
- 🐧 – Linux

### Payment Models
- 🆓 – Free/Open Source
- 🔑 – API Key Required
- 🔐 – OAuth Authentication
- 💳 – Paid/Subscription
- ⚡ – Micropayments (x402/L402)

---

## Categories

### 🔗 Aggregators & Meta-Servers

Servers that aggregate multiple MCP servers, provide unified access to many tools, or enable discovery of other servers.

#### Meta-MCP Servers
- **[1mcp/agent](https://github.com/1mcp-app/agent)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  Unified MCP server aggregating multiple servers into one interface

- **[metatool-ai/metatool-app](https://github.com/metatool-ai/metatool-app)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  MetaMCP middleware server managing MCP connections with GUI

- **[MikkoParkkola/mcp-gateway](https://github.com/MikkoParkkola/mcp-gateway)** 🏎️ 🏠 🍎 🪟 🐧 🆓
  Universal MCP gateway with single-port multiplexing and Meta-MCP. 42 starter capabilities with zero-config

- **[ViperJuice/mcp-gateway](https://github.com/ViperJuice/mcp-gateway)** 🐍 🏠 🍎 🪟 🐧 🆓
  Meta-server for minimal tool bloat with progressive disclosure and dynamic server provisioning

- **[sitbon/magg](https://github.com/sitbon/magg)** 🐍 ☁️ 🏠 🍎 🪟 🐧 🆓
  Universal hub allowing LLMs to autonomously discover, install, and orchestrate MCP servers

- **[portel-dev/ncp](https://github.com/portel-dev/ncp)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  NCP orchestrates entire MCP ecosystem through intelligent discovery

- **[tigranbs/mcgravity](https://github.com/tigranbs/mcgravity)** 📇 🏠 🆓
  Proxy tool composing multiple MCP servers into unified endpoint with load balancing

#### Discovery & Registry Servers
- **[tadas-github/a2asearch-mcp](https://github.com/tadas-github/a2asearch-mcp)** 📇 ☁️ 🆓
  Search 4,800+ MCP servers, AI agents, CLI tools. Install: `npx -y a2asearch-mcp`

- **[x402-index/x402search-mcp](https://github.com/x402-index/x402search-mcp)** 📇 ☁️ 🍎 🪟 🐧 ⚡
  Search 14,000+ x402-enabled HTTP APIs. Pay $0.01 USDC per search via micropayments

- **[entire-vc/evc-spark-mcp](https://github.com/entire-vc/evc-spark-mcp)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  Discover AI agents, skills, prompts from curated catalog of 4500+ assets

- **[AgentHotspot/agenthotspot-mcp](https://github.com/AgentHotspot/agenthotspot-mcp)** 🐍 ☁️ 🏠 🍎 🪟 🐧 🆓
  Search, integrate and monetize MCP connectors on AgentHotspot marketplace

- **[glenngillen/mcpmcp-server](https://github.com/glenngillen/mcpmcp-server)** 📇 ☁️ 🍎 🪟 🐧 🆓
  List of MCP servers to discover which servers can improve your workflow

- **[duaraghav8/MCPJungle](https://github.com/duaraghav8/MCPJungle)** 🏎️ 🏠 🆓
  Self-hosted MCP Server registry for enterprise AI Agents

- **[particlefuture/MCPDiscovery](https://github.com/particlefuture/1mcpserver)** 🐍 ☁️ 🏠 🍎 🪟 🆓
  MCP of MCPs - Automatic discovery and configuration of local MCP servers

#### API & Service Aggregators
- **[Work90210/APIFold](https://github.com/Work90210/APIFold)** 📇 ☁️ 🆓
  Turn any REST API into hosted MCP server. 18 free public servers included

- **[PipedreamHQ/pipedream](https://github.com/PipedreamHQ/pipedream)** 📇 ☁️ 🏠 🆓
  Connect 2,500 APIs with 8,000+ prebuilt tools

- **[codeislaw101/katzilla](https://github.com/codeislaw101/katzilla)** 📇 ☁️ 🍎 🪟 🐧 🆓
  Unified data API - 300+ free public and government data sources. `npx @katzilla/mcp`

- **[whiteknightonhorse/APIbase](https://github.com/whiteknightonhorse/APIbase)** 📇 ☁️ ⚡
  Unified API hub with 56+ tools across travel, prediction markets, crypto. x402 micropayments

- **[alexanderclapp/clirank-mcp-server](https://github.com/alexanderclapp/clirank-mcp-server)** 📇 ☁️ 🍎 🪟 🐧 🆓
  API intelligence for AI agents. 387 APIs scored on agent-friendliness

- **[profullstack/mcp-server](https://github.com/profullstack/mcp-server)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  Comprehensive MCP server aggregating 20+ developer utilities

- **[malamutemayhem/unclick-agent-native-endpoints](https://github.com/malamutemayhem/unclick-agent-native-endpoints)** 📇 🏠 🍎 🪟 🐧 🆓
  110+ tools for AI agents spanning social media, finance, gaming. Zero-config

- **[sxhxliang/mcp-access-point](https://github.com/sxhxliang/mcp-access-point)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  Turn web service into MCP server in one click without code changes

#### Multi-Model & AI Service Aggregators
- **[blockrunai/blockrun-mcp](https://github.com/blockrunai/blockrun-mcp)** 📇 ☁️ 🍎 🪟 🐧 ⚡
  Access 30+ AI models without API keys. Pay-per-use via x402 micropayments

- **[gpu-bridge/mcp-server](https://github.com/gpu-bridge/mcp-server)** 📇 ☁️ 🍎 🪟 🐧 ⚡
  Unified GPU inference API with 30 AI services. Pay-per-use via x402

- **[juspay/neurolink](https://github.com/juspay/neurolink)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  Unifying 12 providers and 100+ models with multi-agent orchestration

- **[jaspertvdm/mcp-server-gemini-bridge](https://github.com/jaspertvdm/mcp-server-gemini-bridge)** 🐍 ☁️ 🔑
  Bridge to Google Gemini API

- **[jaspertvdm/mcp-server-ollama-bridge](https://github.com/jaspertvdm/mcp-server-ollama-bridge)** 🐍 🏠 🆓
  Bridge to local Ollama LLM server

- **[jaspertvdm/mcp-server-openai-bridge](https://github.com/jaspertvdm/mcp-server-openai-bridge)** 🐍 ☁️ 🔑
  Bridge to OpenAI API

- **[arikusi/deepseek-mcp-server](https://github.com/arikusi/deepseek-mcp-server)** 📇 ☁️ 🍎 🪟 🐧 🔑
  MCP server for DeepSeek AI with reasoning, function calling, thinking mode

- **[merterbak/Grok-MCP](https://github.com/merterbak/Grok-MCP)** 🐍 ☁️ 🍎 🪟 🐧 🔑
  MCP server for xAI's Grok API with tool calling, image generation, vision

#### Agent Marketplaces & Networks
- **[elisymlabs/elisym](https://github.com/elisymlabs/elisym)** 📇 ☁️ 🍎 🪟 🐧 💳
  AI agent discovery and marketplace on Nostr with Solana payments

- **[rhein1/agoragentic-integrations](https://github.com/rhein1/agoragentic-integrations)** 📇 ☁️ 💳
  Agent-to-agent marketplace - AI agents discover and pay for services using USDC

- **[edgarriba/prolink](https://github.com/edgarriba/prolink)** 🐍 ☁️ 🏠 🍎 🪟 🐧 🆓
  Agent-to-agent marketplace middleware - MCP-native discovery and negotiation

- **[oxgeneral/agentnet](https://github.com/oxgeneral/agentnet)** 🐍 ☁️ 🍎 🪟 🐧 🆓
  Agent-to-agent referral network with trust model and credit economy

- **[espadaw/Agent47](https://github.com/espadaw/Agent47)** 📇 ☁️ 🆓
  Unified job aggregator for AI agents across 9+ platforms

- **[doggychip/agentforge](https://github.com/doggychip/agentforge)** 📇 ☁️ 🆓
  Unified API gateway and marketplace for 300+ AI agents

- **[Aganium/agenium](https://github.com/Aganium/agenium)** 📇 ☁️ 🍎 🪟 🐧 🆓
  Bridge any MCP server to agent:// network with DNS-like identity and discovery

- **[hashgraph-online/hashnet-mcp-js](https://github.com/hashgraph-online/hashnet-mcp-js)** 📇 ☁️ 🍎 🪟 🐧 🆓
  Registry Broker for Hashgraph network - discover and chat with AI agents

#### Intelligence & Analytics Aggregators
- **[8randonpickart5/alderpost-mcp](https://github.com/8randonpickart5/alderpost-mcp)** 📇 ☁️ ⚡
  8 bundled intelligence endpoints (security, company, threat, sales, etc.) via x402 micropayments

- **[RipperMercs/tensorfeed](https://github.com/RipperMercs/tensorfeed)** 📇 ☁️ ⚡
  Real-time AI industry intelligence. 6 free tools + 13 premium. Pay-per-call in USDC

- **[robhunter/agentdeals](https://github.com/robhunter/agentdeals)** 📇 ☁️ 🆓
  1,500+ developer infrastructure deals and startup programs across 54 categories

- **[MastadoonPrime/sylex-search](https://github.com/MastadoonPrime/sylex-search)** 🐍 📇 ☁️ 🍎 🪟 🐧 🆓
  Universal search engine for discovering products, services, and businesses

#### Specialized Aggregators
- **[julien040/anyquery](https://github.com/julien040/anyquery)** 🏎️ 🏠 ☁️ 🆓
  Query 40+ apps with SQL - local-first and private

- **[Data-Everything/mcp-server-templates](https://github.com/Data-Everything/mcp-server-templates)** 📇 🏠 🍎 🪟 🐧 🆓
  Unified MCP platform connecting many apps and services

- **[wegotdocs/open-mcp](https://github.com/wegotdocs/open-mcp)** 📇 🏠 🍎 🪟 🐧 🆓
  Turn web API into MCP server in 10 seconds - open source registry at open-mcp.org

- **[WayStation-ai/mcp](https://github.com/waystation-ai/mcp)** ☁️ 🍎 🪟 🔐
  Securely connect Claude Desktop to Notion, Slack, Monday, Airtable in 90 seconds

- **[thinkchainai/mcpbundles](https://github.com/thinkchainai/mcpbundles)** 📇 ☁️ 🔐
  Create custom tool bundles with OAuth or API keys - one MCP server for thousands of integrations

- **[opentabs-dev/opentabs](https://github.com/opentabs-dev/opentabs)** 📇 🏠 🍎 🪟 🐧 🆓
  100+ plugins giving AI agents access to web apps through authenticated browser sessions

- **[TheLunarCompany/lunar#mcpx](https://github.com/TheLunarCompany/lunar)** 📇 🏠 ☁️ 🍎 🪟 🐧 🆓
  Production-ready gateway managing MCP servers at scale

- **[VeriTeknik/pluggedin-mcp-proxy](https://github.com/VeriTeknik/pluggedin-mcp-proxy)** 📇 🏠 🆓
  Comprehensive proxy combining multiple MCP servers with debugging playground

#### Discovery & Routing Intelligence
- **[supertrained/rhumb](https://github.com/supertrained/rhumb)** 📇 ☁️ 🍎 🪟 🐧 ⚡
  Agent-native tool intelligence - 1,000+ scored services with 21 MCP tools

- **[toadlyBroodle/satring](https://github.com/toadlyBroodle/satring)** 🐍 ☁️ 🍎 🪟 🐧 🆓
  Curated Lightning and USDC API directory

- **[rplryan/x402-discovery-mcp](https://github.com/rplryan/x402-discovery-mcp)** 🐍 ☁️ ⚡
  Runtime discovery layer for x402-payable APIs with quality ranking

- **[khalidsaidi/ragmap](https://github.com/khalidsaidi/ragmap)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  RAG-focused registry to discover retrieval-capable MCP servers

- **[isaac-levine/forage](https://github.com/isaac-levine/forage)** 📇 🏠 🍎 🪟 🐧 🆓
  Self-improving tool discovery - searches registries and installs MCP servers as subprocesses

#### Multi-Agent & Orchestration
- **[Jovancoding/Network-AI](https://github.com/Jovancoding/Network-AI)** 📇 🏠 🍎 🪟 🐧 🆓
  Multi-agent orchestration with shared blackboard. 20+ MCP tools

- **[ariekogan/ateam-mcp](https://github.com/ariekogan/ateam-mcp)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  Build multi-agent AI solutions on ADAS platform

- **[askbudi/roundtable](https://github.com/askbudi/roundtable)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  Unifies multiple AI coding assistants through intelligent auto-discovery

- **[ikoskela/wisepanel-mcp](https://github.com/ikoskela/wisepanel-mcp)** 📇 ☁️ 🍎 🪟 🐧 🆓
  Multi-agent deliberation across ChatGPT, Claude, Gemini, and Perplexity

#### Knowledge & Graph Aggregators
- **[gzoonet/cortex](https://github.com/gzoonet/cortex)** 📇 🏠 🆓
  Local-first knowledge graph for developers with 4 MCP tools

- **[depwire/depwire](https://github.com/depwire/depwire)** 📇 🐍 🏎️ 🦀 🌊 🏠 🆓
  Dependency graph + 15 MCP tools for AI coding assistants

- **[K-Dense-AI/claude-skills-mcp](https://github.com/K-Dense-AI/claude-skills-mcp)** 🐍 ☁️ 🏠 🍎 🪟 🐧 🆓
  Intelligent search for Claude Agent Skills

#### Platform-Specific Aggregators
- **[mindsdb/mindsdb](https://github.com/mindsdb/mindsdb)** 🐍 ☁️ 🏠 🆓
  Connect and unify data across platforms via single MCP server

- **[YangLiangwei/PersonalizationMCP](https://github.com/YangLiangwei/PersonalizationMCP)** 🐍 ☁️ 🏠 🍎 🪟 🐧 🔐
  Personal data aggregation with Steam, YouTube, Spotify, Reddit. 90+ tools

- **[carlosahumada89/govrider-mcp-server](https://github.com/carlosahumada89/govrider-mcp-server)** 📇 ☁️ 🆓
  Match tech products to government tenders, RFPs, grants from 25+ sources

- **[sonnyflylock/voxie-ai-directory-mcp](https://github.com/sonnyflylock/voxie-ai-directory-mcp)** 📇 ☁️ 🆓
  AI Phone Number Directory providing webchat access to AI services

#### Proxy & Gateway Solutions
- **[rupinder2/mcp-orchestrator](https://github.com/rupinder2/mcp-orchestrator)** 🐍 🏠 🍎 🪟 🐧 🆓
  Central hub aggregating tools from multiple MCP servers with unified search

- **[smart-mcp-proxy/mcpproxy-go](https://github.com/smart-mcp-proxy/mcpproxy-go)** 🏎️ 🏠 🍎 🪟 🐧 🆓
  Local MCP proxy with BM25 filtering, quarantine security, web UI

#### Universal Toolkits
- **[Markgatcha/universal-mcp-toolkit](https://github.com/Markgatcha/universal-mcp-toolkit)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  Universal MCP aggregator toolkit with ready-made templates and zero-config installation

---

### 🚀 Aerospace & Astrodynamics

Space, astronomy, satellite, and aerospace engineering tools.

- **[gregario/astronomy-oracle](https://github.com/gregario/astronomy-oracle)** 📇 🏠 🍎 🪟 🐧 🆓
  Astronomical catalog data and observing session planner. 13,000+ deep-sky objects. `npx astronomy-oracle`

- **[IO-Aerospace-software-community/mcp-server](https://github.com/IO-Aerospace-software-engineering/mcp-server)** #️⃣ ☁️ 🏠 🐧 🆓
  .NET-based MCP for aerospace & astrodynamics - ephemeris, orbital conversions, DSS tools

---

### 🎨 Art & Culture

Art collections, museums, music, cultural heritage, creative tools, and digital art generation.

#### Image Generation & Editing
- **[AceDataCloud/MCPFlux](https://github.com/AceDataCloud/FluxMCP)** 🐍 ☁️ 🔑
  Flux AI image generation (Black Forest Labs) via Ace Data Cloud

- **[AceDataCloud/MCPNanoBanana](https://github.com/AceDataCloud/MCPNanoBanana)** 🐍 ☁️ 🔑
  NanoBanana AI with virtual try-on and product placement

- **[AceDataCloud/MCPSeedream](https://github.com/AceDataCloud/SeedreamMCP)** 🐍 ☁️ 🔑
  ByteDance Seedream image generation

- **[SureScaleAI/openai-gpt-image-mcp](https://github.com/SureScaleAI/openai-gpt-image-mcp)** 📇 ☁️ 🔑
  OpenAI GPT image generation/editing

- **[hamflx/imagen3-mcp](https://github.com/hamflx/imagen3-mcp)** 📇 🏠 🪟 🍎 🐧 🔑
  Google's Imagen 3.0 API for high-quality image generation

- **[attalla1/photopea-mcp-server](https://github.com/attalla1/photopea-mcp-server)** 📇 🏠 🍎 🪟 🐧 🆓
  AI-powered image editing through Photopea with 34 tools. `npx photopea-mcp-server`

#### SVG & Vector Graphics
- **[albertnahas/icogenie-mcp](https://github.com/albertnahas/icogenie-mcp)** 📇 ☁️ 🔑
  AI-powered SVG icon generation from text

- **[arikusi/nakkas](https://github.com/arikusi/nakkas)** 📇 🏠 🍎 🪟 🐧 🆓
  Turn AI into SVG artist with animations, filters, gradients. `npx nakkas`

#### 3D, CAD & Animation
- **[ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)** 🐍 🏠 🆓
  MCP server for Blender 3D modeling

- **[asmith26/jupytercad-mcp](https://github.com/asmith26/jupytercad-mcp)** 🐍 🏠 🍎 🪟 🐧 🆓
  Control JupyterCAD using natural language

- **[abhiemj/manim-mcp-server](https://github.com/abhiemj/manim-mcp-server)** 🐍 🏠 🪟 🐧 🆓
  Generate animations using Manim

#### Video & Multimedia
- **[burningion/video-editing-mcp](https://github.com/burningion/video-editing-mcp)** 🐍 🏠 🆓
  Add, analyze, search, and generate video edits

#### Museums & Cultural Collections
- **[cfpramod/open-museum-mcp](https://github.com/cfpramod/open-museum-mcp)** 📇 ☁️ 🍎 🪟 🐧 🆓
  Federated search across The Met, Cleveland, AIC, Wikimedia Commons, Europeana. CC0/Public Domain only. `npx -y open-museum-mcp`

- **[8enSmith/mcp-open-library](https://github.com/8enSmith/mcp-open-library)** 📇 ☁️ 🆓
  Open Library API for book information search

#### Music & Audio
- **[Cifero74/mcp-apple-music](https://github.com/Cifero74/mcp-apple-music)** 🐍 🏠 🍎 🔐
  Full Apple Music integration - search, playlists, recommendations

- **[austenstone/myinstants-mcp](https://github.com/austenstone/myinstants-mcp)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  Soundboard with millions of meme sounds. `npx myinstants-mcp`

#### Cultural & Traditional Content
- **[aliafsahnoudeh/shahnameh-mcp-server](https://github.com/aliafsahnoudeh/shahnameh-mcp-server)** 🐍 🏠 🍎 🪟 🐧 🆓
  Access Shahnameh Persian epic poem

- **[cantian-ai/bazi-mcp](https://github.com/cantian-ai/bazi-mcp)** 📇 🏠 ☁️ 🍎 🪟 🆓
  Chinese Astrology (Bazi) charting and analysis

#### Creative AI Studio Tools
- **[codex-curator/studiomcphub](https://github.com/codex-curator/studiomcphub)** 🐍 ☁️ ⚡
  32 creative AI tools (18 free) - SD 3.5, ESRGAN upscaling, background removal, vectorization, NFT minting, museum artworks

---

### 📐 Architecture & Design

CAD, design tools, architecture planning, and technical drawing.

- **[asmith26/jupytercad-mcp](https://github.com/asmith26/jupytercad-mcp)** 🐍 🏠 🍎 🪟 🐧 🆓
  JupyterCAD control via natural language

- **[ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)** 🐍 🏠 🆓
  Blender 3D modeling integration

---

### 🧬 Biology, Medicine & Bioinformatics

Medical data, genomics, bioinformatics, health records, clinical trials.

_(This category will contain medical APIs, genomic databases, clinical trial data, health record systems, bioinformatics tools, etc.)_

- **PubMed & Medical Literature Servers**
- **Genomic Database Connectors**
- **Clinical Trial APIs**
- **Health Record Systems**
- **Drug Database Integrations**
- **Medical Imaging Tools**

---

### 📂 Browser Automation

Control browsers, web scraping, automated testing, web interaction.

- **[opentabs-dev/opentabs](https://github.com/opentabs-dev/opentabs)** 📇 🏠 🍎 🪟 🐧 🆓
  100+ plugins giving AI agents access to web apps through authenticated browser

- **Playwright/Puppeteer MCP Servers**
- **Selenium Integration**
- **Web Scraping Tools**
- **Browser Extension APIs**

---

### ☁️ Cloud Platforms

AWS, Azure, GCP, cloud infrastructure management, serverless, containers.

- **AWS Service Integrations**
- **Azure Management APIs**
- **Google Cloud Platform Tools**
- **Kubernetes & Container Orchestration**
- **Terraform/Infrastructure as Code**
- **Serverless Platforms**
- **Cloud Cost Management**

---

### 👨‍💻 Code Execution

Run code, execute scripts, sandboxed environments, REPLs.

- **[juspay/neurolink](https://github.com/juspay/neurolink)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  Multi-agent orchestration with code execution capabilities

- **Language-Specific REPL Servers**
- **Sandboxed Execution Environments**
- **Jupyter Notebook Integration**
- **Code Runner APIs**

---

### 🤖 Coding Agents

AI coding assistants, code generation, code review, refactoring.

- **[askbudi/roundtable](https://github.com/askbudi/roundtable)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  Unifies Codex, Claude Code, Cursor, Gemini

- **[depwire/depwire](https://github.com/depwire/depwire)** 📇 🐍 🏎️ 🦀 🌊 🏠 🆓
  Dependency graph + 15 MCP tools for AI coding

- **Code Review Tools**
- **Refactoring Assistants**
- **Documentation Generators**
- **Test Generation Tools**

---

### 🖥️ Command Line

Shell commands, terminal automation, CLI tools.

- **Shell Command Execution**
- **Terminal Multiplexers**
- **CLI Tool Wrappers**
- **Process Management**

---

### 💬 Communication

Email, chat, messaging, video conferencing.

- **Gmail Integration**
- **Slack Connectors**
- **Discord APIs**
- **Microsoft Teams**
- **Zoom Integration**
- **Email Service Providers**
- **SMS/Messaging APIs**

---

### 🗣️ Conversational AI

Chatbots, voice assistants, NLP, dialog systems.

- **[merterbak/Grok-MCP](https://github.com/merterbak/Grok-MCP)** 🐍 ☁️ 🍎 🪟 🐧 🔑
  xAI Grok API integration

- **Conversational AI Platforms**
- **Voice Recognition Services**
- **Dialog Management Systems**
- **Sentiment Analysis Tools**

---

### 👤 Customer Data Platforms

CRM, customer data, marketing automation, user analytics.

- **Salesforce Integration**
- **HubSpot Connectors**
- **Segment CDP**
- **Customer Analytics**
- **User Behavior Tracking**

---

### 🗄️ Databases

SQL, NoSQL, database management, query execution.

- **[julien040/anyquery](https://github.com/julien040/anyquery)** 🏎️ 🏠 ☁️ 🆓
  Query 40+ apps with SQL

- **PostgreSQL Connectors**
- **MySQL/MariaDB Tools**
- **MongoDB Integration**
- **Redis Clients**
- **Elasticsearch APIs**
- **Database Migration Tools**

---

### 📊 Data Platforms

Data warehouses, ETL, data pipelines, analytics.

- **[mindsdb/mindsdb](https://github.com/mindsdb/mindsdb)** 🐍 ☁️ 🏠 🆓
  Unify data across platforms

- **Snowflake Integration**
- **BigQuery Connectors**
- **Data Pipeline Tools**
- **ETL Platforms**
- **Data Transformation**

---

### 🚚 Delivery

Package tracking, logistics, shipping APIs.

- **Shipment Tracking**
- **Logistics Management**
- **Freight APIs**
- **Last-Mile Delivery**

---

### 🛠️ Developer Tools

IDEs, version control, debugging, profiling.

- **[depwire/depwire](https://github.com/depwire/depwire)** 📇 🐍 🏎️ 🦀 🌊 🏠 🆓
  Dependency graph analysis

- **IDE Integration Tools**
- **Debugging Assistants**
- **Performance Profilers**
- **Code Linters**
- **Build Tools**

---

### 🧮 Data Science Tools

Machine learning, data analysis, statistical computing.

- **Jupyter Integration**
- **Pandas/NumPy Tools**
- **ML Model Serving**
- **Feature Engineering**
- **Experiment Tracking**

---

### 📊 Data Visualization

Charts, graphs, dashboards, visual analytics.

- **Visualization Libraries**
- **Dashboard Platforms**
- **Business Intelligence Tools**
- **Real-time Analytics**

---

### 📟 Embedded Systems

IoT, microcontrollers, embedded programming.

- **Arduino Integration**
- **Raspberry Pi Tools**
- **IoT Platforms**
- **Embedded Development**

---

### 🎓 Education

Learning management, educational content, online courses.

- **LMS Integration**
- **Educational Content APIs**
- **Student Management**
- **Online Course Platforms**

---

### 🛒 E-Commerce

Shopping, product catalogs, payment processing, order management.

- **Shopify Integration**
- **WooCommerce Connectors**
- **Payment Gateways**
- **Product Information Management**
- **Order Fulfillment**

---

### 🌳 Environment & Nature

Weather, climate data, environmental monitoring.

- **Weather APIs**
- **Climate Data Sources**
- **Environmental Sensors**
- **Satellite Imagery**

---

### 📂 File Systems

File operations, storage, cloud storage, file management.

- **Local File System Tools**
- **Cloud Storage (S3, Drive, Dropbox)**
- **File Sync Services**
- **Backup Solutions**

---

### 💰 Finance & Fintech

Banking, payments, trading, cryptocurrency, financial data.

- **Banking APIs**
- **Payment Processors (Stripe, PayPal)**
- **Cryptocurrency Exchanges**
- **Stock Market Data**
- **Financial Analytics**
- **Blockchain Integration**
- **x402/L402 Micropayment Systems**

---

### 🎮 Gaming

Game development, gaming APIs, esports data.

- **[YangLiangwei/PersonalizationMCP](https://github.com/YangLiangwei/PersonalizationMCP)** 🐍 ☁️ 🏠 🍎 🪟 🐧 🔐
  Includes Steam integration with 90+ tools

- **Gaming Platforms**
- **Esports APIs**
- **Game Development Tools**

---

### 🏠 Home Automation

Smart home, IoT devices, home control systems.

- **Smart Home Platforms**
- **Home Assistant Integration**
- **IoT Device Control**
- **Automation Systems**

---

### 🧠 Knowledge & Memory

Knowledge bases, memory systems, context management.

- **[gzoonet/cortex](https://github.com/gzoonet/cortex)** 📇 🏠 🆓
  Local-first knowledge graph

- **Knowledge Graph Tools**
- **Vector Databases**
- **Context Management**
- **Memory Systems**

---

### ⚖️ Legal

Legal documents, contract analysis, compliance.

- **Contract Analysis**
- **Legal Document Management**
- **Compliance Tools**
- **Legal Research APIs**

---

### 🗺️ Location Services

Maps, geocoding, routing, location data.

- **Google Maps Integration**
- **Geocoding Services**
- **Routing APIs**
- **Location Intelligence**

---

### 🎯 Marketing

Marketing automation, analytics, advertising platforms.

- **Marketing Automation**
- **Ad Platforms**
- **Marketing Analytics**
- **Campaign Management**

---

### 📊 Monitoring

Application monitoring, logging, observability.

- **APM Tools**
- **Log Aggregation**
- **Metrics Collection**
- **Alerting Systems**

---

### 🎥 Multimedia Processing

Video/audio processing, transcoding, media management.

- **[burningion/video-editing-mcp](https://github.com/burningion/video-editing-mcp)** 🐍 🏠 🆓
  Video editing and analysis

- **Video Processing**
- **Audio Processing**
- **Media Transcoding**
- **Streaming Platforms**

---

### 🖥️ OS Automation

Operating system automation, system administration.

- **System Administration**
- **Process Management**
- **Service Control**
- **OS-Level Automation**

---

### 📋 Product Management

Project management, task tracking, agile tools.

- **Project Management (Jira, Asana)**
- **Task Tracking**
- **Agile Tools**
- **Product Roadmap**

---

### 🏠 Real Estate

Property data, real estate listings, market analysis.

- **Property Listings**
- **Real Estate Analytics**
- **Market Data**
- **Property Management**

---

### 🔬 Research

Scientific research, academic databases, citation management.

- **Academic Database APIs**
- **Research Paper Search**
- **Citation Management**
- **Scientific Data**

---

### 🔎 Search & Data Extraction

Web search, data extraction, information retrieval.

- **[tadas-github/a2asearch-mcp](https://github.com/tadas-github/a2asearch-mcp)** 📇 ☁️ 🆓
  Search 4,800+ MCP servers and tools

- **[MastadoonPrime/sylex-search](https://github.com/MastadoonPrime/sylex-search)** 🐍 📇 ☁️ 🍎 🪟 🐧 🆓
  Universal search for products and services

- **Web Search APIs**
- **Data Extraction Tools**
- **Web Scraping**
- **Information Retrieval**

---

### 🔒 Security

Security scanning, vulnerability detection, penetration testing.

- **Security Scanning**
- **Vulnerability Assessment**
- **Penetration Testing Tools**
- **Security Monitoring**

---

### 🌐 Social Media

Social platforms, content posting, analytics.

- **[YangLiangwei/PersonalizationMCP](https://github.com/YangLiangwei/PersonalizationMCP)** 🐍 ☁️ 🏠 🍎 🪟 🐧 🔐
  YouTube, Reddit, Spotify integrations

- **Twitter/X APIs**
- **Facebook Integration**
- **Instagram Tools**
- **LinkedIn Connectors**
- **Social Media Analytics**

---

### 🏃 Sports

Sports data, scores, statistics, athlete information.

- **Sports APIs**
- **Live Scores**
- **Player Statistics**
- **Team Data**

---

### 🎧 Support & Service Management

Customer support, ticketing, service desk.

- **Zendesk Integration**
- **ServiceNow Connectors**
- **Support Ticketing**
- **Help Desk Tools**

---

### 🌎 Translation Services

Language translation, localization, multilingual support.

- **Translation APIs**
- **Localization Tools**
- **Language Detection**
- **Multilingual Content**

---

### 🎧 Text-to-Speech

Speech synthesis, voice generation, audio output.

- **TTS Services**
- **Voice Synthesis**
- **Audio Generation**
- **Speech APIs**

---

### 🚆 Travel & Transportation

Travel booking, transportation APIs, route planning.

- **[whiteknightonhorse/APIbase](https://github.com/whiteknightonhorse/APIbase)** 📇 ☁️ ⚡
  Travel APIs (Amadeus, Sabre)

- **Flight Booking**
- **Hotel Reservations**
- **Car Rental**
- **Public Transportation**
- **Route Planning**

---

### 🔄 Version Control

Git, GitHub, GitLab, version control systems.

- **GitHub Integration**
- **GitLab Connectors**
- **Bitbucket APIs**
- **Version Control Tools**
- **Code Review Systems**

---

### 🏢 Workplace & Productivity

Office suites, productivity tools, collaboration platforms.

- **[WayStation-ai/mcp](https://github.com/waystation-ai/mcp)** ☁️ 🍎 🪟 🔐
  Notion, Slack, Monday, Airtable integration

- **Microsoft Office Integration**
- **Google Workspace**
- **Collaboration Tools**
- **Document Management**
- **Meeting Schedulers**

---

### 🛠️ Other Tools & Integrations

Miscellaneous tools and specialized integrations.

- **[profullstack/mcp-server](https://github.com/profullstack/mcp-server)** 📇 ☁️ 🏠 🍎 🪟 🐧 🆓
  20+ utilities: SEO, document conversion, domain lookup, QR generation

- **Utility Tools**
- **Specialized APIs**
- **Custom Integrations**
- **Developer Utilities**

---

## Installation

### Prerequisites
- Node.js 16+ or Python 3.8+
- Claude Desktop or compatible MCP client
- API keys for cloud services (where required)

### Configuration

Add MCP servers to your configuration file:

**For Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):**
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "package-name"],
      "env": {
        "API_KEY": "your-key-here"
      }
    }
  }
}
```

**For Python-based servers:**
```json
{
  "mcpServers": {
    "server-name": {
      "command": "python",
      "args": ["-m", "package_name"],
      "env": {
        "API_KEY": "your-key-here"
      }
    }
  }
}
```

### Usage Examples

**Search for connectors:**
```bash
npx -y a2asearch-mcp "database access"
```

**Install and use a connector:**
```bash
# Install via npm
npm install -g @package/mcp-server

# Or use directly
npx -y @package/mcp-server
```

---

## Contributing

We welcome contributions! To add a new connector:

1. Fork this repository
2. Add your connector to the appropriate category
3. Follow the format: `**[Name](URL)** Icons Description`
4. Include icons for language, scope, OS, and payment model
5. Provide clear description of functionality
6. Submit a pull request

### Contribution Guidelines
- Ensure connector is functional and maintained
- Include installation instructions
- Add proper icons and metadata
- Test configuration examples
- Update table of contents if adding new category

---

## License

This marketplace documentation is licensed under Apache 2.0.

Individual connectors and tools have their own licenses - please check each project's repository.

---

## Acknowledgments

Inspired by:
- [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) by @punkpeye
- [awesome-codex-plugins](https://github.com/hashgraph-online/awesome-codex-plugins) by Hashgraph Online

Special thanks to the entire MCP and Codex community for building this ecosystem.

---

<p align="center">
  <strong>⭐ Star this repository to stay updated with new connectors!</strong>
</p>

<p align="center">
  <sub>Last updated: 2026-05-12</sub>
</p>
