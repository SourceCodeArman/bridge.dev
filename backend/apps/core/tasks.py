"""
Celery tasks for workflow execution.

Handles asynchronous execution of workflow runs and steps.
"""

from celery import shared_task
from django.utils import timezone
from typing import Dict, Any

from apps.common.logging_utils import get_logger
from .models import Run, RunStep, CustomConnector
from .orchestrator import RunOrchestrator
from .concurrency import ConcurrencyManager

logger = get_logger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    reject_on_worker_lost=True,
)
def execute_workflow_run(self, run_id: str):
    """
    Execute a workflow run.

    This is the main task that orchestrates the execution of a workflow run.
    It manages the run lifecycle and coordinates step execution.

    Args:
        run_id: UUID string of the Run instance

    Returns:
        str: Success message or raises exception
    """
    try:
        run = Run.objects.select_related(
            "workflow_version", "workflow_version__workflow"
        ).get(id=run_id)
        orchestrator = RunOrchestrator()

        logger.info(f"Executing workflow run {run_id}", extra={"run_id": run_id})

        # Start the run
        orchestrator.start_run(run)

        # Get workflow for concurrency tracking
        workflow = run.workflow_version.workflow

        # Track run start for concurrency management
        # Note: Concurrency and rate limits are checked in orchestrator.create_run
        concurrency_manager = ConcurrencyManager()
        concurrency_manager.track_run_start(workflow.id, run_id)

        try:
            # Execute steps
            next_steps = orchestrator.get_next_steps(run)

            while next_steps:
                for step in next_steps:
                    # Execute step asynchronously
                    execute_run_step.delay(str(step.id))

                    # Wait for step completion (in a real implementation, this would be
                    # handled via callbacks or polling)
                    step.refresh_from_db()
                    if step.status == "failed":
                        # Run will be marked as failed by orchestrator
                        break

                # Refresh run to get updated status
                run.refresh_from_db()
                if run.status in ["failed", "completed", "cancelled"]:
                    break

                next_steps = orchestrator.get_next_steps(run)

            # Final check - orchestrator should have marked run as completed
            run.refresh_from_db()
            if run.status == "running":
                # Check if all steps are completed
                pending_or_running = run.steps.filter(
                    status__in=["pending", "running"]
                ).count()
                if pending_or_running == 0:
                    orchestrator.complete_run(run)

            logger.info(
                f"Completed workflow run {run_id}",
                extra={"run_id": run_id, "status": run.status},
            )

            return f"Run {run_id} executed successfully with status {run.status}"

        finally:
            # Always track run completion for concurrency management
            concurrency_manager.track_run_completion(workflow.id, run_id)

    except Run.DoesNotExist:
        logger.error(f"Run {run_id} not found")
        raise
    except Exception as exc:
        logger.error(
            f"Error executing workflow run {run_id}: {str(exc)}",
            exc_info=exc,
            extra={"run_id": run_id},
        )
        # Retry with exponential backoff
        raise self.retry(countdown=60 * (2**self.request.retries), exc=exc)


