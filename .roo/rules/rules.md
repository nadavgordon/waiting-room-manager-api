# Development Guidelines

Best practices for Agentic LLM software development assistance.

## General Rules (for LLM)

- **Environment**: `/home/nadavg/Projects` symlinks to `/run/media/nadavg/spinner/Projects`.
- **MCP Servers**: Use MCPs; prioritize `Context7` for docs; prioritize internal filesystem tools over MCP.
- **Git**: Clear commits (e.g., 'feat: X'), consistent branches (`feature/name`). Update local branch before push.
- **File System**: Full paths from `/home/nadavg/Projects`. Create nested dirs incrementally.
- **Repo Content**: Version essentials. Exclude sensitive/large/env-specific files via `.gitignore`.
- **.gitignore Access**: `.gitignore` items may be relevant. Use MCP fs tools or shell to inspect.
- **Environment Awareness**: Handle env-specific files (e.g., `.env.production`) correctly. Ask if ambiguous.

## Code Structure and Maintainability (for LLM)

- **File Size (Max 500 lines)**: Keep files under 500 lines for LLM processing.
- **Modularity/SRP**: Single responsibility for files/modules/classes/functions.
- **Large File Metadata**: Files >500 lines need header: synopsis, logic overview, key components.
- **Large File Editing**: Process large files in ~100 line chunks; verify.
- **Formatting/Linting**: Adhere to project linters/formatters (e.g., Prettier, ESLint).
- **Naming Conventions**: Infer from project code (e.g., `camelCase`). Descriptive names.
- **Constants**: Use named constants for multi-use or non-obvious literals.
- **Component-Based Design**: Break tasks into small, self-contained, reusable components.

## Development Process and Practices (for LLM)

- **Security - Secrets**: Use placeholders for secrets. Use project's secret mechanism (e.g., `.env`).
- **Testing (TDD Focus)**: Write unit tests before/alongside implementation (e.g., `*.test.js`). Cover primary/edge cases.
- **Broader Tests**: Note if integration/E2E tests are relevant for broad changes.
- **Difficult Issues**: If stuck (3-5 tries), summarize attempts/failures before consulting.
- **Debugging**: When debugging errors in deep call stacks where the symptom is likely distant from the root cause, employ "Call Stack Bisection": iteratively select a function call roughly midway between your current suspected earliest point of failure and the error location. Guide inspection of the program state at the entry of this midpoint function. If the state is already incorrect, the bug lies in the earlier half of the stack; if correct, it's in the later half (or within the midpoint function itself). Update your search boundaries accordingly and repeat this halving process to rapidly narrow down to the function where the state first becomes erroneous, thereby localizing the bug's origin more efficiently than linear tracing. This requires the call stack, error details, and a means to assess program state at chosen points.
- **Dependency Management**: Use project package manager. Specify versions. Update lock files.
- **Error Handling**: Robust error handling: specific messages, logging, graceful failure.
- **Code Comments**: For complex logic, non-obvious decisions, TODOs. Avoid over-commenting.
- **Performance**: Be mindful of performance. Optimize critical sections if needed.
- **Code Review Prep**: Ensure code is clean, tested, documented.
- **Iterative Development**: Small, testable increments. Seek early feedback.
- **Tool Usage**: Prefer specialized tools (linters, etc.) over generic edits.
- **Idempotency**: Strive for idempotent operations (e.g., re-runnable scripts).
- **Configuration**: Prefer config files over hardcoding. Structure for clarity.
- **API Design**: Follow REST/GraphQL best practices. Consistent, well-documented.
- **Database Interactions**: Use ORMs/query builders. Sanitize inputs. Use migrations.

## Documentation and Communication (for LLM)

- **Clarity/Conciseness**: Communicate clearly and briefly.
- **Proactive Info**: Offer relevant context/suggestions, don't overwhelm.
- **Assumption Verification**: State assumptions, ask for confirmation if unsure.
- **Progress Updates**: Regular updates for complex tasks.
- **Questioning**: Ask clarifying questions for ambiguous requirements.
- **Doc Types**: Aware of READMEs, API docs (OpenAPI), code-level docs (JSDoc).
- **Doc-Code Sync**: Update docs accurately with code changes.
- **Design Rationale**: Briefly note reasons for significant design choices.
- **User-Facing Docs**: Identify if user docs need updates. Attempt or flag.

# MCP Services Guidelines

## Servers

### Git
- **Tools**: `git_status`, `git_diff_unstaged`, `git_diff_staged`, `git_diff`, `git_commit`, `git_add`, `git_reset`, `git_log`, `git_create_branch`, `git_checkout`, `git_show`
- **Use**: Git repository interactions.

### Fetch
- **Tools**: `fetch`
- **Use**: Fetching external URLs.

### Sequential Thinking
- **Tools**: `sequentialthinking`
- **Use**: Adaptive complex problem breakdown.

### Context7
- **Tools**: `resolve-library-id`, `get_library_docs`
- **Use**: PRIORITIZE for up-to-date docs. Call `resolve-library-id` first.

### Filesystem
- **Tools**: `read_file`, `write_file`, `edit_file`, `move_file`, `read_multiple_files`, `search_files`, `get_file_info`, `list_allowed_directories`, `create_directory`, `list_directory`, `directory_tree`
- **Use**: File/directory operations. PRIORITIZE internal tools over MCP.

### Memory
- **Tools**: `create_entities`, `create_relations`, `add_observations`, `delete_entities`, `delete_relations`, `delete_observations`, `read_graph`, `search_nodes`, `open_nodes`
- **Use**: Persistent memory operations.