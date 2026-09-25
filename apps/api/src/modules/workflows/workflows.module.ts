import { Module } from "@nestjs/common";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsService } from "./workflows.service";

/**
 * Workflows / automation (Phase 5). Site-scoped CRUD over workflows + ordered
 * actions, lifecycle, a runs reader, and a dry-run test. Exports WorkflowsService
 * so the non-invasive trigger hooks (forms submit, audience-recompute enqueue,
 * profile scoring) can best-effort enqueue runs. The worker executor consumes
 * the WORKFLOW_RUN queue. See apps/api/REVENUE-ORCHESTRATION.md.
 *
 * QueueService + AuditService + ScopedRepository come from the global
 * QueueModule / CommonModule, so no extra imports are needed here.
 */
@Module({
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
