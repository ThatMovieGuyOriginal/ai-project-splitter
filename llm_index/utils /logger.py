import logging
import sys

def setup_logger():
    logger = logging.getLogger("llm-index")
    if logger.hasHandlers():
        return
    logger.setLevel(logging.DEBUG)
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        '[%(asctime)s][%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    # Silence other noisy loggers
    for noisy in ['rope', 'sklearn', 'networkx']:
        logging.getLogger(noisy).setLevel(logging.WARNING)
