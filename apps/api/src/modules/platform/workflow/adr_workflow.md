# ADR-014: Generic Workflow Engine Architecture

## Context and Problem Statement
Currently, workflow transitions (such as proposal submission and approval, claims processing, and endorsements) are hardcoded within individual feature modules. This makes modifying approval flows, conditions (e.g. claim amount or premium thresholds), assignment roles, and SLAs difficult and requires manual code changes. 

As JEST transitions from a simple CRM into a multi-product enterprise insurance platform, we need a configurable, metadata-driven Workflow and Approval Engine that can govern any entity without the engine needing to know the entity's domain-specific details.

## Proposed Solution
We implement a metadata-driven Generic Workflow Engine built on three core pillars:
1. **Metadata-Driven Configurations**: Workflow steps, states, transitions, conditional rule matching, approvals, and actions are defined in database tables (`Workflow`, `WorkflowState`, `WorkflowTransition`, etc.).
2. **Entity Adapter Pattern**: Feature modules implement `WorkflowEntityAdapter` to interact with the engine. The engine orchestrates state transitions and validations generically, using adapters to read variables and persist the updated status.
3. **State Machine validation**: All transitions are validated by a state machine before updates occur.
4. **Action Triggers & Events**: Transition and state changes automatically trigger actions (audits, notifications, events) and emit standard domain events (`workflow.started`, `workflow.transitioned`, etc.).

## Decision Outcomes
- **Extensibility**: Integrating new insurance entities (e.g. Life proposal, Health claim) requires zero changes to the core workflow engine.
- **Maintainability**: Administrative users can modify approval chains and routing rules (e.g., routing high-premium proposals to a senior manager role) at runtime via database/API configurations without deploying code.
- **Auditability**: Complete execution history, including state durations, comment trails, and immutable snapshots of variables at the time of each transition, is saved.