def execute_workflow_run_sync(run_id: str) -> Dict[str, Any]:
    """
    Execute a workflow run synchronously.

    This is a synchronous version of execute_workflow_run, used for webhooks
    that need to return the workflow result immediately.

    Args:
        run_id: UUID string of the Run instance

    Returns:
        Dict containing run status and aggregated outputs from all steps
    """
    try:
        run = Run.objects.select_related(
            "workflow_version", "workflow_version__workflow"
        ).get(id=run_id)
        orchestrator = RunOrchestrator()

        logger.info(
            f"Executing workflow run {run_id} synchronously",
            extra={"run_id": run_id},
        )

        # Start the run
        orchestrator.start_run(run)

        # Get workflow for concurrency tracking
        workflow = run.workflow_version.workflow

        # Track run start for concurrency management
        concurrency_manager = ConcurrencyManager()
        concurrency_manager.track_run_start(workflow.id, run_id)

        try:
            # Execute steps synchronously
            next_steps = orchestrator.get_next_steps(run)

            while next_steps:
                for step in next_steps:
                    # Execute step synchronously (not via Celery)
                    _execute_step_sync(str(step.id))

                    # Check updated step status
                    step.refresh_from_db()
                    if step.status == "failed":
                        break

                # Refresh run to get updated status
                run.refresh_from_db()
                if run.status in ["failed", "completed", "cancelled"]:
                    break

                next_steps = orchestrator.get_next_steps(run)

            # Final check - mark as completed if all steps done
            run.refresh_from_db()
            if run.status == "running":
                pending_or_running = run.steps.filter(
                    status__in=["pending", "running"]
                ).count()
                if pending_or_running == 0:
                    orchestrator.complete_run(run)

            # Aggregate outputs from all steps
            outputs = {}
            for step in run.steps.filter(status="completed").order_by("order"):
                outputs[step.step_id] = step.outputs

            logger.info(
                f"Completed sync workflow run {run_id}",
                extra={"run_id": run_id, "status": run.status},
            )

            return {
                "run_id": str(run.id),
                "status": run.status,
                "outputs": outputs,
            }

        finally:
            # Always track run completion for concurrency management
            concurrency_manager.track_run_completion(workflow.id, run_id)

    except Run.DoesNotExist:
        logger.error(f"Run {run_id} not found")
        raise
    except Exception as exc:
        logger.error(
            f"Error executing sync workflow run {run_id}: {str(exc)}",
            exc_info=exc,
            extra={"run_id": run_id},
        )
        raise


def _execute_step_sync(run_step_id: str) -> Dict[str, Any]:
    """
    Execute a single workflow step synchronously.

    Args:
        run_step_id: UUID string of the RunStep instance

    Returns:
        Dict containing step outputs
    """
    try:
        run_step = RunStep.objects.select_related("run").get(id=run_step_id)
        orchestrator = RunOrchestrator()

        logger.info(
            f"Executing step {run_step.step_id} synchronously for run {run_step.run.id}",
            extra={
                "run_step_id": run_step_id,
                "run_id": str(run_step.run.id),
                "step_id": run_step.step_id,
                "step_type": run_step.step_type,
            },
        )

        # Start the step
        orchestrator.execute_step(run_step)

        # Validate step inputs before execution
        from .validators import validate_step_inputs

        try:
            validate_step_inputs(run_step.step_type, run_step.inputs)
        except Exception as e:
            logger.warning(
                f"Input validation failed for step {run_step.id}: {str(e)}",
                extra={
                    "run_step_id": run_step_id,
                    "step_type": run_step.step_type,
                    "validation_error": str(e),
                },
            )

        # Execute the step logic
        outputs = _execute_step_logic(run_step)

        # Mark step as completed
        orchestrator.handle_step_completion(run_step, outputs)

        logger.info(
            f"Completed step {run_step.step_id} synchronously for run {run_step.run.id}",
            extra={
                "run_step_id": run_step_id,
                "run_id": str(run_step.run.id),
                "step_id": run_step.step_id,
            },
        )

        return outputs

    except RunStep.DoesNotExist:
        logger.error(f"RunStep {run_step_id} not found")
        raise
    except Exception as exc:
        logger.error(
            f"Error executing step {run_step_id} synchronously: {str(exc)}",
            exc_info=exc,
            extra={"run_step_id": run_step_id},
        )

        # Mark step as failed
        try:
            run_step = RunStep.objects.get(id=run_step_id)
            orchestrator = RunOrchestrator()
            orchestrator.handle_step_failure(run_step, str(exc))
        except RunStep.DoesNotExist:
            pass

        raise


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
    reject_on_worker_lost=True,
)
def execute_run_step(self, run_step_id: str):
    """
    Execute a single workflow step.

    Args:
        run_step_id: UUID string of the RunStep instance

    Returns:
        str: Success message or raises exception
    """
    try:
        run_step = RunStep.objects.select_related("run").get(id=run_step_id)
        orchestrator = RunOrchestrator()

        logger.info(
            f"Executing step {run_step.step_id} for run {run_step.run.id}",
            extra={
                "run_step_id": run_step_id,
                "run_id": str(run_step.run.id),
                "step_id": run_step.step_id,
                "step_type": run_step.step_type,
            },
        )

        # Start the step
        orchestrator.execute_step(run_step)

        # Validate step inputs before execution
        from .validators import validate_step_inputs

        try:
            validate_step_inputs(run_step.step_type, run_step.inputs)
        except Exception as e:
            logger.warning(
                f"Input validation failed for step {run_step.id}: {str(e)}",
                extra={
                    "run_step_id": run_step_id,
                    "step_type": run_step.step_type,
                    "validation_error": str(e),
                },
            )
            # Continue execution anyway, but log the warning

        # Execute the step logic
        # TODO: This will be implemented with connector SDK in Phase 2
        # For now, we'll simulate execution
        outputs = _execute_step_logic(run_step)

        # Mark step as completed
        orchestrator.handle_step_completion(run_step, outputs)

        logger.info(
            f"Completed step {run_step.step_id} for run {run_step.run.id}",
            extra={
                "run_step_id": run_step_id,
                "run_id": str(run_step.run.id),
                "step_id": run_step.step_id,
            },
        )

        return f"Step {run_step.step_id} executed successfully"

    except RunStep.DoesNotExist:
        logger.error(f"RunStep {run_step_id} not found")
        raise
    except Exception as exc:
        logger.error(
            f"Error executing step {run_step_id}: {str(exc)}",
            exc_info=exc,
            extra={"run_step_id": run_step_id},
        )

        # Mark step as failed
        try:
            run_step = RunStep.objects.get(id=run_step_id)
            orchestrator = RunOrchestrator()
            orchestrator.handle_step_failure(run_step, str(exc))
        except RunStep.DoesNotExist:
            pass

        # Retry with exponential backoff
        raise self.retry(countdown=30 * (2**self.request.retries), exc=exc)


