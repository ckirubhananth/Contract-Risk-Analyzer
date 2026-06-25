# 📘 Contract Risk Analyzer - Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose

The Contract Risk Analyzer is an agentic, multi‑agent system that ingests contract documents, segments them into clauses, classifies legal risks, assigns risk scores, and generates structured outputs including JSON, summaries, and visualizations. This SRS defines all functional, non‑functional, architectural, security, and specification‑driven requirements.

### 1.2 Scope

The system will:

- Accept natural‑language instructions
- Ingest contract files (PDF, DOCX, TXT)
- Segment contracts into clauses
- Classify clauses into risk categories
- Score each clause
- Generate structured JSON output
- Produce human‑readable summaries
- Provide visualizations
- Operate using a multi‑agent architecture
- Use Skills for procedural knowledge
- Follow a spec‑driven development model

### 1.3 Definitions

- **Clause:** A logical unit of contract text.
- **Risk Category:** Type of legal risk (e.g., Indemnity, Termination).
- **Risk Level:** Low, Medium, High.
- **MCP:** Model Context Protocol for tool integration.
- **Skill:** Modular procedural capability with metadata + scripts.
- **A2A:** Agent‑to‑Agent communication.
- **A2UI:** Structured JSON → UI rendering.
- **SDD:** Spec‑Driven Development.

## 2. System Overview

The Contract Risk Analyzer is composed of multiple cooperating agents:

- Orchestrator Agent
- Ingestion Agent
- Segmentation Agent
- Risk Analysis Agent
- Summary Agent
- Visualization Agent

Agents communicate via structured A2A messages and use MCP tools for execution.

## 3. Functional Requirements

### 3.1 Natural‑Language Intent Handling

The system must:

- Accept high‑level natural‑language goals (e.g., "Analyze this contract for risk")
- Convert them into structured tasks: Ingest → Segment → Classify → Score → Summarize

### 3.2 Contract Ingestion

The system must:

- Accept PDF, DOCX, TXT via MCP file ingestion
- Extract text using MCP text‑extraction tools
- Store contract in an isolated workspace

### 3.3 Clause Segmentation

The system must:

- Split contract into clauses using:
  - Sentence boundary detection
  - Regex patterns
  - Legal heuristics
- Preserve clause order
- Assign unique clause IDs

### 3.4 Risk Classification

The system must classify each clause into one of:

- Indemnity
- Limitation of Liability
- Termination
- Confidentiality
- Payment Terms
- Governing Law
- Arbitration / Dispute Resolution
- Other

Classification must use:

- A baseline ML model (TF‑IDF + Logistic Regression)
- Optional transformer model (DistilBERT)

### 3.5 Risk Scoring

Each clause must receive:

- Risk category
- Risk level (Low / Medium / High)
- Explanation
- Confidence score
- Clause ID

Scoring must follow a YAML‑defined rubric.

### 3.6 Output Requirements

#### 3.6.1 JSON Output

The system must generate structured JSON, e.g.:

```json
{
  "clause_id": "C12",
  "text": "...",
  "risk_category": "Indemnity",
  "risk_level": "High",
  "explanation": "Broad indemnity without limitations.",
  "confidence": 0.92
}
```

#### 3.6.2 Human Summary

The system must generate:

- Top risks
- Overall contract risk score
- Recommended review areas

#### 3.6.3 Visualizations

The system must generate:

- Risk distribution bar chart
- Clause‑level heatmap
- Category frequency chart

## 4. Agent Architecture Requirements

### 4.1 Multi‑Agent System

The system must include:

- Orchestrator Agent
- Ingestion Agent
- Segmentation Agent
- Risk Analysis Agent
- Summary Agent
- Visualization Agent

Each agent must have a clear role and communicate via structured A2A messages.

### 4.2 Agent Loop

Each agent must follow:

- Perceive
- Plan
- Act
- Observe
- Iterate

### 4.3 Context Management

The system must separate:

**Static Context**
- Risk taxonomy
- Scoring rubric
- System identity
- Global rules

**Dynamic Context**
- Contract text
- Extracted clauses
- Model outputs
- Skill results

The system must avoid context overload by loading only relevant context.

## 5. Tooling Requirements

### 5.1 MCP Integration

The system must use MCP tools for:

- File ingestion
- Text extraction
- Model execution
- JSON export
- Visualization

Custom REST wrappers are not allowed.

### 5.2 A2UI Requirements

The system must:

- Output structured JSON
- Generate UI components (tables, charts, clause cards)

## 6. Skills Requirements

### 6.1 Skill Structure

Each Skill must include:

- SKILL.md
- scripts/
- references/
- assets/

### 6.2 Progressive Disclosure

- Only Skill metadata loads by default
- Scripts load only when triggered
- Heavy inference loads only when needed

### 6.3 Trigger‑Based Activation

Examples:

- "Analyze contract" → segmentation Skill
- "Score risk" → scoring Skill
- "Show charts" → visualization Skill

### 6.4 Skill Evaluation

Each Skill must include:

- Unit tests
- Golden dataset
- LLM‑as‑judge evaluation
- Adversarial tests
- Canary mode

## 7. Security Requirements

### 7.1 Security Architecture

The system must include:

- Sandboxed execution
- Data isolation
- Protected system prompts
- LLM firewall
- Agent identity separation
- Observability logs
- Governance policies

### 7.2 Sandboxing

All code must run in isolated, ephemeral environments.

### 7.3 Zero Ambient Authority

- No inherited privileges
- JIT credentials only

### 7.4 High‑Risk Action Controls

High‑risk actions (e.g., exporting full contracts) require:

- Plain‑English summary
- Human approval

### 7.5 Evaluation Requirements

The system must include:

- Output evaluation
- Trajectory evaluation
- Regression tests

## 8. Spec‑Driven Development Requirements

### 8.1 Specs as Source of Truth

The `/specs` folder must include:

- Markdown narrative
- YAML structured config
- Gherkin behavior tests

### 8.2 Code Regeneration

All code must be regenerable from specs.

### 8.3 Execution Modes

The system must support:

- Project generation
- Feature generation
- Bug fixing
- Documentation generation
- Data engineering

### 8.4 Instruction Hierarchy

The system must follow:

- Chat (ephemeral)
- Specs (canonical)
- Skills (procedural)
- System prompts (identity)

## 9. Non‑Functional Requirements

### 9.1 Performance

- Must analyze a 10‑page contract in < 5 seconds (baseline).

### 9.2 Reliability

- Must handle malformed contracts gracefully.

### 9.3 Usability

- Must provide clear summaries and visualizations.

### 9.4 Maintainability

- All logic must be spec‑driven and regenerable.

## 10. Acceptance Criteria

The system is accepted when:

- All functional requirements are met
- All Skills pass evaluation
- JSON output validates against schema
- Visualizations render correctly
- Multi‑agent workflow executes end‑to‑end
- Specs fully regenerate the system
