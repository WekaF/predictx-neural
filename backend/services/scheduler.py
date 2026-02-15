from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.date import DateTrigger
from datetime import datetime, timedelta
import logging
from ai_engine import ai_engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PredictXScheduler")

class TrainingScheduler:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.is_running = False
        self.current_job = None
        
    def start(self):
        if not self.is_running:
            self.scheduler.start()
            self.is_running = True
            logger.info("Training Scheduler Started")
            
    def stop(self):
        if self.is_running:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("Training Scheduler Stopped")

    def schedule_training(self, interval_hours=24):
        """Schedule recurring training"""
        # Remove existing job if any
        self.remove_training_job()
        
        # Add new job
        self.scheduler.add_job(
            self.run_training_pipeline,
            trigger=IntervalTrigger(hours=interval_hours),
            id='auto_training_job',
            replace_existing=True
        )
        logger.info(f"Auto-training scheduled every {interval_hours} hours")
        
        return {"status": "success", "message": f"Training scheduled every {interval_hours} hours"}

    def remove_training_job(self):
        if self.scheduler.get_job('auto_training_job'):
            self.scheduler.remove_job('auto_training_job')
            logger.info("Auto-training job removed")

    def get_status(self):
        job = self.scheduler.get_job('auto_training_job')
        next_run = job.next_run_time if job else None
        return {
            "running": self.is_running,
            "job_scheduled": job is not None,
            "next_run": next_run.isoformat() if next_run else None
        }

    def run_training_pipeline(self):
        """
        The actual training sequence.
        Runs in background thread.
        """
        logger.info("🚀 Starting Auto-Training Pipeline...")
        
        try:
            # Step 1: Train LSTM
            logger.info("Step 1: Training LSTM...")
            ai_engine.train(symbol="BTC-USD", epochs=20) # Lower epochs for auto-training to avoid long lock
            
            # Step 2: Retrain CNN (if applicable)
            # Placeholder for CNN training call
            
            # Step 3: Retrain RL Agent (if applicable)
            # Placeholder for RL training call
            
            logger.info("✅ Auto-Training Pipeline Complete")
            
        except Exception as e:
            logger.error(f"❌ Auto-Training Failed: {e}")

# Global Instance
training_scheduler = TrainingScheduler()