def _execute_step_logic(run_step: RunStep) -> Dict[str, Any]:
    """
    Execute the actual step logic using connector SDK.

    Args:
        run_step: The RunStep instance

    Returns:
        Dict containing step outputs
    """
    from .connectors.base import ConnectorRegistry, DatabaseCustomConnector
    from .models import Credential
    from .encryption import get_encryption_service

    logger.info(
        f"Executing step logic for {run_step.step_id} (type: {run_step.step_type})",
        extra={
            "run_step_id": str(run_step.id),
            "step_id": run_step.step_id,
            "step_type": run_step.step_type,
        },
    )

    # Get connector from registry (built-in connectors)
    registry = ConnectorRegistry()
    connector_class = registry.get(run_step.step_type)

    # Get credential from step inputs or workflow definition
    credential_id = run_step.inputs.get("credential_id")
    config = {}

    # Validate that credential_id is a valid UUID (not a connector slug)
    if credential_id:
        import uuid

        try:
            uuid.UUID(str(credential_id))
        except (ValueError, AttributeError):
            logger.warning(
                f"Invalid credential_id '{credential_id}' for step {run_step.step_id} - not a valid UUID, skipping credential lookup",
                extra={"credential_id": credential_id, "step_id": run_step.step_id},
            )
            credential_id = None  # Reset to None so we don't try to look it up

    if credential_id:
        try:
            # Get credential and decrypt
            credential = Credential.objects.get(id=credential_id)
            encryption_service = get_encryption_service()
            credential_data = encryption_service.decrypt_dict(credential.encrypted_data)

            # Add credential data to config
            config.update(credential_data)

            # Track credential usage
            from .models import CredentialUsage

            usage, created = CredentialUsage.objects.get_or_create(
                credential=credential, workflow=run_step.run.workflow_version.workflow
            )
            usage.usage_count += 1
            from django.utils import timezone

            usage.last_used_at = timezone.now()
            usage.save()

        except Credential.DoesNotExist:
            logger.warning(
                f"Credential {credential_id} not found for step {run_step.step_id}",
                extra={"credential_id": credential_id, "step_id": run_step.step_id},
            )
        except Exception as e:
            logger.error(
                f"Error loading credential {credential_id}: {str(e)}",
                exc_info=e,
                extra={"credential_id": credential_id},
            )

    # Add other step inputs to config
    config.update(run_step.inputs)

    # Determine if this is a database-backed custom connector
    db_custom_connector = None
    if connector_class is None:
        # Try to resolve a CustomConnector by slug or manifest id
        try:
            db_custom_connector = CustomConnector.objects.select_related(
                "current_version"
            ).get(
                workspace=run_step.run.workflow_version.workflow.workspace,
                slug=run_step.step_type,
                status="approved",
            )
        except CustomConnector.DoesNotExist:
            # Fallback: try matching on manifest id of current approved version
            db_custom_connector = (
                CustomConnector.objects.filter(
                    workspace=run_step.run.workflow_version.workflow.workspace,
                    status="approved",
                    current_version__manifest__id=run_step.step_type,
                )
                .select_related("current_version")
                .first()
            )

    # Check if connector is custom/user-contributed (requires sandbox)
    is_custom_connector = False
    temp_connector = None

    if connector_class is not None:
        # Built-in or code-based custom connector registered in registry
        temp_connector = connector_class({})
        is_custom_connector = _is_custom_connector(run_step.step_type, connector_class)
    elif db_custom_connector and db_custom_connector.current_version:
        # Database-backed custom connector
        manifest = db_custom_connector.current_version.manifest or {}
        config["manifest"] = manifest
        connector_class = DatabaseCustomConnector
        temp_connector = connector_class(config)
        is_custom_connector = True
    else:
        # Fallback to placeholder if connector not found
        logger.warning(
            f"Connector {run_step.step_type} not found in registry or custom connector store, using placeholder",
            extra={"step_type": run_step.step_type},
        )
        return {
            "status": "completed",
            "message": f"Step {run_step.step_id} executed (connector not found, placeholder)",
            "step_type": run_step.step_type,
        }

    # Get action_id from inputs (default to first action if not specified)
    # We need to get this before creating instance to check manifest
    manifest = getattr(temp_connector, "manifest", {}) or {}
    action_id = run_step.inputs.get("action_id")
    if not action_id and manifest.get("actions"):
        action_id = manifest["actions"][0]["id"]

    # Prepare inputs for action (exclude connector-specific fields)
    action_inputs = {
        k: v
        for k, v in run_step.inputs.items()
        if k not in ["credential_id", "action_id"]
    }

    # Execute connector action (with sandbox if custom)
    try:
        if is_custom_connector:
            # Execute in sandbox
            from .sandbox import (
                SandboxExecutor,
                ResourceLimits,
                NetworkPolicy,
                SecretPolicy,
            )

            # Get allowed domains from connector manifest if available
            manifest = manifest or {}
            allowed_domains = manifest.get("allowed_domains", [])

            # Create sandbox executor with policies
            resource_limits = ResourceLimits()
            network_policy = NetworkPolicy(
                allowed_domains=allowed_domains,
                allow_localhost=False,
                allow_internal=False,
            )
            secret_policy = SecretPolicy(
                allowed_secret_ids={credential_id} if credential_id else set(),
                mask_in_logs=True,
            )

            executor = SandboxExecutor(
                resource_limits=resource_limits,
                network_policy=network_policy,
                secret_policy=secret_policy,
            )

            logger.info(
                f"Executing custom connector {run_step.step_type} in sandbox",
                extra={
                    "step_type": run_step.step_type,
                    "step_id": run_step.step_id,
                    "action_id": action_id,
                },
            )

            outputs = executor.execute_connector(
                connector_class=connector_class,
                config=config,
                action_id=action_id,
                inputs=action_inputs,
            )
        else:
            # Execute normally (built-in connector)
            connector = registry.create_instance(run_step.step_type, config)
            outputs = connector.execute(action_id, action_inputs)

        return outputs
    except Exception as e:
        logger.error(
            f"Error executing connector {run_step.step_type}: {str(e)}",
            exc_info=e,
            extra={
                "step_type": run_step.step_type,
                "action_id": action_id,
                "step_id": run_step.step_id,
                "is_custom": is_custom_connector,
            },
        )
        raise


