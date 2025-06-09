# Agentic LLM Development Guidelines

## 1. Environment Setup

### 1.1 System Configuration
- **Workspace**: `/home/nadavg/Projects` is a symlink to `/run/media/nadavg/spinner/Projects`
- **Paths**: Use absolute paths from `/home/nadavg/Projects`.
- **Directories**: Create nested dirs incrementally to avoid errors.
- **File Access**: Use MCP filesystem tools if direct access blocked.

### 1.2 Repository Management
- **Git Workflow**: Descriptive commit messages (`feat: Add user auth`), consistent branch names (`feature/name`).
- **Gitignore**: Exclude sensitive/large files; use MCP tools/shell for inspection.
- **Env Files**: Secure access, exclude from version control, handle environment-specific files.
- **Updates**: Update local repo before pushing to avoid conflicts.

## 2. Code Architecture

### 2.1 File Structure
- **Size Limit**: Files should be <500 lines for better LLM processing & maintainability.
- **Large Files**: Files >500 lines: add header (synopsis, logic, key components).
- **Component Design**: <100 LOC, SRP, defined I/O, min dependencies.
- **Directory Organization**: Group related functionality, separate concerns, follow project conventions.

### 2.2 Design Principles
- **Modularity**: Apply SRP to files, modules, classes, functions.
- **Naming**: Descriptive, context-appropriate names following project conventions.
- **Constants**: Use named constants for common/unclear literals.
- **Idempotency**: Safe repeats: pre-verify state, unique IDs, rollbacks.
- **Interfaces**: Define clear contracts between components, with validation.

### 2.3 Code Quality
- **Format/Lint**: Use project standards (e.g. Prettier, ESLint).
- **Error Handling**: Robust, specific messages, logging, graceful failure.
- **Security**: Use placeholders for secrets.
- **Performance**: Optimize critical sections with measurable metrics, data structures, caching.

## 3. Development Workflow

### 3.1 Testing
- **TDD**: Unit tests before/with implementation for validation.
- **Coverage**: Test user features, data transforms, boundaries (empty/null, max values).
- **Types**: Unit, integration, E2E tests as per change scope.

### 3.2 Debugging
- **Troubleshooting**: After 3-5 failed attempts, summarize & ask for help.
- **Call Stack Bisection**: For deep stack traces, examine midpoint between error origin and manifestation, then recursively narrow search.

### 3.3 Project Management
- **Dependencies**: Use project package manager, specific versions, update lock files.
- **Configuration**: Prefer config files (clear structure) over hardcoding.
- **Development**: Small, testable increments; early feedback.

## 4. API & Data

### 4.1 API Design
- **Best Practices**: Follow REST/GraphQL for consistent APIs.
- **Consistency**: Maintain patterns across endpoints (naming, responses, errors).
- **Documentation**: Comprehensive API docs (OpenAPI/Swagger).

### 4.2 Database
- **Data Access**: Use ORMs/query builders for DB interactions.
- **Validation**: Sanitize all inputs to prevent injection.
- **Migrations**: Versioned DB migrations, backward compatible, rollbacks.

## 5. Documentation

### 5.1 Code Documentation
- **Purpose-Driven Comments**: Explain *why*, not *what*; doc design, intent, logic.
- **Architecture Docs**: Doc system structure, module interactions, data flows.
- **Non-Obvious Elements**: Doc framework conventions, lib patterns, complex algorithms, custom components.
- **Doc Standards (adopted from JSDoc)**:
  - For classes, public methods, DTOs, entities, enums.
  - Tags: @file, @description, @param, @returns.
  - No redundant docs for obvious code.
  - No comments in JSON/YAML.

### 5.2 Communication
- **Clarity & Conciseness**: Clear, succinct, no verbosity.
- **Context Provision**: Relevant info, don't overwhelm.
- **Assumptions**: State clearly, confirm if uncertain.
- **Accuracy**: Verify info; support position with evidence.
- **Progress Updates**: Regular updates for complex/long tasks.
- **Documentation Sync**: Update docs with code changes.

## 6. LLM-Specific Practices

### 6.1 Context Management
- **Relevance Filtering**: Filter inputs by task; prune irrelevant details.
- **Information Density**: Optimize delivery (summarize, format, chunk).
- **State Tracking**: Maintain key state (intent, outcomes) across steps.
- **Windowing**: Manage context windows effectively for complex reasoning.

### 6.2 Task Handling
- **Planning**: Break complex ops into steps; track dependencies.
- **Validation**: Verify at critical points for correctness.
- **Fallbacks**: Define alternatives (tool error/retry/escalation).
- **Completion Criteria**: Clear, measurable success metrics.
- **Prioritization**: High-impact, user-facing issues, critical bugs first.

## 7. Tool Utilization

### 7.1 Tool Strategy
- **Fallbacks**: If tools stuck/ineffective, use alternatives (e.g. MCP tools, shell commands, etc).
- **Specialized Tools**: Use purpose-built tools (linters, formatters, test frameworks).
- **Missing Tools**: Flag if internal tools down/unresponsive.
- **Error Handling**: Graceful tool failure, meaningful user feedback.

### 7.2 Usage Framework
- **Direct Response**: Answer if confident in knowledge, no tool needed.
- **Research**: Proactive tool use for urgent queries (docs, errors, deps).
- **Scaling**: 1-2 calls for simple tasks, 20+ for complex research.
- **Learning**: Extract to apply reusable patterns (error handling, state mgmt) from code/examples. Similarly, extract to avoid anti-patterns from code/examples.
- **Conflicts**: Apply rule hierarchy if ambiguous; default safe or clarify.

## 8. Available MCP Services
- **Git**: Repo management (commit, branch, diff, log).
- **Fetch**: Retrieve external URL info.
- **Sequential Thinking**: Step-by-step complex problem reasoning.
- **Context7**: Doc access (usage: 'resolve-library-id' → 'get_library_docs').
- **Filesystem**: File ops (prioritize internal tools if available).
- **Memory**: Manage persistent context/knowledge.
