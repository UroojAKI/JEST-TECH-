# Architecture Decision Record (ADR) — Reporting Module

## Status
Approved

## Context
We are implementing the Reporting & Business Intelligence foundation (`Sprint 13.1`). The reporting requirements will grow to support diverse datasets (Sales, Policies, Claims, Revenue) and complex delivery channels (exporters, scheduled emails, PowerBI, etc.). This ADR establishes the core architectural principles to prevent code duplication, model instability, and database coupling.

## Decisions

### 1. Metadata-Driven Reports
- **Decision**: Report layout, columns, filters, and display options are stored as structured configuration metadata in the database rather than hardcoded in the application layers.
- **Consequences**: Adding new report templates or modifying display fields requires database inserts/updates (via seeds/migrations) instead of code deployments. This allows dynamic adjustments, customizable user-saved reports, and custom columns/layouts.

### 2. Single Responsibility Separation (Builder, Execution, Exporter, Scheduler)
- **Decision**: The reporting engine is divided into distinct, loosely-coupled components:
  - **Query Builder**: Translates filters and parameters into standard Prisma query conditions.
  - **Execution Engine**: Manages the lifecycle of executing a query, auditing run-time metrics, updating status fields, and emitting events.
  - **Export Engine**: Decoupled factory that parses generic arrays of data into binary/text files (CSV, PDF, Excel).
  - **Scheduler**: Triggering cron/time-zone based execution parameters.
- **Consequences**: Each component can be scaled and modified independently. For example, upgrading the Excel exporter or adding email attachments will not affect the core query logic.

### 3. Strict Enums Over Free-form Strings
- **Decision**: All categorization fields (`ReportCategory`, `ReportModule`, `ReportType`, `ReportStatus`, filter `operator`, schedule `frequency`) are defined as Postgres enums in the Prisma schema.
- **Consequences**: Prevents typos, invalid filtering payloads, and enforces data integrity at the database layer.

### 4. Generic Exporters
- **Decision**: Exporters implement a generic interface `ExportProvider` accepting generic datasets (`Record<string, any>[]`) and column headers rather than report-specific models.
- **Consequences**: Exporters are highly reusable across the entire JEST platform (e.g. policy certificates, claim lists, invoices) without modification.