def _is_custom_connector(connector_id: str, connector_class) -> bool:
    """
    Check if connector is custom/user-contributed (requires sandbox).

    Args:
        connector_id: Connector ID
        connector_class: Connector class

    Returns:
        True if custom connector, False if built-in
    """
    # Built-in connectors are in examples/ or have specific IDs
    built_in_connectors = {
        "http",
        "webhook",
        "slack",
        "gmail",
        "google_sheets",
        "supabase_realtime",
        # Add other built-in connector IDs here
    }

    # Check by ID
    if connector_id in built_in_connectors:
        return False

    # Check by module path (built-in connectors are in examples/)
    module_path = connector_class.__module__
    if "examples" in module_path or "apps.core.connectors.examples" in module_path:
        return False

    # Check manifest for custom flag
    try:
        temp_instance = connector_class({})
        manifest = temp_instance.manifest
        if manifest.get("is_custom", False):
            return True
        if manifest.get("author") and "Bridge.dev" not in manifest.get("author", ""):
            # Connectors not authored by Bridge.dev are considered custom
            return True
    except Exception:
        pass

    # Default: assume custom if not clearly built-in
    # This is conservative - better to sandbox unknown connectors
    return True


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def retry_failed_step(self, run_step_id: str):
    """
    Retry a failed step with backoff.

    Args:
        run_step_id: UUID string of the RunStep instance

    Returns:
        str: Success message or raises exception
    """
    try:
        run_step = RunStep.objects.get(id=run_step_id)

        if run_step.status != "failed":
            logger.warning(
                f"Step {run_step_id} is not in failed state, skipping retry",
                extra={"run_step_id": run_step_id, "status": run_step.status},
            )
            return f"Step {run_step_id} is not failed, skipping retry"

        logger.info(
            f"Retrying failed step {run_step_id}", extra={"run_step_id": run_step_id}
        )

        # Reset step to pending
        run_step.status = "pending"
        run_step.error_message = ""
        run_step.started_at = None
        run_step.completed_at = None
        run_step.save(
            update_fields=[
                "status",
                "error_message",
                "started_at",
                "completed_at",
                "updated_at",
            ]
        )

        # Re-execute the step
        execute_run_step.delay(str(run_step_id))

        return f"Retry initiated for step {run_step_id}"

    except RunStep.DoesNotExist:
        logger.error(f"RunStep {run_step_id} not found for retry")
        raise
    except Exception as exc:
        logger.error(
            f"Error retrying step {run_step_id}: {str(exc)}",
            exc_info=exc,
            extra={"run_step_id": run_step_id},
        )
        raise self.retry(countdown=60 * (2**self.request.retries), exc=exc)


