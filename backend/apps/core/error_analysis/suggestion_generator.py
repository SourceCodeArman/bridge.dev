"""
Suggestion generator for error analysis.

Generates actionable fix suggestions from LLM analysis.
"""
from typing import Dict, Any
from apps.common.logging_utils import get_logger
from apps.core.models import RunStep, ErrorSuggestion
from .log_ingestor import LogIngestor
from .llm_analyzer import LLMErrorAnalyzer

logger = get_logger(__name__)


class SuggestionGenerator:
    """
    Generates error fix suggestions.
    """
    
    def __init__(self, llm_provider: str = 'openai', model: str = None, credential_id: str = None):
        """
        Initialize suggestion generator.
        
        Args:
            llm_provider: LLM provider to use
            model: Specific model to use
            credential_id: Credential ID for LLM API
        """
        self.llm_provider = llm_provider
        self.model = model
        self.credential_id = credential_id
        self.log_ingestor = LogIngestor()
        self.llm_analyzer = LLMErrorAnalyzer(llm_provider, model)
    
    def generate_suggestions(self, run_step: RunStep) -> list:
        """
        Generate suggestions for a failed step.
        
        Args:
            run_step: The failed RunStep instance
            
        Returns:
            List of ErrorSuggestion instances
        """
        if run_step.status != 'failed':
            logger.warning(
                f"Step {run_step.step_id} is not failed, skipping suggestion generation",
                extra={'run_step_id': str(run_step.id), 'status': run_step.status}
            )
            return []
        
        try:
            # Ingest context
            context = self.log_ingestor.ingest_step_context(run_step)
            
            # Analyze with LLM
            analysis = self.llm_analyzer.analyze_error(context, self.credential_id)
            
            # Create suggestion
            suggestion = ErrorSuggestion.objects.create(
                run_step=run_step,
                error_type=analysis['error_type'],
                suggestion=analysis['suggestion'],
                confidence=analysis['confidence'],
                actionable=analysis['actionable'],
                fix_data=analysis['fix_data']
            )
            
            logger.info(
                f"Generated suggestion for step {run_step.step_id}",
                extra={
                    'run_step_id': str(run_step.id),
                    'suggestion_id': str(suggestion.id),
                    'error_type': analysis['error_type'],
                    'confidence': analysis['confidence']
                }
            )
            
            return [suggestion]
            
        except Exception as e:
            logger.error(
                f"Failed to generate suggestions for step {run_step.step_id}: {str(e)}",
                exc_info=e,
                extra={'run_step_id': str(run_step.id), 'error': str(e)}
            )
            return []

