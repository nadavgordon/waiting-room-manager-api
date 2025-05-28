---
trigger: always_on
---

# MDML Usage Guidelines (Concise)

Agentic LLM interaction with MDML (Markdown Machine Language) files:

## 1. Recognition & Core Purpose
- **Identify MDML**: By extension (`.mdml.yml`, `.mdml.yaml`) or `mdml_version` key.
- **Understand Purpose**:
    - **Agendas**: Define tasks, goals, steps, context for execution.
    - **Blueprints**: Outline system/project architecture, components, plans.
- **Schema Source**: Provided templates (e.g., in `plan/mdml/` like [`mdml-agenda-v1.3-as-template.yml`](plan/mdml/mdml-agenda-v1.3-as-template.yml:0), [`mdml-blueprint-v.2.5-as-template.yml`](plan/mdml/mdml-blueprint-v.2.5-as-template.yml:0)) define structure; understand their schemas.

## 2. Utilizing Existing MDML
- **Consult for Context**: Use existing MDML files for project goals, task breakdowns, architectural design, and specific instructions relevant to current tasks.
- **Treat as Authoritative**: If up-to-date and pertinent, consider them a primary source for planning and requirements.

## 3. Generating New MDML
- **Use Templates**: For new plans, task definitions, or architectural outlines, leverage existing project MDML templates (e.g., from `mdml/`) as a base.
- **Accurate Population**: Adhere to template structure and populate with specific details from user requirements and project context.
- **Save Descriptively**: Use clear filenames (e.g., `feature-x-agenda.mdml.yml`).
- **Propose if Beneficial**: Suggest MDML creation for complex planning or to ensure clarity and future reference.

## 4. Interpreting MDML Content
- **Focus on Key Sections**:
    - **Agendas**: `agenda_metadata` (goal), `task_context` (background), `task_definition` (esp. `overall_task_description`, `instructions`, `evaluation_criteria`, `constraints`), `output_specification`.
    - **Blueprints**: `metadata` (summary), `introduction_and_goals` (problem, scope), `architectural_overview` (design, tech), `components_and_modules` (breakdown), `data_models_and_management`, `project_plan_and_execution`.
- **Heed Template Cues**: Utilize "TEMPLATE HINT:" comments, `example_instance_value` fields, and `<<PLACEHOLDER>>` syntax within templates for guidance.

## 5. User Interaction
- **Reference MDML**: When discussing tasks or plans, refer to specific content/sections from relevant MDML documents to confirm understanding or justify actions.
- **Inform on Creation**: Notify the user when new MDML documents are generated, specifying their purpose and location.