@shared_task
def check_and_trigger_cron_workflows():
    """
    Periodic task to check and trigger cron-based workflows.

    This task runs on a schedule (configured in CELERY_BEAT_SCHEDULE)
    and checks for workflows with cron triggers that need to be executed.

    Returns:
        int: Number of workflows triggered
    """
    from .models import Trigger
    from .orchestrator import RunOrchestrator

    try:
        import croniter
    except ImportError:
        logger.error("croniter not installed, cannot check cron triggers")
        return 0

    logger.info("Checking cron triggers")

    orchestrator = RunOrchestrator()
    triggered_count = 0

    # Get all active cron triggers
    cron_triggers = Trigger.objects.filter(
        trigger_type="cron", is_active=True
    ).select_related("workflow")

    now = timezone.now()

    for trigger in cron_triggers:
        try:
            cron_expression = trigger.config.get("cron_expression")
            if not cron_expression:
                logger.warning(
                    f"Trigger {trigger.id} missing cron_expression in config",
                    extra={"trigger_id": str(trigger.id)},
                )
                continue

            # Get active workflow version
            workflow_version = trigger.workflow.get_active_version()
            if not workflow_version:
                logger.warning(
                    f"Workflow {trigger.workflow.id} has no active version",
                    extra={"workflow_id": str(trigger.workflow.id)},
                )
                continue

            # Check if cron expression matches current time
            # This is simplified - in production, you'd track last execution time
            # Convert timezone-aware datetime to UTC naive for croniter
            from datetime import datetime

            now_utc = now.astimezone(timezone.utc)
            now_naive = datetime(
                now_utc.year,
                now_utc.month,
                now_utc.day,
                now_utc.hour,
                now_utc.minute,
                now_utc.second,
            )
            cron = croniter.croniter(cron_expression, now_naive)
            prev_time_naive = cron.get_prev(datetime)
            # Convert back to timezone-aware UTC
            prev_time = timezone.make_aware(prev_time_naive, timezone.utc)

            # Simple heuristic: trigger if previous execution time was recent
            # (within the last minute, accounting for task execution interval)
            time_diff = (now - prev_time).total_seconds()
            if time_diff < 120:  # Within 2 minutes
                # Create and enqueue run (skip limits check for cron triggers)
                run = orchestrator.create_run(
                    workflow_version=workflow_version,
                    trigger_type="cron",
                    input_data=trigger.config.get("input_data", {}),
                    idempotency_key=f"cron_{trigger.id}_{int(prev_time.timestamp())}",
                    check_limits=False,  # Cron triggers bypass limits
                )

                execute_workflow_run.delay(str(run.id))
                triggered_count += 1

                logger.info(
                    f"Triggered cron workflow {trigger.workflow.id}",
                    extra={
                        "trigger_id": str(trigger.id),
                        "workflow_id": str(trigger.workflow.id),
                        "run_id": str(run.id),
                    },
                )

        except Exception as exc:
            logger.error(
                f"Error processing cron trigger {trigger.id}: {str(exc)}",
                exc_info=exc,
                extra={"trigger_id": str(trigger.id)},
            )

    logger.info(
        f"Cron trigger check completed, triggered {triggered_count} workflows",
        extra={"triggered_count": triggered_count},
    )

    return triggered_count


