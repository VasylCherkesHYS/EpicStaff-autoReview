from contextlib import contextmanager
from collections.abc import Generator
from typing import Any

from loguru import logger
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.exc import SQLAlchemyError



class BaseORMStorage:
    def __init__(self, session: Session) -> None:
        self.session = session
    # @contextmanager
    # def session_scope(self) -> Generator[Session, Any, None]:
    #     """Provide a transactional scope around a series of operations."""
    #     session: Session = self.session_factory()
    #     try:
    #         yield session
    #         session.commit()
    #     except Exception as e:
    #         session.rollback()
    #         logger.error(f"Database transaction failed: {str(e)}")
    #         raise
    #     finally:
    #         session.close()