@shared_task
def aggregate_run_trace(run_id: str):
    """
    Aggregate trace for a workflow run.

    This task builds/updates the trace structure for a run,
    typically called after step completion or run completion.

    Args:
        run_id: UUID string of the Run instance

    Returns:
        str: Success message
    """
    from .models import Run
    from .trace_aggregator import TraceAggregator

    try:
        run = Run.objects.get(id=run_id)
        aggregator = TraceAggregator()
        aggregator.update_trace(run)

        logger.info(f"Aggregated trace for run {run_id}", extra={"run_id": run_id})

        return f"Trace aggregated for run {run_id}"

    except Run.DoesNotExist:
        logger.error(f"Run {run_id} not found for trace aggregation")
        raise
    except Exception as exc:
        logger.error(
            f"Error aggregating trace for run {run_id}: {str(exc)}",
            exc_info=exc,
            extra={"run_id": run_id},
        )
        raise


@shared_task
def check_run_timeouts():
    """
    Periodic task to check for timed-out runs and trigger alerts.

    This task runs on a schedule (configured in CELERY_BEAT_SCHEDULE)
    and checks for runs that have exceeded their timeout threshold.

    Returns:
        int: Number of timed-out runs detected
    """
    from .models import Run, AlertConfiguration
    from .orchestrator import RunOrchestrator
    from django.conf import settings
    from apps.core.alerts.event_subscriber import AlertEventSubscriber

    logger.info("Checking for timed-out runs")

    orchestrator = RunOrchestrator()
    timed_out_count = 0

    # Get default timeout from settings (in seconds)
    default_timeout_seconds = getattr(
        settings, "WORKFLOW_RUN_TIMEOUT_SECONDS", 3600
    )  # 1 hour default

    # Get all running runs
    running_runs = Run.objects.filter(status="running", started_at__isnull=False)

    now = timezone.now()

    for run in running_runs:
        try:
            workflow = run.workflow_version.workflow

            # Get timeout threshold for this workflow
            alert_configs = AlertConfiguration.objects.filter(
                workflow=workflow, enabled=True, alert_on_timeout=True
            ).first()

            timeout_seconds = default_timeout_seconds
            if alert_configs and alert_configs.timeout_seconds:
                timeout_seconds = alert_configs.timeout_seconds

            # Check if run has exceeded timeout
            elapsed_seconds = (now - run.started_at).total_seconds()

            if elapsed_seconds > timeout_seconds:
                logger.warning(
                    f"Run {run.id} has timed out (elapsed: {elapsed_seconds}s, timeout: {timeout_seconds}s)",
                    extra={
                        "run_id": str(run.id),
                        "workflow_id": str(workflow.id),
                        "elapsed_seconds": elapsed_seconds,
                        "timeout_seconds": timeout_seconds,
                    },
                )

                # Mark run as failed with timeout error
                orchestrator.handle_run_failure(
                    run,
                    f"Run timed out after {elapsed_seconds} seconds (timeout: {timeout_seconds}s)",
                )

                # Trigger timeout alert event
                AlertEventSubscriber.on_run_timeout(run)

                timed_out_count += 1

        except Exception as exc:
            logger.error(
                f"Error processing timeout check for run {run.id}: {str(exc)}",
                exc_info=exc,
                extra={"run_id": str(run.id)},
            )

    logger.info(
        f"Timeout check completed, detected {timed_out_count} timed-out runs",
        extra={"timed_out_count": timed_out_count},
    )

    return timed_out_count


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_error_suggestions(self, run_step_id: str):
    """
    Generate error suggestions for a failed step.

    Args:
        run_step_id: UUID string of the RunStep instance

    Returns:
        str: Success message
    """
    from .models import RunStep
    from apps.core.error_analysis.suggestion_generator import SuggestionGenerator
    from django.conf import settings

    try:
        run_step = RunStep.objects.get(id=run_step_id)

        if run_step.status != "failed":
            logger.warning(
                f"Step {run_step_id} is not failed, skipping suggestion generation",
                extra={"run_step_id": run_step_id, "status": run_step.status},
            )
            return f"Step {run_step_id} is not failed, skipping"

        # Get LLM provider from settings
        llm_provider = getattr(settings, "ERROR_ANALYSIS_LLM_PROVIDER", "openai")
        llm_model = getattr(settings, "ERROR_ANALYSIS_LLM_MODEL", None)
        credential_id = getattr(settings, "ERROR_ANALYSIS_CREDENTIAL_ID", None)

        # Generate suggestions
        generator = SuggestionGenerator(
            llm_provider=llm_provider, model=llm_model, credential_id=credential_id
        )

        suggestions = generator.generate_suggestions(run_step)

        logger.info(
            f"Generated {len(suggestions)} suggestions for step {run_step_id}",
            extra={"run_step_id": run_step_id, "suggestion_count": len(suggestions)},
        )

        return f"Generated {len(suggestions)} suggestions for step {run_step_id}"

    except RunStep.DoesNotExist:
        logger.error(f"RunStep {run_step_id} not found")
        raise
    except Exception as exc:
        logger.error(
            f"Error generating suggestions for step {run_step_id}: {str(exc)}",
            exc_info=exc,
            extra={"run_step_id": run_step_id},
        )
        raise self.retry(countdown=60 * (2**self.request.retries), exc=exc)


@shared_task
def cleanup_stale_presence():
    """
    Periodic task to clean up stale presence records.

    Marks presence records as inactive if the user hasn't been seen within the staleness threshold.

    Returns:
        int: Number of stale presence records cleaned up
    """
    from datetime import timedelta
    from .models import WorkflowPresence

    logger.info("Cleaning up stale presence records")

    staleness_threshold = timedelta(minutes=5)
    cutoff_time = timezone.now() - staleness_threshold

    stale_presences = WorkflowPresence.objects.filter(
        is_active=True, last_seen_at__lt=cutoff_time
    )

    stale_count = stale_presences.count()

    if stale_count > 0:
        stale_presences.update(is_active=False)
        logger.info(
            f"Deactivated {stale_count} stale presence records",
            extra={"stale_count": stale_count},
        )

    return stale_count
